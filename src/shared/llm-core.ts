import { getStorage, setStorage } from './storage.js';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string; // For role='tool'
}

export interface StreamChunk {
  type: 'text' | 'tool_call';
  text?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
}

export interface Model {
  id: string;
  name: string;
}

export interface ProviderPrefs {
  order: string[];
  allowFallbacks: boolean;
  dataCollection: 'allow' | 'deny';
  zdr: boolean;
  reasoningEffort:
    | 'xhigh'
    | 'high'
    | 'medium'
    | 'low'
    | 'minimal'
    | 'none'
    | '';
}

export interface OpenRouterPreset {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  providerPrefs: ProviderPrefs;
}

export class LLMCore {
  public presets: OpenRouterPreset[] = [];
  public activePresetId: string = '';

  constructor() {
    this.loadState();
  }

  // Proxies for backwards compatibility
  get apiKey(): string {
    const active = this.presets.find((p) => p.id === this.activePresetId);
    return active ? active.apiKey : '';
  }

  set apiKey(val: string) {
    const active = this.presets.find((p) => p.id === this.activePresetId);
    if (active) active.apiKey = val;
  }

  get model(): string {
    const active = this.presets.find((p) => p.id === this.activePresetId);
    return active ? active.model : 'google/gemini-2.5-flash';
  }

  set model(val: string) {
    const active = this.presets.find((p) => p.id === this.activePresetId);
    if (active) active.model = val;
  }

  get providerPrefs(): ProviderPrefs {
    const active = this.presets.find((p) => p.id === this.activePresetId);
    if (active) return active.providerPrefs;
    // Return dummy if not found, though should not happen if state is loaded
    return {
      order: ['deepinfra'],
      allowFallbacks: true,
      dataCollection: 'deny',
      zdr: true,
      reasoningEffort: '',
    };
  }

  set providerPrefs(val: ProviderPrefs) {
    const active = this.presets.find((p) => p.id === this.activePresetId);
    if (active) active.providerPrefs = val;
  }

  public addPreset(name: string): OpenRouterPreset {
    const newPreset: OpenRouterPreset = {
      id: crypto.randomUUID(),
      name,
      apiKey: '',
      model: 'google/gemini-2.5-flash',
      providerPrefs: {
        order: ['deepinfra'],
        allowFallbacks: true,
        dataCollection: 'deny',
        zdr: true,
        reasoningEffort: '',
      },
    };
    this.presets.push(newPreset);
    this.activePresetId = newPreset.id;
    this.saveState();
    return newPreset;
  }

  public renamePreset(id: string, newName: string) {
    const preset = this.presets.find((p) => p.id === id);
    if (preset) {
      preset.name = newName;
      this.saveState();
    }
  }

  public deletePreset(id: string) {
    if (this.presets.length <= 1) return; // Must have at least one preset
    this.presets = this.presets.filter((p) => p.id !== id);
    if (this.activePresetId === id) {
      this.activePresetId = this.presets[0].id;
    }
    this.saveState();
  }

  public switchPreset(id: string) {
    if (this.presets.find((p) => p.id === id)) {
      this.activePresetId = id;
      this.saveState();
    }
  }

  public loadState() {
    try {
      const savedPresets = getStorage('shared-openrouter-presets');
      if (savedPresets) {
        this.presets = JSON.parse(savedPresets);
      }
    } catch {
      // Ignored
    }

    this.activePresetId = getStorage('shared-openrouter-activePresetId') || '';

    // Migration from old single-config layout if presets are empty
    if (!this.presets || this.presets.length === 0) {
      const legacyApiKey = getStorage('shared-openrouter-apiKey') || '';
      const legacyModel =
        getStorage('shared-openrouter-model') || 'google/gemini-2.5-flash';
      let legacyPrefs: ProviderPrefs = {
        order: ['deepinfra'],
        allowFallbacks: true,
        dataCollection: 'deny',
        zdr: true,
        reasoningEffort: '',
      };
      try {
        const savedPrefs = getStorage('shared-openrouter-providerPrefs');
        if (savedPrefs) {
          legacyPrefs = { ...legacyPrefs, ...JSON.parse(savedPrefs) };
        }
      } catch {
        // Ignored
      }

      const defaultPreset: OpenRouterPreset = {
        id: crypto.randomUUID(),
        name: 'Default Preset',
        apiKey: legacyApiKey,
        model: legacyModel,
        providerPrefs: legacyPrefs,
      };

      this.presets = [defaultPreset];
      this.activePresetId = defaultPreset.id;
      this.saveState();
    }

    if (!this.presets.find((p) => p.id === this.activePresetId)) {
      this.activePresetId = this.presets[0].id;
    }
  }

