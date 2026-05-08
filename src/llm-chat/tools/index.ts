export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON schema
  execute: (args: Record<string, any>) => Promise<string> | string;
}
