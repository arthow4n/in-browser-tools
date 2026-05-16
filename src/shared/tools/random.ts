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
      num_choices: {
        type: 'number',
        description: 'The number of unique choices to pick from the options array.',
      },
      hide_details: {
        type: 'boolean',
        description: 'Whether to hide the exact arguments and results of this tool call in the UI by default. Set to true for things like keeping role-play story progression hidden from the player. Set to false if you want the user to explicitly see the options and choices made.',
      },
    },
    required: ['options', 'num_choices', 'hide_details'],
  },
  execute: async (args: any) => {
    const options = args.options;
    const num_choices = args.num_choices;

    if (!Array.isArray(options) || options.length === 0) {
      return { error: 'options must be a non-empty array of strings.' };
    }

    if (typeof num_choices !== 'number' || num_choices < 1 || num_choices > options.length) {
      return { error: `num_choices must be a number between 1 and ${options.length}.` };
    }

    const selectedIndices = new Set<number>();
    while (selectedIndices.size < num_choices) {
      const randomIndex = Math.floor(Math.random() * options.length);
      selectedIndices.add(randomIndex);
    }

    const chosen = Array.from(selectedIndices).map((index) => options[index]);

    return chosen;
  },
};
