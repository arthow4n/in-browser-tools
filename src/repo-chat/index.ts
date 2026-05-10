import { RepoChatCore } from './core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';
import { ChatMessage } from '../llm-chat/core.js';
import { createMessageElement } from '../shared/chat-ui.js';

const core = new RepoChatCore();

// --- DOM Elements ---
const llmSettingsContainer = getRequiredElement(
  'llm-settings-container',
  HTMLDivElement,
);
const repoUrlInput = getRequiredElement('repo-url', HTMLInputElement);
const cloneBtn = getRequiredElement('clone-btn', HTMLButtonElement);
const cloneStatus = getRequiredElement('clone-status', HTMLSpanElement);

const historyContainer = getRequiredElement(
  'history-container',
  HTMLDivElement,
);

const chatInput = getRequiredElement('chat-input', HTMLTextAreaElement);
const sendBtn = getRequiredElement('send-btn', HTMLButtonElement);
const chatStatus = getRequiredElement('chat-status', HTMLSpanElement);

// Setup LLM Settings UI
setupLLMSettings(llmSettingsContainer, core);

// Render history
function renderHistory() {
  historyContainer.innerHTML = '';
  for (const msg of core.history) {
    historyContainer.appendChild(createMessageElement(msg, core, renderHistory));
  }
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

// Clone logic
cloneBtn.addEventListener('click', async () => {
  const url = repoUrlInput.value.trim();
  if (!url) {
    alert('Please enter a repository URL');
    return;
  }

  await runWithUIState(
    cloneBtn,
    cloneStatus,
    'Cloning...',
    async () => {
      await core.cloneRepo(url, (msg) => {
        cloneStatus.textContent = msg;
      });
      cloneStatus.textContent = 'Seeding repo data to chat...';
      await core.seedChatHistory();
      renderHistory();
    },
    'Cloned and seeded successfully.'
  );
});

// Chat logic
sendBtn.addEventListener('click', async () => {
  const userText = chatInput.value.trim();
  if (!userText) return;

  const userMsg: ChatMessage = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: userText,
  };

  core.history.push(userMsg);
  chatInput.value = '';
  renderHistory();

  await handleChatGeneration();
});

async function handleChatGeneration() {
  await runWithUIState(
    sendBtn,
    chatStatus,
    'Generating...',
    async () => {
      let currentAssistantMsg: ChatMessage | null = null;
      let currentContentDiv: HTMLDivElement | null = null;
      let currentAssistantEl: HTMLDivElement | null = null;

      const generator = core.streamChatCompletion([]);

      while (true) {
        const { value: textChunk, done } = await generator.next();
        if (done) break;

        if (!currentAssistantMsg) {
          currentAssistantMsg = {
            id: 'msg_' + Date.now(),
            role: 'assistant',
            content: '',
          };
          core.history.push(currentAssistantMsg);
          currentAssistantEl = createMessageElement(currentAssistantMsg, core, renderHistory);
          currentAssistantEl.classList.add('streaming');
          historyContainer.appendChild(currentAssistantEl);
          currentContentDiv = currentAssistantEl.querySelector('.content') as HTMLDivElement;
        }

        if (textChunk) {
          currentAssistantMsg.content += textChunk;
        }

        // Re-render the content text to show ongoing chunks
        if (currentContentDiv) {
          currentContentDiv.textContent = currentAssistantMsg.content;
        }
        historyContainer.scrollTop = historyContainer.scrollHeight;
      }

      if (currentAssistantEl) {
        currentAssistantEl.classList.remove('streaming');
      }
    },
    ''
  );
}
