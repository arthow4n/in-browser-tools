const PREFIX = 'in-browser-tools:';

export type StorageKey =
  | 'shared-openrouter-apiKey'
  | 'shared-openrouter-model'
  | 'shared-openrouter-providerPrefs'
  | 'llm-chat-systemPrompt'
  | 'llm-chat-savedPrompts'
  | 'llm-chat-history'
  | 'llm-chat-toolsEnabled'
  | 'llm-chat-disabledTools'
  | 'prompt-improver-originalPrompt'
  | 'prompt-improver-intention'
  | 'prompt-improver-howToImprove'
  | 'prompt-improver-evaluationFocus'
  | 'prompt-improver-maxRounds'
  | 'prompt-improver-branchFactor'
  | 'prompt-improver-promptType'
  | 'agent-workflow-designer-history'
  | 'agent-workflow-designer-savedAgents'
  | 'agent-workflow-designer-currentTask'
  | 'text-adventure-systemPrompt'
  | 'text-adventure-history'
  | 'text-adventure-characterName'
  | 'text-adventure-characterDescription'
  | 'text-adventure-scenarioRequest'
  | 'text-adventure-outputLanguage';

export function getStorage(key: StorageKey): string | null {
  return localStorage.getItem(PREFIX + key);
}

export function setStorage(key: StorageKey, value: string): void {
  localStorage.setItem(PREFIX + key, value);
}

export function clearAllSettings(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

export function clearToolSettings(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX) && !key.startsWith(PREFIX + 'shared-openrouter-')) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
