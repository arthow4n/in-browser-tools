import { RepoChatCore } from './core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';
import { ChatMessage } from '../llm-chat/core.js';
import { createMessageElement } from '../shared/chat-ui.js';
import { askQuestionTool } from '../shared/tools/ask-question.js';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import '../shared/components/styles.css';

const core = new RepoChatCore();
core.registerTool(askQuestionTool);

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

const restartChatBtn = getRequiredElement(
  'restart-chat-btn',
  HTMLButtonElement,
);
const clearAllBtn = getRequiredElement('clear-all-btn', HTMLButtonElement);

const enableToolsCheckbox = getRequiredElement('enable-tools-checkbox', HTMLInputElement);
const toolsContainer = getRequiredElement('tools-container', HTMLDivElement);
const askQuestionContainer = getRequiredElement('ask-question-container', HTMLDivElement);

const chatInput = getRequiredElement('chat-input', HTMLTextAreaElement);
const sendBtn = getRequiredElement('send-btn', HTMLButtonElement);
const chatStatus = getRequiredElement('chat-status', HTMLSpanElement);

// Setup LLM Settings UI
setupLLMSettings(llmSettingsContainer, core);

// Tools setup
enableToolsCheckbox.checked = core.toolsEnabled;
toolsContainer.style.display = core.toolsEnabled ? 'flex' : 'none';

enableToolsCheckbox.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked;
  core.toolsEnabled = checked;
  core.saveChatState();
  toolsContainer.style.display = checked ? 'flex' : 'none';
});

core.tools.forEach((tool) => {
  const label = document.createElement('label');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.gap = '5px';
  label.style.fontSize = '0.9em';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !core.disabledTools.has(tool.name);
  cb.addEventListener('change', (e) => {
    core.setToolEnabled(tool.name, (e.target as HTMLInputElement).checked);
    core.saveChatState();
  });

  const span = document.createElement('span');
  span.textContent = `${tool.name}: ${tool.description}`;

  label.appendChild(cb);
  label.appendChild(span);
  toolsContainer.appendChild(label);
});



// Render history
function renderHistory() {
  historyContainer.innerHTML = '';
  for (const msg of core.history) {
    historyContainer.appendChild(
      createMessageElement(msg, core, renderHistory),
    );
  }
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

// Initial load
renderHistory();

// Reset logic
restartChatBtn.addEventListener('click', () => {
  core.restartChat();
  renderHistory();
});

clearAllBtn.addEventListener('click', () => {
  core.clearAll();
  renderHistory();
  cloneStatus.textContent = '';
});

// Clone logic
cloneBtn.addEventListener('click', async () => {
  const url = repoUrlInput.value.trim();
  if (!url) {
    cloneStatus.textContent = 'Please enter a repository URL';
    cloneStatus.style.color = 'red';
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
      core.saveChatState();
      renderHistory();
    },
    'Cloned and seeded successfully.',
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
  core.saveChatState();
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

      const generator = core.streamChatCompletionWithTools([]);

      for await (const chunk of generator) {
        if (!currentAssistantMsg) {
          currentAssistantMsg = {
            id: 'msg_' + Date.now(),
            role: 'assistant',
            content: '',
          };
          core.history.push(currentAssistantMsg);
          currentAssistantEl = createMessageElement(
            currentAssistantMsg,
            core,
            renderHistory,
          );
          currentAssistantEl.classList.add('streaming');
          historyContainer.appendChild(currentAssistantEl);
          currentContentDiv = currentAssistantEl.querySelector(
            '.content',
          ) as HTMLDivElement;
        }

        if (chunk.type === 'text' && chunk.text) {
          currentAssistantMsg.content += chunk.text;
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          if (!currentAssistantMsg.tool_calls) {
            currentAssistantMsg.tool_calls = [];
          }
          currentAssistantMsg.tool_calls.push({
            id: chunk.toolCall.id,
            type: 'function',
            function: {
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments,
            },
          });
        }

        // Re-render the content text to show ongoing chunks (vanilla DOM)
        if (currentContentDiv && currentAssistantMsg) {
          let displayContent = currentAssistantMsg.content;
          if (currentAssistantMsg.tool_calls && currentAssistantMsg.tool_calls.length > 0) {
            displayContent += '\n\n**Tool Calls:**\n';
            for (const tc of currentAssistantMsg.tool_calls) {
              displayContent += `- ${tc.function.name}(${tc.function.arguments})\n`;
            }
          }
          currentContentDiv.textContent = displayContent;
        }
        historyContainer.scrollTop = historyContainer.scrollHeight;
      }

      if (currentAssistantEl) {
        currentAssistantEl.classList.remove('streaming');
      }

      if (currentAssistantMsg) {
        if (
          currentAssistantMsg.content ||
          (currentAssistantMsg.tool_calls &&
            currentAssistantMsg.tool_calls.length > 0)
        ) {
          // already pushed, just saving
        } else {
          // empty message, remove it
          core.history.pop();
          if (currentAssistantEl) {
             historyContainer.removeChild(currentAssistantEl);
          }
        }

        core.saveChatState();

        if (
          currentAssistantMsg.tool_calls &&
          currentAssistantMsg.tool_calls.length > 0
        ) {
          for (const tc of currentAssistantMsg.tool_calls) {
          const tool = core.tools.find((t) => t.name === tc.function.name);
          let resultStr = '';
          if (!tool) {
            resultStr = `Error: Tool ${tc.function.name} not found.`;
          } else {
            try {
              const args = JSON.parse(tc.function.arguments);
              const result = await tool.execute(args, { toolCallId: tc.id });
              resultStr =
                typeof result === 'string' ? result : JSON.stringify(result);
            } catch (e: any) {
              resultStr = `Error executing tool: ${e.message}`;
            }
          }

          const toolMsg: ChatMessage = {
            id: 'msg_tool_' + Date.now().toString() + Math.random().toString().slice(2, 8),
            role: 'tool',
            content: resultStr,
            tool_call_id: tc.id,
          };
            core.history.push(toolMsg);
            core.saveChatState();
            renderHistory();
          }

          // trigger next generation automatically
          await handleChatGeneration();
        }
      }
    },
    '',
  );
}
