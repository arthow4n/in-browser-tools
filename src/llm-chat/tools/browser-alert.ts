import { AgentTool } from './index.js';

export const browserAlertTool: AgentTool = {
  name: 'browser_alert',
  description: 'Shows a browser alert dialog to the user',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to show in the alert dialog',
      },
    },
    required: ['message'],
  },
  execute: (args: { message: string }) => {
    window.alert(args.message);
    return { success: true, message: `Alert shown with text: ${args.message}` };
  },
};
