import { LLMCore } from './llm-core.js';

export interface PromptImproverConfig {
  originalPrompt: string;
  intention: string;
  howToImprove: string;
  evaluationFocus?: string;
  maxLoopRound: number;
  branchFactor: number;
  promptType: 'system' | 'user';
}

export interface IterationResult {
  round: number;
  branch: number;
  prompt: string;
  testOutput: string;
  score: number;
  feedback: string;
  stop: boolean;
}

export interface SetupData {
  implementerSystemPrompt: string;
  evaluatorSystemPrompt: string;
  testScenarios: string[];
  evaluationCriteria: string;
}

export interface LogEvent {
  type: 'info' | 'implementer' | 'tester' | 'evaluator' | 'result' | 'cost_estimation' | 'progress';
  message: string;
  data?: any;
}

function extractJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {}
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (e3) {}
    }
    throw new Error('Failed to parse JSON from response:\n' + text);
  }
}

export class PromptImproverCore {
  private config: PromptImproverConfig;
  private llmCore: LLMCore;

  private totalEstimatedApiCalls: number = 0;
  private completedApiCalls: number = 0;
  private totalWordsProcessed: number = 0;

  constructor(config: PromptImproverConfig, llmCore: LLMCore) {
    this.config = config;
    this.llmCore = llmCore;
    // 1 (setup) + maxRounds * (1 (implementer) + branchFactor * 2 (tester + evaluator))
    this.totalEstimatedApiCalls = 1 + this.config.maxLoopRound * (1 + this.config.branchFactor * 2);
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  private updateProgress(words: number): LogEvent {
    this.completedApiCalls++;
    this.totalWordsProcessed += words;
    return {
      type: 'progress',
      message: 'Progress update',
      data: {
        completed: this.completedApiCalls,
        total: this.totalEstimatedApiCalls,
        words: this.totalWordsProcessed,
      }
    };
  }

  public async *run(): AsyncGenerator<LogEvent, IterationResult[]> {
    yield { type: 'cost_estimation', message: 'Estimated Cost', data: { apiCalls: this.totalEstimatedApiCalls } };
    yield { type: 'info', message: 'Starting Setup Phase (Adapter Agent)...' };

    const setupPrompt = `
You are an expert meta-prompt engineer. The user wants to improve a ${this.config.promptType} prompt.
Intention of the prompt: ${this.config.intention}
How it should be improved: ${this.config.howToImprove}

Generate a JSON object with the following schema:
{
  "implementerSystemPrompt": "The system prompt for the Implementer agent whose job is to iteratively rewrite the prompt based on feedback.",
  "evaluatorSystemPrompt": "The system prompt for the Evaluator agent whose job is to review the output of a test subagent using the new prompt and score it.",
  "testScenarios": ["A string representing a complex or tricky test input to feed the test subagent to rigorously verify the prompt."],
  "evaluationCriteria": "Detailed criteria for how to score the prompt output objectively on a 1 to 5 scale. Define distinctly what each score from 1 to 5 means (e.g. 1 = completely misses the mark, 5 = perfect). ${this.config.evaluationFocus ? `Please ensure the criteria strictly focuses on the following: ${this.config.evaluationFocus}` : ''}"
}

Reply ONLY with valid JSON. Do not include any other text.
`;

    const setupResponse = await this.llmCore.callLLM([
      { role: 'user' as const, content: setupPrompt },
    ]);
    yield this.updateProgress(this.countWords(setupPrompt) + this.countWords(setupResponse));

    let setupData: SetupData;
    try {
      setupData = extractJSON(setupResponse);
    } catch (e) {
      yield {
        type: 'info',
        message: 'Error parsing setup response',
        data: setupResponse,
      };
      throw e;
    }

    yield { type: 'info', message: 'Setup complete.', data: setupData };

    let currentPrompt = this.config.originalPrompt;
    let feedback =
      'This is the first round. Please improve the original prompt according to the user instructions and your system prompt.';
    const results: IterationResult[] = [];

    for (let round = 1; round <= this.config.maxLoopRound; round++) {
      yield {
        type: 'info',
        message: `--- Starting Round ${round} of ${this.config.maxLoopRound} ---`,
      };

      // 1. Implementer: Generate multiple prompt strategies
      yield {
        type: 'implementer',
        message: `Implementer is drafting ${this.config.branchFactor} new prompt strategies...`,
      };
      const implementerMessages = [
        { role: 'system' as const, content: setupData.implementerSystemPrompt },
        {
          role: 'user' as const,
          content: `Original Prompt:\n${this.config.originalPrompt}\n\nLast Version:\n${currentPrompt}\n\nFeedback from Evaluator(s):\n${feedback}\n\nPlease generate exactly ${this.config.branchFactor} DIFFERENT, distinct strategies to improve the prompt, and provide the fully rewritten prompt text for each strategy. Use the propose_prompt_strategies tool.`,
        },
      ];

      const tools = [
        {
          name: 'propose_prompt_strategies',
          description: `Provide ${this.config.branchFactor} different improved prompts based on different strategies.`,
          parameters: {
            type: 'object',
            properties: {
              strategies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    strategy_description: {
                      type: 'string',
                      description: 'A brief description of the strategy used.',
                    },
                    rewritten_prompt: {
                      type: 'string',
                      description: 'The fully rewritten prompt text.',
                    },
                  },
                  required: ['strategy_description', 'rewritten_prompt'],
                },
              },
            },
            required: ['strategies'],
          },
        },
      ];

      const llmResponse = await this.llmCore.callLLMWithTools(implementerMessages, tools);

      let proposedPrompts: string[] = [];
      let toolCallJsonStr = '';

