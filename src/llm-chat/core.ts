import {
  LLMCore,
  ChatMessage as SharedChatMessage,
  StreamChunk,
} from '../shared/llm-core.js';
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
  }

  saveChatState() {
    localStorage.setItem('llm-chat-systemPrompt', this.systemPrompt);
    localStorage.setItem(
      'llm-chat-savedPrompts',
      JSON.stringify(this.savedPrompts),
    );
    localStorage.setItem('llm-chat-history', JSON.stringify(this.history));
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

    const toolsToPass = this.toolsEnabled ? this.tools : undefined;
    yield* this.streamCompletionWithTools(messages, toolsToPass);
  }

  async improveSystemPrompt(): Promise<string> {
    if (!this.apiKey) throw new Error('API Key is required');
    if (!this.model) throw new Error('Model is required');

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert prompt engineer. Please rewrite and improve the following system prompt to be more effective and clear. Reply ONLY with the rewritten prompt.',
          },
          { role: 'user', content: this.systemPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to improve system prompt: ${res.status} ${res.statusText} - ${text}`,
      );
    }
    const data = await res.json();
    return data.choices[0]?.message?.content || this.systemPrompt;
  }
}
