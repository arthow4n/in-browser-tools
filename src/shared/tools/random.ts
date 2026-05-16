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
      count: {
        type: 'number',
        description: 'How many choices to randomly pick from the options without repeating the same option index.',
      },
    },
    required: ['options', 'count'],
  },
  execute: async (args: any) => {
    const options = args.options;
    if (!Array.isArray(options) || options.length === 0) {
      return { error: 'options must be a non-empty array of strings.' };
    }

    const count = args.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > options.length) {
      return { error: 'count must be a positive integer less than or equal to the number of options.' };
    }

    const availableIndices = Array.from({ length: options.length }, (_, i) => i);
    const chosen = [];

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availableIndices.length);
      const chosenIndex = availableIndices.splice(randomIndex, 1)[0];
      chosen.push(options[chosenIndex]);
    }

    return { chosen };
  },
};
