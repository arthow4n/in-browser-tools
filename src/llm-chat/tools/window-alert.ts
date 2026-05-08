import { AgentTool } from './index.js';

export const windowAlertTool: AgentTool = {
  name: 'window_alert',
  description: 'Shows a browser alert dialog to the user with a message.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to show in the alert dialog.',
      },
    },
    required: ['message'],
  },
  execute: (args: Record<string, any>) => {
    window.alert(args.message);
    return `Alert shown with message: ${args.message}`;
  },
};
