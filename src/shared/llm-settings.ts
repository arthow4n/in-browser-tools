import { LLMCore } from './llm-core.js';
import { getRequiredElement } from './dom-utils.js';
import { runWithUIState } from './ui-utils.js';

export function setupLLMSettings(container: HTMLElement, core: LLMCore) {
  // Setup HTML structure
  container.innerHTML = `
    <label for="shared-api-key">OpenRouter API Key:</label>
    <input type="password" id="shared-api-key" placeholder="sk-or-v1-..." />

    <style>
      .custom-dropdown-container {
        position: relative;
        width: 100%;
      }
      .custom-dropdown-list {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 200px;
        overflow-y: auto;
        background: white;
        border: 1px solid #ccc;
        z-index: 1000;
        display: none;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .custom-dropdown-list li {
        padding: 8px;
        cursor: pointer;
      }
      .custom-dropdown-list li:hover {
        background-color: #f0f0f0;
      }
    </style>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px;">
      <div style="flex-grow: 1;" class="custom-dropdown-container">
        <label for="shared-model-input">Model:</label>
        <input
          type="text"
          id="shared-model-input"
          autocomplete="off"
          placeholder="Select or type model ID..."
        />
        <ul id="shared-models-list" class="custom-dropdown-list"></ul>
      </div>
      <button id="shared-fetch-models-btn" type="button" style="margin-top: 24px;">
        Fetch Models
      </button>
      <span id="shared-status-text" style="font-weight: bold; margin-left: 10px; margin-top: 24px;"></span>
    </div>
  `;

  const apiKeyInput = getRequiredElement('shared-api-key', HTMLInputElement);
  const modelInput = getRequiredElement('shared-model-input', HTMLInputElement);
  const modelsList = getRequiredElement('shared-models-list', HTMLUListElement);
  const fetchModelsBtn = getRequiredElement(
    'shared-fetch-models-btn',
    HTMLButtonElement,
  );
  const statusText = getRequiredElement('shared-status-text', HTMLSpanElement);

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

  let availableModels: { id: string; name: string }[] = [];

  const renderDropdown = () => {
    const filterText = modelInput.value.toLowerCase();
    modelsList.innerHTML = '';
    const filtered = availableModels.filter(
      (m) =>
        m.id.toLowerCase().includes(filterText) ||
        m.name.toLowerCase().includes(filterText),
    );

    if (filtered.length > 0) {
      modelsList.style.display = 'block';
      filtered.forEach((m) => {
        const li = document.createElement('li');
        li.textContent = `${m.name} (${m.id})`;
        li.addEventListener('mousedown', (e) => {
          e.preventDefault(); // Prevent blur from firing before click
          modelInput.value = m.id;
          notifyChange();
          modelsList.style.display = 'none';
        });
        modelsList.appendChild(li);
      });
    } else {
      modelsList.style.display = 'none';
    }
  };

  modelInput.addEventListener('focus', renderDropdown);
  modelInput.addEventListener('input', renderDropdown);
  modelInput.addEventListener('blur', () => {
    modelsList.style.display = 'none';
  });

  fetchModelsBtn.addEventListener('click', async () => {
    if (!core.apiKey) {
      statusText.textContent = 'Please enter an OpenRouter API Key first.';
      statusText.style.color = 'red';
      return;
    }

    let successMessage = '';
    await runWithUIState(
      fetchModelsBtn,
      statusText,
      'Fetching...',
      async () => {
        const models = await core.fetchModels();
        availableModels = models;
        modelsList.innerHTML = '';
        renderDropdown();
        successMessage = `Fetched ${models.length} models successfully.`;
      },
      undefined,
    );
    // runWithUIState has cleared or set error.
    if (successMessage && !statusText.textContent) {
      statusText.textContent = successMessage;
      statusText.style.color = 'green';
    }
  });
}
