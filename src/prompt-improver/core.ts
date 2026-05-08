import { LLMCore } from '../shared/llm-core.js';

export interface PromptImproverConfig {
  originalPrompt: string;
  intention: string;
  howToImprove: string;
  evaluationFocus?: string;
  maxLoopRound: number;
  promptType: 'system' | 'user';
}

export interface IterationResult {
  round: number;
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
  type: 'info' | 'implementer' | 'tester' | 'evaluator' | 'result';
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

  constructor(config: PromptImproverConfig, llmCore: LLMCore) {
    this.config = config;
    this.llmCore = llmCore;
  }

  public async *run(): AsyncGenerator<LogEvent, IterationResult[]> {
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

      // 1. Implementer: Generate new prompt
      yield {
        type: 'implementer',
        message: 'Implementer is drafting a new prompt...',
      };
      const implementerMessages = [
        { role: 'system' as const, content: setupData.implementerSystemPrompt },
        {
          role: 'user' as const,
          content: `Original Prompt:\n${this.config.originalPrompt}\n\nLast Version:\n${currentPrompt}\n\nFeedback from Evaluator:\n${feedback}\n\nPlease provide ONLY the new rewritten prompt text. Do not wrap it in markdown block unless it is part of the prompt itself.`,
        },
      ];
      let newPrompt = await this.llmCore.callLLM(implementerMessages);
      if (newPrompt.startsWith('\`\`\`') && newPrompt.endsWith('\`\`\`')) {
        newPrompt = newPrompt
          .replace(/^\`\`\`[a-z]*\n/, '')
          .replace(/\n\`\`\`$/, '');
      }

      yield {
        type: 'implementer',
        message: `New prompt generated.`,
        data: newPrompt,
      };

      // 2. Test Subagent
      yield {
        type: 'tester',
        message:
          'Running test scenario with the new prompt (No context Ralph Wiggum style)...',
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
      yield { type: 'tester', message: `Test run complete.`, data: testOutput };

      // 3. Evaluator
      yield {
        type: 'evaluator',
        message: 'Evaluator is reviewing the test output...',
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
      let evalData: any;
      try {
        evalData = extractJSON(evalResponse);
      } catch (e) {
        yield {
          type: 'info',
          message: 'Error parsing evaluator response',
          data: evalResponse,
        };
        throw e;
      }

      yield {
        type: 'evaluator',
        message: `Evaluation complete. Score: ${evalData.score}, Stop: ${evalData.stop}`,
        data: evalData,
      };

      results.push({
        round,
        prompt: newPrompt,
        testOutput,
        score: evalData.score || 0,
        feedback: evalData.feedback || 'No feedback provided.',
        stop: !!evalData.stop,
      });

      if (evalData.stop) {
        yield { type: 'info', message: 'Evaluator signaled to stop the loop.' };
        break;
      }

      currentPrompt = newPrompt;
      feedback = evalData.feedback;
    }

    yield {
      type: 'result',
      message: 'Multi-agent loop finished.',
      data: results,
    };
    return results;
  }
}
