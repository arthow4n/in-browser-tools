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
import { getStorage, setStorage } from '../shared/storage.js';

export interface ChatMessage extends SharedChatMessage {
  id: string; // Override to make it required
}

export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
  toolsEnabled?: boolean;
  disabledTools?: string[];
}

export class ChatCore extends LLMCore {
  public storagePrefix: string;
  public systemPrompt: string = 'You are a helpful assistant.';
  public savedPrompts: SavedPrompt[] = [];
  public history: ChatMessage[] = [];
  public toolsEnabled: boolean = false;
  public disabledTools: Set<string> = new Set();
  public tools: AgentTool[] = [];
  public builtInPrompts: SavedPrompt[] = [
    {
      id: 'builtin-assistant',
      name: 'Assistant',
      content: 'You are a helpful assistant.',
      toolsEnabled: false,
      disabledTools: []
    },
    {
      id: 'builtin-brainpicker',
      name: 'Brain-picker',
      content: 'You are a Brain-Picker. Your goal is NOT to answer questions or provide solutions directly. Instead, aggressively use the ask_question tool to make the user elaborate, think out loud, and flesh out their vague ideas. Always provide diverse options when invoking ask_question rather than leaving free input all the time. Help the user clarify their own thoughts.',
      toolsEnabled: true,
      disabledTools: []
    }
  ];

  constructor(storagePrefix: string = 'llm-chat-') {
    super();
    this.storagePrefix = storagePrefix;
    this.loadChatState();
  }

  registerTool(tool: AgentTool) {
    this.tools.push(tool);
  }

  loadChatState() {
    this.systemPrompt =
      getStorage(
        `${this.storagePrefix}systemPrompt` as import('../shared/storage.js').StorageKey,
      ) || 'You are a helpful assistant.';

    try {
      this.savedPrompts = JSON.parse(
        getStorage(
          `${this.storagePrefix}savedPrompts` as import('../shared/storage.js').StorageKey,
        ) || '[]',
      );
    } catch {
      this.savedPrompts = [];
    }

    try {
      this.history = JSON.parse(
        getStorage(
          `${this.storagePrefix}history` as import('../shared/storage.js').StorageKey,
        ) || '[]',
      );
    } catch {
      this.history = [];
    }

    this.toolsEnabled =
      getStorage(
        `${this.storagePrefix}toolsEnabled` as import('../shared/storage.js').StorageKey,
      ) === 'true';
    try {
      const disabled = JSON.parse(
        getStorage(
          `${this.storagePrefix}disabledTools` as import('../shared/storage.js').StorageKey,
        ) || '[]',
      );
      this.disabledTools = new Set(disabled);
    } catch {
      this.disabledTools = new Set();
    }
  }

  saveChatState() {
    setStorage(
      `${this.storagePrefix}systemPrompt` as import('../shared/storage.js').StorageKey,
      this.systemPrompt,
    );
    setStorage(
      `${this.storagePrefix}savedPrompts` as import('../shared/storage.js').StorageKey,
      JSON.stringify(this.savedPrompts),
    );
    setStorage(
      `${this.storagePrefix}history` as import('../shared/storage.js').StorageKey,
      JSON.stringify(this.history),
    );
    setStorage(
      `${this.storagePrefix}toolsEnabled` as import('../shared/storage.js').StorageKey,
      this.toolsEnabled.toString(),
    );
    setStorage(
      `${this.storagePrefix}disabledTools` as import('../shared/storage.js').StorageKey,
      JSON.stringify(Array.from(this.disabledTools)),
    );
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
      toolsToPass = this.tools.filter((t) => this.isToolEnabled(t.name));
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
      branchFactor: 1,
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
