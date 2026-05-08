import { ChatCore, ChatMessage } from './core.js';

const core = new ChatCore();

// --- DOM Elements ---
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const modelInput = document.getElementById('model-input') as HTMLInputElement;
const modelsList = document.getElementById(
  'models-list',
) as HTMLDataListElement;
const fetchModelsBtn = document.getElementById(
  'fetch-models-btn',
) as HTMLButtonElement;

const systemPromptTextarea = document.getElementById(
  'system-prompt',
) as HTMLTextAreaElement;
const improvePromptBtn = document.getElementById(
  'improve-prompt-btn',
) as HTMLButtonElement;
const savePromptBtn = document.getElementById(
  'save-prompt-btn',
) as HTMLButtonElement;
const savedPromptsSelect = document.getElementById(
  'saved-prompts-select',
) as HTMLSelectElement;
const deletePromptBtn = document.getElementById(
  'delete-prompt-btn',
) as HTMLButtonElement;

const historyContainer = document.getElementById(
  'history-container',
) as HTMLDivElement;
const userInputTextarea = document.getElementById(
  'user-input',
) as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const clearHistoryBtn = document.getElementById(
  'clear-history-btn',
) as HTMLButtonElement;

if (
  !apiKeyInput ||
  !modelInput ||
  !modelsList ||
  !fetchModelsBtn ||
  !systemPromptTextarea ||
  !improvePromptBtn ||
  !savePromptBtn ||
  !savedPromptsSelect ||
  !deletePromptBtn ||
  !historyContainer ||
  !userInputTextarea ||
  !sendBtn ||
  !clearHistoryBtn
) {
  throw new Error('Required DOM elements missing');
}

// --- Initialization ---
function init() {
  apiKeyInput.value = core.apiKey;
  modelInput.value = core.model;
  systemPromptTextarea.value = core.systemPrompt;
  renderSavedPrompts();
  renderHistory();
}

// --- Settings Events ---
apiKeyInput.addEventListener('input', () => {
  core.apiKey = apiKeyInput.value;
  core.saveState();
});

modelInput.addEventListener('input', () => {
  core.model = modelInput.value;
  core.saveState();
});

fetchModelsBtn.addEventListener('click', async () => {
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
    alert(`Fetched ${models.length} models successfully.`);
  } catch (e: any) {
    alert(`Error fetching models: ${e.message}`);
  } finally {
    fetchModelsBtn.disabled = false;
    fetchModelsBtn.textContent = 'Fetch Models';
  }
});

// --- System Prompt Events ---
systemPromptTextarea.addEventListener('input', () => {
  core.systemPrompt = systemPromptTextarea.value;
  core.saveState();
});

improvePromptBtn.addEventListener('click', async () => {
  if (!core.apiKey || !core.model) {
    alert('API Key and Model are required to improve prompt.');
    return;
  }
  improvePromptBtn.disabled = true;
  improvePromptBtn.textContent = 'Improving...';
  try {
    const improved = await core.improveSystemPrompt();
    systemPromptTextarea.value = improved;
    core.systemPrompt = improved;
    core.saveState();
  } catch (e: any) {
    alert(`Error: ${e.message}`);
  } finally {
    improvePromptBtn.disabled = false;
    improvePromptBtn.textContent = 'Improve Prompt with LLM';
  }
});

function renderSavedPrompts() {
  // Clear options except first
  while (savedPromptsSelect.options.length > 1) {
    savedPromptsSelect.remove(1);
  }
  for (const sp of core.savedPrompts) {
    const option = document.createElement('option');
    option.value = sp.id;
    option.textContent = sp.name;
    savedPromptsSelect.appendChild(option);
  }
  deletePromptBtn.style.display = savedPromptsSelect.value
    ? 'inline-block'
    : 'none';
}

savePromptBtn.addEventListener('click', () => {
  const name = prompt('Enter a name for this system prompt:');
  if (!name) return;
  const id = Date.now().toString();
  core.savedPrompts.push({ id, name, content: core.systemPrompt });
  core.saveState();
  renderSavedPrompts();
  savedPromptsSelect.value = id;
  deletePromptBtn.style.display = 'inline-block';
});

