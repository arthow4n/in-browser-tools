import { AgentTool } from '../../llm-chat/tools/index.js';

export const askQuestionTool: AgentTool = {
  name: 'ask_question',
  description: 'Ask the user a question to clarify requirements. It displays suggested answers as buttons and a free text input.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask the user.' },
      suggested_answers: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'A list of suggested answers to show as clickable buttons.'
      }
    },
    required: ['question', 'suggested_answers']
  },
  execute: async (args: any) => {
    return new Promise((resolve) => {
      // The integration layer (index.ts) will handle the UI updates.
      // We expose the resolve function globally so the UI can call it when the user answers.
      (window as any).resolveAskQuestion = resolve;
    });
  }
};
