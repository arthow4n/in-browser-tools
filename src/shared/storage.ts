const PREFIX = 'in-browser-tools:';

export type StorageKey =
  | 'shared-openrouter-apiKey'
  | 'shared-openrouter-model'
  | 'shared-openrouter-providerPrefs'
  | 'shared-openrouter-presets'
  | 'shared-openrouter-activePresetId'
  | `${string}systemPrompt`
  | `${string}selectedPromptId`
  | `${string}savedPrompts`
  | `${string}history`
  | `${string}toolsEnabled`
  | `${string}disabledTools`
  | 'prompt-improver-originalPrompt'
  | 'prompt-improver-intention'
  | 'prompt-improver-howToImprove'
  | 'prompt-improver-evaluationFocus'
  | 'prompt-improver-testInput'
  | 'prompt-improver-testExpectedOutput'
  | 'prompt-improver-maxRounds'
  | 'prompt-improver-branchFactor'
  | 'prompt-improver-promptType'
  | 'agent-workflow-designer-savedAgents'
  | 'agent-workflow-designer-currentTask'
  | 'text-adventure-characterName'
  | 'text-adventure-characterDescription'
  | 'text-adventure-scenarioRequest'
  | 'text-adventure-outputLanguage'
  | 'text-adventure-savedAdventures'
  | 'llm-chat-threads'
  | 'llm-chat-activeThreadId';

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
    if (
      key &&
      key.startsWith(PREFIX) &&
      !key.startsWith(PREFIX + 'shared-openrouter-')
    ) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
