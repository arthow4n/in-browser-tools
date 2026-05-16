export interface AgentTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  execute: (args: any, context?: any) => Promise<any> | any;
}