      if (llmResponse?.tool_calls && llmResponse.tool_calls.length > 0) {
        const tc = llmResponse.tool_calls[0];
        if (tc.function.name === 'propose_prompt_strategies') {
          try {
            toolCallJsonStr = tc.function.arguments;
            const args = JSON.parse(toolCallJsonStr);
            if (args.strategies && Array.isArray(args.strategies)) {
              proposedPrompts = args.strategies.map((s: any) => s.rewritten_prompt);
            }
          } catch (e) {
             yield { type: 'info', message: 'Error parsing strategies', data: e };
          }
        }
      } else if (llmResponse?.content) {
        // Fallback if the LLM refuses to use tools
         try {
             const data = extractJSON(llmResponse.content);
             if (data.strategies && Array.isArray(data.strategies)) {
               proposedPrompts = data.strategies.map((s: any) => s.rewritten_prompt);
             } else {
               proposedPrompts = [llmResponse.content]; // fallback to single
             }
             toolCallJsonStr = llmResponse.content;
         } catch(e) {
             proposedPrompts = [llmResponse.content];
             toolCallJsonStr = llmResponse.content;
         }
      }

      // Ensure we have prompts
      if (proposedPrompts.length === 0) {
        proposedPrompts = [currentPrompt];
      }

      // Limit to branch factor
      proposedPrompts = proposedPrompts.slice(0, this.config.branchFactor);

      yield this.updateProgress(this.countWords(implementerMessages[0].content + implementerMessages[1].content) + this.countWords(toolCallJsonStr));

      yield {
        type: 'implementer',
        message: `Generated ${proposedPrompts.length} prompt branches.`,
        data: proposedPrompts,
      };

      const roundResults: IterationResult[] = [];

      for (let branch = 0; branch < proposedPrompts.length; branch++) {
        let newPrompt = proposedPrompts[branch];
        if (newPrompt.startsWith('\`\`\`') && newPrompt.endsWith('\`\`\`')) {
          newPrompt = newPrompt
            .replace(/^\`\`\`[a-z]*\n/, '')
            .replace(/\n\`\`\`$/, '');
        }

        // 2. Test Subagent
        yield {
          type: 'tester',
          message:
            `Running test scenario with branch ${branch + 1} prompt...`,
        };
        const scenario = setupData.testScenarios[0] || 'Hello';
        let testerMessages: any[] = [];

        if (this.config.promptType === 'system') {
          testerMessages = [
            { role: 'system' as const, content: newPrompt },
            { role: 'user' as const, content: scenario },
          ];
        } else {
          testerMessages = [
            {
              role: 'user' as const,
              content: `${newPrompt}\n\nInput: ${scenario}`,
            },
          ];
        }

        const testOutput = await this.llmCore.callLLM(testerMessages);
        yield this.updateProgress(this.countWords(testerMessages[0].content + (testerMessages[1] ? testerMessages[1].content : '')) + this.countWords(testOutput));

        yield { type: 'tester', message: `Branch ${branch + 1} test complete.`, data: testOutput };

        // 3. Evaluator
        yield {
          type: 'evaluator',
          message: `Evaluator is reviewing branch ${branch + 1} test output...`,
        };
        const evalPrompt = `
Evaluation Criteria:
${setupData.evaluationCriteria}

Prompt being tested:
${newPrompt}

Test Scenario provided to subagent:
${scenario}

Output from Test Subagent:
${testOutput}

Provide your evaluation in JSON format:
{
  "score": <number 1-5>,
  "feedback": "<Detailed feedback on what is good, what is bad, and exactly how to improve in the next iteration>",
  "stop": <boolean, true if the prompt is perfect or cannot be reasonably improved further, false to continue loop>
}

Reply ONLY with valid JSON.
`;
        const evaluatorMessages = [
          { role: 'system' as const, content: setupData.evaluatorSystemPrompt },
          { role: 'user' as const, content: evalPrompt },
        ];

        const evalResponse = await this.llmCore.callLLM(evaluatorMessages);
        yield this.updateProgress(this.countWords(evaluatorMessages[0].content + evaluatorMessages[1].content) + this.countWords(evalResponse));

        let evalData: any;
        try {
          evalData = extractJSON(evalResponse);
        } catch (e) {
          yield {
            type: 'info',
            message: `Error parsing evaluator response for branch ${branch + 1}`,
            data: evalResponse,
          };
          evalData = { score: 1, feedback: 'Failed to evaluate.', stop: false };
        }

        yield {
          type: 'evaluator',
          message: `Branch ${branch + 1} evaluation complete. Score: ${evalData.score}, Stop: ${evalData.stop}`,
          data: evalData,
        };

        const result: IterationResult = {
          round,
          branch: branch + 1,
          prompt: newPrompt,
          testOutput,
          score: evalData.score || 0,
          feedback: evalData.feedback || 'No feedback provided.',
          stop: !!evalData.stop,
        };
        roundResults.push(result);
        results.push(result);
      }

      // Aggregate feedback and pick best
      roundResults.sort((a, b) => b.score - a.score);
      const bestResult = roundResults[0];

      if (bestResult.stop) {
        yield { type: 'info', message: 'Evaluator signaled to stop the loop.' };
        break;
      }

      currentPrompt = bestResult.prompt;

      // Create aggregated feedback
      feedback = roundResults.map((r) => `Branch ${r.branch} Feedback (Score: ${r.score}):\n${r.feedback}`).join('\n\n');
      feedback += `\n\nI have selected the prompt from Branch ${bestResult.branch} as the best to continue from. Please learn from the feedback of all branches.`;
    }

    // After the loop finishes, emit a final progress event to ensure it reaches 100% locally if there was an early stop.
    // Or just let the UI know it is done.

    yield {
      type: 'result',
      message: 'Multi-agent loop finished.',
      data: results,
    };
    return results;
  }
}
