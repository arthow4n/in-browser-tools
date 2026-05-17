import { AgentTool, ToolExecutionContext } from '../../llm-chat/tools/index.js';

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
        description:
          'The number of unique choices to pick from the options array.',
      },
      hide_details: {
        type: 'boolean',
        description:
          'Whether to hide the exact arguments and results in the UI. For example, when handling role play story progression, a hidden random should be preferred to keep the player unaware of upcoming events. Set to false if you want the user to see the exact options and the random result.',
      },
    },
    required: ['options', 'num_choices', 'hide_details'],
  },
  execute: async (args: unknown, context: ToolExecutionContext) => {
    const typedArgs = args as any;
    const options = typedArgs.options;
    const num_choices = typedArgs.num_choices;

    if (!Array.isArray(options) || options.length === 0) {
      return { error: 'options must be a non-empty array of strings.' };
    }

    if (
      typeof num_choices !== 'number' ||
      num_choices < 1 ||
      num_choices > options.length
    ) {
      return {
        error: `num_choices must be a number between 1 and ${options.length}.`,
      };
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
