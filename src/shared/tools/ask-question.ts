import { AgentTool } from '../../llm-chat/tools/index.js';

export const askQuestionTool: AgentTool = {
  name: 'ask_question',
  description:
    'Ask the user questions to clarify requirements. It displays questions and suggested answers as buttons and an optional free text input. Only use this if you need input from the user before continuing.',
  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'A list of questions to ask the user.',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The question text.',
            },
            type: {
              type: 'string',
              enum: ['single_select', 'multi_select'],
              description: 'The type of question.',
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'A list of available answers to show as buttons.',
            },
            allow_freetext: {
              type: 'boolean',
              description: 'Whether to allow free text input. Default is true.',
            },
          },
          required: ['text', 'type', 'options'],
        },
      },
    },
    required: ['questions'],
  },
  execute: async (args: any, context?: any) => {
    return new Promise((resolve) => {
      const toolCallId = context?.toolCallId;
      if (!toolCallId) {
        // Fallback for isolated executions without a context ID
        if (typeof (window as any).showAskQuestionUI === 'function') {
          (window as any).showAskQuestionUI(args.questions, resolve);
        } else {
          resolve({ error: 'Missing toolCallId and showAskQuestionUI is not defined.' });
        }
        return;
      }

      const w = window as any;
      w.pendingAskQuestions = w.pendingAskQuestions || {};
      w.pendingAskQuestions[toolCallId] = { questions: args.questions, resolve };

      // Dispatch event so React components can re-render if necessary
      window.dispatchEvent(new CustomEvent('askQuestionUpdate', { detail: { toolCallId } }));
    });
  },
};
