import { LLMCore } from '../shared/llm-core.js';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';
import { clearAllSettings, clearToolSettings } from '../shared/storage.js';

const core = new LLMCore();

const apiKeyInput = getRequiredElement('shared-api-key', HTMLInputElement);
const modelInput = getRequiredElement('shared-model-input', HTMLInputElement);
const modelsList = getRequiredElement('shared-models-list', HTMLUListElement);
const fetchModelsBtn = getRequiredElement('shared-fetch-models-btn', HTMLButtonElement);
const statusText = getRequiredElement('shared-status-text', HTMLSpanElement);

const providerOrderInput = getRequiredElement('provider-order', HTMLInputElement);
const providerDataCollectionSelect = getRequiredElement('provider-data-collection', HTMLSelectElement);
const providerAllowFallbacksCheckbox = getRequiredElement('provider-allow-fallbacks', HTMLInputElement);
const providerZdrCheckbox = getRequiredElement('provider-zdr', HTMLInputElement);

const resetToolSettingsBtn = getRequiredElement('reset-tool-settings-btn', HTMLButtonElement);
const resetAllSettingsBtn = getRequiredElement('reset-all-settings-btn', HTMLButtonElement);
const resetStatus = getRequiredElement('reset-status', HTMLSpanElement);

// Load initial state
apiKeyInput.value = core.apiKey;
modelInput.value = core.model;
providerOrderInput.value = core.providerPrefs.order.join(', ');
providerDataCollectionSelect.value = core.providerPrefs.dataCollection;
providerAllowFallbacksCheckbox.checked = core.providerPrefs.allowFallbacks;
providerZdrCheckbox.checked = core.providerPrefs.zdr;

const notifyChange = () => {
  core.apiKey = apiKeyInput.value.trim();
  core.model = modelInput.value.trim();

  const orderStr = providerOrderInput.value.trim();
  core.providerPrefs.order = orderStr ? orderStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  core.providerPrefs.dataCollection = providerDataCollectionSelect.value as 'allow' | 'deny';
  core.providerPrefs.allowFallbacks = providerAllowFallbacksCheckbox.checked;
  core.providerPrefs.zdr = providerZdrCheckbox.checked;

  core.saveState();

  resetStatus.textContent = 'Settings saved.';
  resetStatus.style.color = 'green';
  setTimeout(() => { resetStatus.textContent = ''; }, 2000);
};

apiKeyInput.addEventListener('input', notifyChange);
modelInput.addEventListener('input', notifyChange);
providerOrderInput.addEventListener('input', notifyChange);
providerDataCollectionSelect.addEventListener('change', notifyChange);
providerAllowFallbacksCheckbox.addEventListener('change', notifyChange);
providerZdrCheckbox.addEventListener('change', notifyChange);


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
  if (successMessage && !statusText.textContent) {
    statusText.textContent = successMessage;
    statusText.style.color = 'green';
    setTimeout(() => { statusText.textContent = ''; }, 3000);
  }
});

resetToolSettingsBtn.addEventListener('click', () => {
  clearToolSettings();
  resetStatus.textContent = 'Tool settings reset (OpenRouter settings preserved).';
  resetStatus.style.color = 'green';
  setTimeout(() => { resetStatus.textContent = ''; }, 3000);
});

resetAllSettingsBtn.addEventListener('click', () => {
  clearAllSettings();

  // Reload core state to reflect cleared state
  core.loadState();
  apiKeyInput.value = core.apiKey;
  modelInput.value = core.model;
  providerOrderInput.value = core.providerPrefs.order.join(', ');
  providerDataCollectionSelect.value = core.providerPrefs.dataCollection;
  providerAllowFallbacksCheckbox.checked = core.providerPrefs.allowFallbacks;
  providerZdrCheckbox.checked = core.providerPrefs.zdr;

  resetStatus.textContent = 'All settings reset to defaults.';
  resetStatus.style.color = 'green';
  setTimeout(() => { resetStatus.textContent = ''; }, 3000);
});
