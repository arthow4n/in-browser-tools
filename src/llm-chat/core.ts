export interface ChatMessage {
  id: string; // Used for identifying in history for edit/delete
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Model {
  id: string;
  name: string;
}

export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
}

export class ChatCore {
  public apiKey: string = '';
  public model: string = '';
  public systemPrompt: string = 'You are a helpful assistant.';
  public savedPrompts: SavedPrompt[] = [];
  public history: ChatMessage[] = [];

  constructor() {
    this.loadState();
  }

  loadState() {
    // API key and model are managed by the shared component.
    // They are updated via onChange callback instead.

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

  saveState() {
    // API key and model are managed by the shared component.
    localStorage.setItem('llm-chat-systemPrompt', this.systemPrompt);
    localStorage.setItem(
      'llm-chat-savedPrompts',
      JSON.stringify(this.savedPrompts),
    );
    localStorage.setItem('llm-chat-history', JSON.stringify(this.history));
  }

  async *streamCompletion(
    newMessages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) throw new Error('API Key is required');
    if (!this.model) throw new Error('Model is required');

    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.history.map((m) => ({ role: m.role, content: m.content })),
      ...newMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Failed to fetch completion: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }

    if (!res.body) throw new Error('Response body is null');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            console.error('Failed to parse streaming data', e, line);
          }
        }
      }
    }
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
