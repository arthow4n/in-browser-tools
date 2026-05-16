import { AgentTool } from '../../llm-chat/tools/index.js';

export const responseGroundingTool: AgentTool = {
  name: 'response_grounding',
  description: 'Use this tool to review the generated plan and ensure it is fully grounded. It will force you to review and revise the plan 3 times. Invoke it after generating a draft plan.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_args: any, context?: any) => {
    return new Promise((resolve) => {
      const w = window as any;
      w.responseGroundingCounters = w.responseGroundingCounters || {};

      const threadId = context?.threadId || 'default';

      if (typeof w.responseGroundingCounters[threadId] === 'undefined') {
        w.responseGroundingCounters[threadId] = 0;
      }

      w.responseGroundingCounters[threadId]++;

      if (w.responseGroundingCounters[threadId] >= 3) {
        // Reset for future
        w.responseGroundingCounters[threadId] = 0;
        resolve({
          instruction: "You have reviewed the plan 3 times. Stop reviewing and output the final plan content now. Do NOT invoke any further tools. Only output the final plan text."
        });
      } else {
        resolve({
          instruction: `Review iteration ${w.responseGroundingCounters[threadId]}/3 complete. Now, review the plan you just generated in your last message. Ensure it is fully grounded and flesh out any missing details. Then generate a new, revised version of the plan and call response_grounding again.`
        });
      }
    });
  },
};
