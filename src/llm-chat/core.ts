import {
  LLMCore,
  ChatMessage as SharedChatMessage,
  StreamChunk,
} from '../shared/llm-core.js';
import {
  PromptImproverCore,
  PromptImproverConfig,
} from '../shared/prompt-improver-core.js';
import { AgentTool } from './tools/index.js';

export interface ChatMessage extends SharedChatMessage {
  id: string; // Override to make it required
}

export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
}

export class ChatCore extends LLMCore {
  public systemPrompt: string = 'You are a helpful assistant.';
  public savedPrompts: SavedPrompt[] = [];
  public history: ChatMessage[] = [];
  public toolsEnabled: boolean = false;
  public disabledTools: Set<string> = new Set();
  public tools: AgentTool[] = [];

  constructor() {
    super();
    this.loadChatState();
  }

  registerTool(tool: AgentTool) {
    this.tools.push(tool);
  }

  loadChatState() {
    this.systemPrompt =
      localStorage.getItem('llm-chat-systemPrompt') ||
      'You are a helpful assistant.';

    try {
      this.savedPrompts = JSON.parse(
        localStorage.getItem('llm-chat-savedPrompts') || '[]',
      );
    } catch {
      this.savedPrompts = [];
    }

    try {
      this.history = JSON.parse(
        localStorage.getItem('llm-chat-history') || '[]',
      );
    } catch {
      this.history = [];
    }

    this.toolsEnabled = localStorage.getItem('llm-chat-toolsEnabled') === 'true';
    try {
      const disabled = JSON.parse(
        localStorage.getItem('llm-chat-disabledTools') || '[]',
      );
      this.disabledTools = new Set(disabled);
    } catch {
      this.disabledTools = new Set();
    }
  }

  saveChatState() {
    localStorage.setItem('llm-chat-systemPrompt', this.systemPrompt);
    localStorage.setItem(
      'llm-chat-savedPrompts',
      JSON.stringify(this.savedPrompts),
    );
    localStorage.setItem('llm-chat-history', JSON.stringify(this.history));
    localStorage.setItem('llm-chat-toolsEnabled', this.toolsEnabled.toString());
    localStorage.setItem('llm-chat-disabledTools', JSON.stringify(Array.from(this.disabledTools)));
  }

  isToolEnabled(name: string): boolean {
    return !this.disabledTools.has(name);
  }

  setToolEnabled(name: string, enabled: boolean) {
    if (enabled) {
      this.disabledTools.delete(name);
    } else {
      this.disabledTools.add(name);
    }
  }

  async *streamChatCompletion(
    newMessages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
    const allMessages = [...this.history, ...newMessages];
    const messages: SharedChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...allMessages.map((m) => {
        const mapped: SharedChatMessage = { role: m.role, content: m.content };
        if (m.tool_calls) mapped.tool_calls = m.tool_calls;
        if (m.tool_call_id) mapped.tool_call_id = m.tool_call_id;
        return mapped;
      }),
    ];

    yield* this.streamCompletion(messages);
  }

  async *streamChatCompletionWithTools(
    newMessages: ChatMessage[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const allMessages = [...this.history, ...newMessages];
    const messages: SharedChatMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...allMessages.map((m) => {
        const mapped: SharedChatMessage = { role: m.role, content: m.content };
        if (m.tool_calls) mapped.tool_calls = m.tool_calls;
        if (m.tool_call_id) mapped.tool_call_id = m.tool_call_id;
        return mapped;
      }),
    ];

    let toolsToPass = undefined;
    if (this.toolsEnabled) {
      toolsToPass = this.tools.filter(t => this.isToolEnabled(t.name));
      if (toolsToPass.length === 0) {
        toolsToPass = undefined;
      }
    }

    yield* this.streamCompletionWithTools(messages, toolsToPass);
  }

  async improveSystemPrompt(
    intention: string = '',
    howToImprove: string = '',
    evaluationFocus: string = '',
  ): Promise<string> {
    if (!this.apiKey) throw new Error('API Key is required');
    if (!this.model) throw new Error('Model is required');

    const config: PromptImproverConfig = {
      originalPrompt: this.systemPrompt,
      intention:
        intention ||
        'Improve the clarity and effectiveness of this system prompt.',
      howToImprove:
        howToImprove ||
        'Ensure the LLM understands its role and fills in missing details from the vague prompt.',
      evaluationFocus: evaluationFocus || '',
      maxLoopRound: 1,
      promptType: 'system',
    };

    const improverCore = new PromptImproverCore(config, this);
    const generator = improverCore.run();

    let finalResults = null;
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        if (value) finalResults = value;
        break;
      }
    }

    if (finalResults && finalResults.length > 0) {
      // Return the prompt from the last round
      return finalResults[finalResults.length - 1].prompt;
    }

    return this.systemPrompt;
  }
}
