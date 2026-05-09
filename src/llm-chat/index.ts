import { ChatCore, ChatMessage } from './core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { browserAlertTool } from './tools/browser-alert.js';
import { getRequiredElement } from '../shared/dom-utils.js';

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

enableToolsCheckbox.checked = core.toolsEnabled;
enableToolsCheckbox.addEventListener('change', () => {
  core.toolsEnabled = enableToolsCheckbox.checked;
});

// --- Initialization ---
function init() {
  setupLLMSettings(llmSettingsContainer, core);

  systemPromptTextarea.value = core.systemPrompt;
  renderSavedPrompts();
  renderHistory();
}

// --- System Prompt Events ---
systemPromptTextarea.addEventListener('input', () => {
  core.systemPrompt = systemPromptTextarea.value;
  core.saveChatState();
});

improvePromptBtn.addEventListener('click', async () => {
  improvePromptStatus.textContent = '';
  if (!core.apiKey || !core.model) {
    improvePromptStatus.textContent =
      'API Key and Model are required to improve prompt.';
    improvePromptStatus.style.color = 'red';
    return;
  }
  improvePromptBtn.disabled = true;
  improvePromptBtn.textContent = 'Improving...';
  try {
    const intention = promptIntentionTextarea.value.trim();
    const howToImprove = promptHowToImproveTextarea.value.trim();
    const evaluationFocus = promptEvaluationFocusTextarea.value.trim();

    const improved = await core.improveSystemPrompt(intention, howToImprove, evaluationFocus);
    systemPromptTextarea.value = improved;
    core.systemPrompt = improved;
    core.saveChatState();
  } catch (e: any) {
    improvePromptStatus.textContent = `Error: ${e.message}`;
    improvePromptStatus.style.color = 'red';
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
function createMessageElement(msg: ChatMessage): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  if (msg.id) {
    div.dataset.id = msg.id;
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  let displayContent = msg.content;

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    displayContent += '\n\n**Tool Calls:**\n';
    for (const tc of msg.tool_calls) {
      displayContent += `- ${tc.function.name}(${tc.function.arguments})\n`;
    }
  }

  contentDiv.textContent = displayContent;

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
      core.saveChatState();
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this message?')) {
      core.history = core.history.filter((m) => m.id !== msg.id);
      core.saveChatState();
      renderHistory();
    }
  });

  deleteBelowBtn.addEventListener('click', () => {
    if (confirm('Delete this message and all messages below it?')) {
      const idx = core.history.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        core.history = core.history.slice(0, idx);
        core.saveChatState();
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
    core.saveChatState();
    renderHistory();
  }
});

sendBtn.addEventListener('click', async () => {
  chatStatus.textContent = '';
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
  const assistantEl = createMessageElement(assistantMsg);
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
        const nextAssistantEl = createMessageElement(nextAssistantMsg);
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