savedPromptsSelect.addEventListener('change', () => {
  const id = savedPromptsSelect.value;
  deletePromptBtn.style.display = id ? 'inline-block' : 'none';
  if (!id) return;
  const sp = core.savedPrompts.find((p) => p.id === id);
  if (sp) {
    systemPromptTextarea.value = sp.content;
    core.systemPrompt = sp.content;
    core.saveState();
  }
});

deletePromptBtn.addEventListener('click', () => {
  const id = savedPromptsSelect.value;
  if (!id) return;
  if (confirm('Delete this saved prompt?')) {
    core.savedPrompts = core.savedPrompts.filter((p) => p.id !== id);
    core.saveState();
    savedPromptsSelect.value = '';
    renderSavedPrompts();
  }
});

// --- Chat Events ---
function createMessageElement(msg: ChatMessage): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  div.dataset.id = msg.id;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.textContent = msg.content;

  const roleLabel = document.createElement('div');
  roleLabel.style.fontWeight = 'bold';
  roleLabel.style.marginBottom = '5px';
  roleLabel.style.textTransform = 'capitalize';
  roleLabel.textContent = msg.role;

  const controls = document.createElement('div');
  controls.className = 'message-controls';

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Edit';
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';

  const deleteBelowBtn = document.createElement('button');
  deleteBelowBtn.textContent = 'Delete ↓';

  controls.appendChild(editBtn);
  controls.appendChild(deleteBtn);
  controls.appendChild(deleteBelowBtn);

  div.appendChild(roleLabel);
  div.appendChild(contentDiv);
  div.appendChild(controls);

  // Edit logic
  let isEditing = false;
  let editTextarea: HTMLTextAreaElement;

  editBtn.addEventListener('click', () => {
    if (!isEditing) {
      isEditing = true;
      editBtn.textContent = 'Save';
      editTextarea = document.createElement('textarea');
      editTextarea.value = msg.content;
      editTextarea.rows = 4;
      editTextarea.style.width = '100%';
      div.replaceChild(editTextarea, contentDiv);
    } else {
      isEditing = false;
      editBtn.textContent = 'Edit';
      msg.content = editTextarea.value;
      contentDiv.textContent = msg.content;
      div.replaceChild(contentDiv, editTextarea);
      core.saveState();
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this message?')) {
      core.history = core.history.filter((m) => m.id !== msg.id);
      core.saveState();
      renderHistory();
    }
  });

  deleteBelowBtn.addEventListener('click', () => {
    if (confirm('Delete this message and all messages below it?')) {
      const idx = core.history.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        core.history = core.history.slice(0, idx);
        core.saveState();
        renderHistory();
      }
    }
  });

  return div;
}

function renderHistory() {
  historyContainer.innerHTML = '';
  for (const msg of core.history) {
    historyContainer.appendChild(createMessageElement(msg));
  }
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear entire chat history?')) {
    core.history = [];
    core.saveState();
    renderHistory();
  }
});

sendBtn.addEventListener('click', async () => {
  const text = userInputTextarea.value.trim();
  if (!text && core.history.length === 0) return;

  if (!core.apiKey || !core.model) {
    alert('API Key and Model are required.');
    return;
  }

  if (text) {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    core.history.push(userMsg);
    core.saveState();
    renderHistory();
    userInputTextarea.value = '';
  }

  sendBtn.disabled = true;

  // Create a placeholder for streaming assistant response
  const assistantMsg: ChatMessage = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
  };
  const assistantEl = createMessageElement(assistantMsg);
  assistantEl.classList.add('streaming');
  historyContainer.appendChild(assistantEl);
  const contentDiv = assistantEl.querySelector('.content') as HTMLDivElement;

  try {
    const generator = core.streamCompletion([]); // Pass empty newMessages as userMsg is already in history
    for await (const chunk of generator) {
      assistantMsg.content += chunk;
      contentDiv.textContent = assistantMsg.content;
      historyContainer.scrollTop = historyContainer.scrollHeight;
    }
  } catch (e: any) {
    alert(`Chat Error: ${e.message}`);
    assistantMsg.content += `\n[Error: ${e.message}]`;
    contentDiv.textContent = assistantMsg.content;
  } finally {
    assistantEl.classList.remove('streaming');
    core.history.push(assistantMsg);
    core.saveState();
    renderHistory(); // Re-render to ensure correct state and bindings
    sendBtn.disabled = false;
  }
});

// Run init
init();
