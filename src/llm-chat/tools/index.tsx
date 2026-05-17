export interface ToolExecutionContext {
  toolCallId: string;
  threadId?: string;
  abortSignal?: AbortSignal;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: unknown;
  execute: (
    args: unknown,
    context: ToolExecutionContext,
  ) => Promise<unknown> | unknown;
}
