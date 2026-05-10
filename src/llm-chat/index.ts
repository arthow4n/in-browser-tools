import { ChatCore, ChatMessage } from './core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { createMessageElement } from '../shared/chat-ui.js';
import { browserAlertTool } from './tools/browser-alert.js';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';

const core = new ChatCore();
core.registerTool(browserAlertTool);

// --- DOM Elements ---
const llmSettingsContainer = getRequiredElement(
  'llm-settings-container',
  HTMLDivElement,
);
const systemPromptTextarea = getRequiredElement(
  'system-prompt',
  HTMLTextAreaElement,
);
const improvePromptBtn = getRequiredElement(
  'improve-prompt-btn',
  HTMLButtonElement,
);
const improvePromptStatus = getRequiredElement(
  'improve-prompt-status',
  HTMLSpanElement,
);
const promptIntentionTextarea = getRequiredElement(
  'prompt-intention',
  HTMLTextAreaElement,
);
const promptHowToImproveTextarea = getRequiredElement(
  'prompt-how-to-improve',
  HTMLTextAreaElement,
);
const promptEvaluationFocusTextarea = getRequiredElement(
  'prompt-evaluation-focus',
  HTMLTextAreaElement,
);
const savePromptBtn = getRequiredElement('save-prompt-btn', HTMLButtonElement);
const savedPromptsSelect = getRequiredElement(
  'saved-prompts-select',
  HTMLSelectElement,
);
const deletePromptBtn = getRequiredElement(
  'delete-prompt-btn',
  HTMLButtonElement,
);

const historyContainer = getRequiredElement(
  'history-container',
  HTMLDivElement,
);
const userInputTextarea = getRequiredElement('user-input', HTMLTextAreaElement);
const sendBtn = getRequiredElement('send-btn', HTMLButtonElement);
const clearHistoryBtn = getRequiredElement(
  'clear-history-btn',
  HTMLButtonElement,
);
const chatStatus = getRequiredElement('chat-status', HTMLSpanElement);
const enableToolsCheckbox = getRequiredElement(
  'enable-tools-checkbox',
  HTMLInputElement,
);
const toolListContainer = getRequiredElement(
  'tool-list-container',
  HTMLDivElement,
);

enableToolsCheckbox.checked = core.toolsEnabled;

function renderToolList() {
  toolListContainer.innerHTML = '';

  for (const tool of core.tools) {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '5px';
    label.style.fontWeight = 'normal';
    label.style.fontSize = '0.9em';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = core.isToolEnabled(tool.name);

    checkbox.addEventListener('change', () => {
      core.setToolEnabled(tool.name, checkbox.checked);
      core.saveChatState();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(`${tool.name}: ${tool.description}`));
    toolListContainer.appendChild(label);
  }
}

enableToolsCheckbox.addEventListener('change', () => {
  core.toolsEnabled = enableToolsCheckbox.checked;
  toolListContainer.style.display = core.toolsEnabled ? 'flex' : 'none';
  core.saveChatState();
});

// --- Initialization ---
function init() {
  setupLLMSettings(llmSettingsContainer, core);

  systemPromptTextarea.value = core.systemPrompt;
  renderSavedPrompts();
  renderHistory();
  renderToolList();
  toolListContainer.style.display = core.toolsEnabled ? 'flex' : 'none';
}

// --- System Prompt Events ---
systemPromptTextarea.addEventListener('input', () => {
  core.systemPrompt = systemPromptTextarea.value;
  core.saveChatState();
});

improvePromptBtn.addEventListener('click', async () => {
  if (!core.apiKey || !core.model) {
    improvePromptStatus.textContent =
      'API Key and Model are required to improve prompt.';
    improvePromptStatus.style.color = 'red';
    return;
  }

  await runWithUIState(
    improvePromptBtn,
    improvePromptStatus,
    'Improving...',
    async () => {
      const intention = promptIntentionTextarea.value.trim();
      const howToImprove = promptHowToImproveTextarea.value.trim();
      const evaluationFocus = promptEvaluationFocusTextarea.value.trim();

      const improved = await core.improveSystemPrompt(
        intention,
        howToImprove,
        evaluationFocus,
      );
      systemPromptTextarea.value = improved;
      core.systemPrompt = improved;
      core.saveChatState();
    },
  );
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
  core.saveChatState();
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
    core.saveChatState();
  }
});

