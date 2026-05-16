import { AgentTool } from '../../llm-chat/tools/index.js';

export const randomTool: AgentTool = {
  name: 'random',
  description:
    'Provides a true random choice from an array of text options. Use this tool anytime you need to make a random decision or randomly pick an option.',
  parameters: {
    type: 'object',
    properties: {
      options: {
        type: 'array',
        description: 'A list of string options to randomly pick from.',
        items: {
          type: 'string',
        },
      },
    },
    required: ['options'],
  },
  execute: async (args: any) => {
    const options = args.options;
    if (!Array.isArray(options) || options.length === 0) {
      return { error: 'options must be a non-empty array of strings.' };
    }

    const randomIndex = Math.floor(Math.random() * options.length);
    const chosen = options[randomIndex];

    return { chosen };
  },
};
