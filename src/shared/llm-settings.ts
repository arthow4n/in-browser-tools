export interface LLMSettings {
  apiKey: string;
  model: string;
}

export interface Model {
  id: string;
  name: string;
}

export function setupLLMSettings(
  container: HTMLElement,
  onChange: (settings: LLMSettings) => void,
) {
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

  if (!apiKeyInput || !modelInput || !modelsList || !fetchModelsBtn) {
    throw new Error('Failed to create shared LLM settings HTML elements');
  }

  // Load initial state
  apiKeyInput.value = localStorage.getItem('shared-openrouter-apiKey') || '';
  modelInput.value =
    localStorage.getItem('shared-openrouter-model') ||
    'google/gemini-2.5-flash';

  const notifyChange = () => {
    localStorage.setItem('shared-openrouter-apiKey', apiKeyInput.value);
    localStorage.setItem('shared-openrouter-model', modelInput.value);
    onChange({
      apiKey: apiKeyInput.value,
      model: modelInput.value,
    });
  };

  // Initial notification
  notifyChange();

  apiKeyInput.addEventListener('input', notifyChange);
  modelInput.addEventListener('input', notifyChange);

  fetchModelsBtn.addEventListener('click', async () => {
    const currentApiKey = apiKeyInput.value;
    if (!currentApiKey) {
      alert('Please enter an OpenRouter API Key first.');
      return;
    }

    fetchModelsBtn.disabled = true;
    fetchModelsBtn.textContent = 'Fetching...';

    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${currentApiKey}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch models');

      const data = await res.json();
      modelsList.innerHTML = '';

      for (const m of data.data) {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.name;
        modelsList.appendChild(option);
      }

      alert(`Fetched ${data.data.length} models successfully.`);
    } catch (e: any) {
      alert(`Error fetching models: ${e.message}`);
    } finally {
      fetchModelsBtn.disabled = false;
      fetchModelsBtn.textContent = 'Fetch Models';
    }
  });
}