deletePromptBtn.addEventListener('click', () => {
  const id = savedPromptsSelect.value;
  if (!id) return;
  if (confirm('Delete this saved prompt?')) {
    core.savedPrompts = core.savedPrompts.filter((p) => p.id !== id);
    core.saveChatState();
    savedPromptsSelect.value = '';
    renderSavedPrompts();
  }
});

// --- Chat Events ---

function renderHistory() {
  historyContainer.innerHTML = '';
  for (const msg of core.history) {
    historyContainer.appendChild(createMessageElement(msg, core, renderHistory));
  }
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear entire chat history?')) {
    core.history = [];
    core.saveChatState();
    renderHistory();
  }
});

sendBtn.addEventListener('click', async () => {
  const text = userInputTextarea.value.trim();
  if (!text && core.history.length === 0) return;

  if (!core.apiKey || !core.model) {
    chatStatus.textContent = 'API Key and Model are required.';
    chatStatus.style.color = 'red';
    return;
  }

  if (text) {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    core.history.push(userMsg);
    core.saveChatState();
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
  const assistantEl = createMessageElement(assistantMsg, core, renderHistory);
  assistantEl.classList.add('streaming');
  historyContainer.appendChild(assistantEl);
  const contentDiv = assistantEl.querySelector('.content');
  if (!(contentDiv instanceof HTMLDivElement)) {
    throw new Error('Content div not found in assistant message element');
  }

  const doStream = async (
    currentAssistantMsg: ChatMessage,
    currentAssistantEl: HTMLDivElement,
    currentContentDiv: HTMLDivElement,
  ) => {
    try {
      const generator = core.streamChatCompletionWithTools([]);
      for await (const chunk of generator) {
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

        // Re-render the content text to show ongoing chunks and tool calls
        let displayContent = currentAssistantMsg.content;
        if (
          currentAssistantMsg.tool_calls &&
          currentAssistantMsg.tool_calls.length > 0
        ) {
          displayContent += '\n\n**Tool Calls:**\n';
          for (const tc of currentAssistantMsg.tool_calls) {
            displayContent += `- ${tc.function.name}(${tc.function.arguments})\n`;
          }
        }
        currentContentDiv.textContent = displayContent;
        historyContainer.scrollTop = historyContainer.scrollHeight;
      }
    } catch (e: any) {
      chatStatus.textContent = `Chat Error: ${e.message}`;
      chatStatus.style.color = 'red';
      currentAssistantMsg.content += `\n[Error: ${e.message}]`;
      currentContentDiv.textContent = currentAssistantMsg.content;
    } finally {
      currentAssistantEl.classList.remove('streaming');
      if (
        currentAssistantMsg.content ||
        (currentAssistantMsg.tool_calls &&
          currentAssistantMsg.tool_calls.length > 0)
      ) {
        core.history.push(currentAssistantMsg);
      }
      core.saveChatState();
      renderHistory();

      // If there were tool calls, execute them and trigger follow up
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
              const result = await tool.execute(args);
              resultStr =
                typeof result === 'string' ? result : JSON.stringify(result);
            } catch (e: any) {
              resultStr = `Error executing tool: ${e.message}`;
            }
          }

          const toolMsg: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(),
            role: 'tool',
            content: resultStr,
            tool_call_id: tc.id,
          };
          core.history.push(toolMsg);
          core.saveChatState();
          renderHistory();
        }

        // Recursively call for follow up, creating a new assistant message
        const nextAssistantMsg: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: '',
        };
        const nextAssistantEl = createMessageElement(nextAssistantMsg, core, renderHistory);
        nextAssistantEl.classList.add('streaming');
        historyContainer.appendChild(nextAssistantEl);
        const nextContentDiv = nextAssistantEl.querySelector('.content');
        if (!(nextContentDiv instanceof HTMLDivElement)) {
          throw new Error(
            'Content div not found in next assistant message element',
          );
        }

        await doStream(nextAssistantMsg, nextAssistantEl, nextContentDiv);
      } else {
        sendBtn.disabled = false;
      }
    }
  };

  await doStream(assistantMsg, assistantEl, contentDiv);
});

// Run init
init();