  public saveState() {
    setStorage('shared-openrouter-presets', JSON.stringify(this.presets));
    setStorage('shared-openrouter-activePresetId', this.activePresetId);

    // Also save legacy keys for backwards compatibility in case any old logic still reads them directly without core (shouldn't happen but safe)
    const active = this.presets.find((p) => p.id === this.activePresetId);
    if (active) {
      setStorage('shared-openrouter-apiKey', active.apiKey);
      setStorage('shared-openrouter-model', active.model);
      setStorage(
        'shared-openrouter-providerPrefs',
        JSON.stringify(active.providerPrefs),
      );
    }
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
              reasoning_effort: this.providerPrefs.reasoningEffort || undefined,
              provider: {
                order: this.providerPrefs.order,
                allow_fallbacks: this.providerPrefs.allowFallbacks,
                data_collection: this.providerPrefs.dataCollection,
                zdr: this.providerPrefs.zdr,
              },
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

  public async callLLMWithTools(
    messages: ChatMessage[],
    tools: any[],
    retries = 2,
  ): Promise<any> {
    let attempt = 0;
    let lastError: any;

    while (attempt <= retries) {
      try {
        const body: any = {
          model: this.model,
          messages,
          reasoning_effort: this.providerPrefs.reasoningEffort || undefined,
          provider: {
            order: this.providerPrefs.order,
            allow_fallbacks: this.providerPrefs.allowFallbacks,
            data_collection: this.providerPrefs.dataCollection,
            zdr: this.providerPrefs.zdr,
          },
        };

        if (tools && tools.length > 0) {
          body.tools = tools.map((t) => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          }));
        }

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
            body: JSON.stringify(body),
          },
        );

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API Error: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        return data.choices[0]?.message;
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
        reasoning_effort: this.providerPrefs.reasoningEffort || undefined,
        provider: {
          order: this.providerPrefs.order,
          allow_fallbacks: this.providerPrefs.allowFallbacks,
          data_collection: this.providerPrefs.dataCollection,
          zdr: this.providerPrefs.zdr,
        },
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

  public async *streamCompletionWithTools(
    messages: ChatMessage[],
    tools?: any[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.apiKey) throw new Error('API Key is required');
    if (!this.model) throw new Error('Model is required');

    const body: any = {
      model: this.model,
      messages: messages,
      stream: true,
      reasoning_effort: this.providerPrefs.reasoningEffort || undefined,
      provider: {
        order: this.providerPrefs.order,
        allow_fallbacks: this.providerPrefs.allowFallbacks,
        data_collection: this.providerPrefs.dataCollection,
        zdr: this.providerPrefs.zdr,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

    // Track ongoing tool calls across chunks
    const toolCallsMap = new Map<number, any>();

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
            const delta = data.choices[0]?.delta;

            if (delta?.content) {
              yield { type: 'text', text: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index;
                if (!toolCallsMap.has(index)) {
                  toolCallsMap.set(index, {
                    id: tc.id,
                    type: 'function',
                    function: {
                      name: tc.function.name,
                      arguments: tc.function.arguments || '',
                    },
                  });
                } else {
                  const existing = toolCallsMap.get(index);
                  if (tc.function?.arguments) {
                    existing.function.arguments += tc.function.arguments;
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to parse streaming data', e, line);
          }
        }
      }
    }

    // Yield final aggregated tool calls
    for (const [_, tc] of toolCallsMap.entries()) {
      yield {
        type: 'tool_call',
        toolCall: {
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      };
    }
  }
}
