import { LLMCore } from './llm-core.js';

export function setupLLMSettings(container: HTMLElement, core: LLMCore) {
  // Setup HTML structure
  container.innerHTML = `
    <label for="shared-api-key">OpenRouter API Key:</label>
    <input type="password" id="shared-api-key" placeholder="sk-or-v1-..." />

    <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px;">
      <div style="flex-grow: 1;">
        <label for="shared-model-input">Model:</label>
        <input
          type="text"
          id="shared-model-input"
          list="shared-models-list"
          placeholder="Select or type model ID..."
        />
        <datalist id="shared-models-list"></datalist>
      </div>
      <button id="shared-fetch-models-btn" type="button" style="margin-top: 24px;">
        Fetch Models
      </button>
      <span id="shared-status-text" style="font-weight: bold; margin-left: 10px; margin-top: 24px;"></span>
    </div>
  `;

  const apiKeyInput = document.getElementById(
    'shared-api-key',
  ) as HTMLInputElement;
  const modelInput = document.getElementById(
    'shared-model-input',
  ) as HTMLInputElement;
  const modelsList = document.getElementById(
    'shared-models-list',
  ) as HTMLDataListElement;
  const fetchModelsBtn = document.getElementById(
    'shared-fetch-models-btn',
  ) as HTMLButtonElement;
  const statusText = document.getElementById(
    'shared-status-text',
  ) as HTMLSpanElement;

  if (
    !apiKeyInput ||
    !modelInput ||
    !modelsList ||
    !fetchModelsBtn ||
    !statusText
  ) {
    throw new Error('Failed to create shared LLM settings HTML elements');
  }

  // Load initial state
  apiKeyInput.value = core.apiKey;
  modelInput.value = core.model;

  const notifyChange = () => {
    core.apiKey = apiKeyInput.value;
    core.model = modelInput.value;
    core.saveState();
  };

  apiKeyInput.addEventListener('input', notifyChange);
  modelInput.addEventListener('input', notifyChange);

  fetchModelsBtn.addEventListener('click', async () => {
    statusText.textContent = '';
    if (!core.apiKey) {
      statusText.textContent = 'Please enter an OpenRouter API Key first.';
      statusText.style.color = 'red';
      return;
    }

    fetchModelsBtn.disabled = true;
    fetchModelsBtn.textContent = 'Fetching...';

    try {
      const models = await core.fetchModels();
      modelsList.innerHTML = '';

      for (const m of models) {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        modelsList.appendChild(option);
      }

      statusText.textContent = `Fetched ${models.length} models successfully.`;
      statusText.style.color = 'green';
    } catch (e: any) {
      statusText.textContent = `Error fetching models: ${e.message}`;
      statusText.style.color = 'red';
    } finally {
      fetchModelsBtn.disabled = false;
      fetchModelsBtn.textContent = 'Fetch Models';
    }
  });
}
