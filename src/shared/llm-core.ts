export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Model {
  id: string;
  name: string;
}

export class LLMCore {
  public apiKey: string = '';
  public model: string = 'google/gemini-2.5-flash';

  constructor() {
    this.loadState();
  }

  public loadState() {
    this.apiKey = localStorage.getItem('shared-openrouter-apiKey') || '';
    this.model =
      localStorage.getItem('shared-openrouter-model') ||
      'google/gemini-2.5-flash';
  }

  public saveState() {
    localStorage.setItem('shared-openrouter-apiKey', this.apiKey);
    localStorage.setItem('shared-openrouter-model', this.model);
  }

  public async fetchModels(): Promise<Model[]> {
    if (!this.apiKey) {
      throw new Error('Please enter an OpenRouter API Key first.');
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) throw new Error('Failed to fetch models');

    const data = await res.json();
    return data.data.map((m: any) => ({ id: m.id, name: m.name }));
  }

  public async callLLM(messages: ChatMessage[], retries = 2): Promise<string> {
    let attempt = 0;
    let lastError: any;

    while (attempt <= retries) {
      try {
        const res = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.href,
              'X-Title': 'In-Browser Tools',
            },
            body: JSON.stringify({
              model: this.model,
              messages,
            }),
          },
        );

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API Error: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        return data.choices[0]?.message?.content || '';
      } catch (err) {
        lastError = err;
        attempt++;
        if (attempt <= retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    throw lastError;
  }

  public async *streamCompletion(
    messages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
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
}
