export interface PromptImproverConfig {
  apiKey: string;
  model: string;
  originalPrompt: string;
  intention: string;
  howToImprove: string;
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

  constructor(config: PromptImproverConfig) {
    this.config = config;
  }

  private async callLLM(messages: any[], retries = 2): Promise<string> {
    let attempt = 0;
    let lastError: any;

    while (attempt <= retries) {
      try {
        const res = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.href,
              'X-Title': 'In-Browser Tools',
            },
            body: JSON.stringify({
              model: this.config.model,
              messages,
            }),
          },
        );

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API Error: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        return data.choices[0]?.message?.content || '';
      } catch (err) {
        lastError = err;
        attempt++;
        if (attempt <= retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    throw lastError;
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
  "evaluationCriteria": "Detailed criteria for how to score the prompt output objectively (1-100 scale)."
}

Reply ONLY with valid JSON. Do not include any other text.
`;

    const setupResponse = await this.callLLM([
      { role: 'user', content: setupPrompt },
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
        { role: 'system', content: setupData.implementerSystemPrompt },
        {
          role: 'user',
          content: `Original Prompt:\n${this.config.originalPrompt}\n\nLast Version:\n${currentPrompt}\n\nFeedback from Evaluator:\n${feedback}\n\nPlease provide ONLY the new rewritten prompt text. Do not wrap it in markdown block unless it is part of the prompt itself.`,
        },
      ];
      let newPrompt = await this.callLLM(implementerMessages);
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
          { role: 'system', content: newPrompt },
          { role: 'user', content: scenario },
        ];
      } else {
        testerMessages = [
          { role: 'user', content: `${newPrompt}\n\nInput: ${scenario}` },
        ];
      }

      const testOutput = await this.callLLM(testerMessages);
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
  "score": <number 1-100>,
  "feedback": "<Detailed feedback on what is good, what is bad, and exactly how to improve in the next iteration>",
  "stop": <boolean, true if the prompt is perfect or cannot be reasonably improved further, false to continue loop>
}

Reply ONLY with valid JSON.
`;
      const evaluatorMessages = [
        { role: 'system', content: setupData.evaluatorSystemPrompt },
        { role: 'user', content: evalPrompt },
      ];

      const evalResponse = await this.callLLM(evaluatorMessages);
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
