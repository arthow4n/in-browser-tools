import { getRequiredElement } from '../shared/dom-utils.js';
import { TextAdventureCore } from './core.js';
import { ChatMessage } from '../llm-chat/core.js';

const core = new TextAdventureCore();

const apiKeyInput = getRequiredElement('shared-api-key', HTMLInputElement);
const modelInput = getRequiredElement('shared-model-input', HTMLInputElement);
const fetchModelsBtn = getRequiredElement(
  'fetch-models-btn',
  HTMLButtonElement,
);
const modelsList = getRequiredElement('shared-models-list', HTMLUListElement);

const characterNameInput = getRequiredElement(
  'character-name',
  HTMLInputElement,
);
const characterDescriptionInput = getRequiredElement(
  'character-description',
  HTMLTextAreaElement,
);

const historyContainer = getRequiredElement(
  'history-container',
  HTMLDivElement,
);
const userInput = getRequiredElement('user-input', HTMLTextAreaElement);
const storyDirectionInput = getRequiredElement(
  'story-direction',
  HTMLTextAreaElement,
);
const sendBtn = getRequiredElement('send-btn', HTMLButtonElement);
const chatStatus = getRequiredElement('chat-status', HTMLSpanElement);
const clearHistoryBtn = getRequiredElement(
  'clear-history-btn',
  HTMLButtonElement,
);

function init() {
  apiKeyInput.value = core.apiKey;
  modelInput.value = core.model;
  characterNameInput.value = core.characterName;
  characterDescriptionInput.value = core.characterDescription;

  apiKeyInput.addEventListener('change', (e) => {
    if (e.currentTarget instanceof HTMLInputElement) {
      core.apiKey = e.currentTarget.value;
      core.saveState();
    }
  });

  modelInput.addEventListener('change', (e) => {
    if (e.currentTarget instanceof HTMLInputElement) {
      core.model = e.currentTarget.value;
      core.saveState();
    }
  });

  characterNameInput.addEventListener('input', (e) => {
    if (e.currentTarget instanceof HTMLInputElement) {
      core.characterName = e.currentTarget.value;
      core.saveChatState();
    }
  });

  characterDescriptionInput.addEventListener('input', (e) => {
    if (e.currentTarget instanceof HTMLTextAreaElement) {
      core.characterDescription = e.currentTarget.value;
      core.saveChatState();
    }
  });

  fetchModelsBtn.addEventListener('click', async () => {
    try {
      fetchModelsBtn.disabled = true;
      fetchModelsBtn.textContent = 'Fetching...';
      const models = await core.fetchModels();
      modelsList.innerHTML = '';
      modelsList.style.display = 'block';

      for (const m of models) {
        const li = document.createElement('li');
        li.textContent = m.id;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          modelInput.value = m.id;
          core.model = m.id;
          core.saveState();
          modelsList.style.display = 'none';
        });
        modelsList.appendChild(li);
      }
    } catch (err: any) {
      chatStatus.textContent = 'Error fetching models: ' + err.message;
      chatStatus.style.color = 'red';
    } finally {
      fetchModelsBtn.disabled = false;
      fetchModelsBtn.textContent = 'Fetch Models';
    }
  });

  sendBtn.addEventListener('click', handleSend);
  clearHistoryBtn.addEventListener('click', () => {
    core.history = [];
    core.saveChatState();
    renderHistory();
  });

  renderHistory();
}

function renderHistory() {
  historyContainer.innerHTML = '';
  for (const msg of core.history) {
    if (msg.role === 'user') {
      const div = document.createElement('div');
      div.className = 'message user';
      div.textContent = msg.content;
      historyContainer.appendChild(div);
    } else if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.function.name === 'speak') {
          try {
            const args = JSON.parse(tc.function.arguments);
            const div = document.createElement('div');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'character-name';
            nameSpan.textContent = args.character;
            div.appendChild(nameSpan);

            const msgNode = document.createTextNode(args.message);
            div.appendChild(msgNode);

            if (args.character.toLowerCase() === 'narrator') {
              div.className = 'message narrator';
            } else {
              div.className = 'message character';
            }

            historyContainer.appendChild(div);
          } catch (e) {
            // Arguments might be incomplete while streaming, or invalid JSON.
          }
        }
      }
    }
  }
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

async function handleSend() {
  const userText = userInput.value.trim();
  const directionText = storyDirectionInput.value.trim();

  if (!userText && !directionText) return;

  if (!core.characterName) {
    chatStatus.textContent = 'Please enter your character name.';
    chatStatus.style.color = 'red';
    return;
  }

  let finalContent = `[${core.characterName}]: ${userText}`;
  if (directionText) {
    finalContent += `\n\n[OOC - Story Direction]: ${directionText}`;
  }

  const newMessages: ChatMessage[] = [];

  if (core.characterDescription) {
    newMessages.push({
      id: Date.now().toString() + '-sys',
      role: 'system',
      content: `[OOC - Character Update]: The user is playing as ${core.characterName}. Description: ${core.characterDescription}`,
    });
  }

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: finalContent,
  };
  newMessages.push(userMessage);

  core.history.push(...newMessages);
  core.saveChatState();
  renderHistory();

  userInput.value = '';
  storyDirectionInput.value = '';
  chatStatus.textContent = 'Generating...';
  chatStatus.style.color = 'black';
  sendBtn.disabled = true;

  try {
    let assistantMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      tool_calls: [],
    };

    // Create a temporary element for streaming tool calls
    const streamContainer = document.createElement('div');
    streamContainer.className = 'streaming';
    historyContainer.appendChild(streamContainer);

    // We pass empty array for newMessages because we already pushed to core.history
    const generator = core.streamChatCompletionWithTools([]);

    for await (const chunk of generator) {
      if (chunk.type === 'text' && chunk.text) {
        assistantMessage.content += chunk.text;
      } else if (chunk.type === 'tool_call' && chunk.toolCall) {
        let tc = assistantMessage.tool_calls?.find(
          (t) => t.id === chunk.toolCall!.id,
        );
        if (!tc) {
          tc = {
            id: chunk.toolCall.id,
            type: 'function',
            function: {
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments,
            },
          };
          assistantMessage.tool_calls?.push(tc);
        } else {
          tc.function.arguments = chunk.toolCall.arguments;
        }

        // Try to parse and render partially
        if (tc.function.name === 'speak') {
          try {
            const args = JSON.parse(tc.function.arguments);
            streamContainer.innerHTML = '';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'character-name';
            nameSpan.textContent = args.character || '...';
            streamContainer.appendChild(nameSpan);

            const msgNode = document.createTextNode(args.message || '...');
            streamContainer.appendChild(msgNode);

            if (args.character?.toLowerCase() === 'narrator') {
              streamContainer.className = 'message narrator streaming';
            } else {
              streamContainer.className = 'message character streaming';
            }
          } catch (e) {
            // Still streaming invalid JSON
          }
        }
      }
      historyContainer.scrollTop = historyContainer.scrollHeight;
    }

    core.history.push(assistantMessage);

    // If tool calls were made, we need to push the tool results to history
    // so the LLM knows they were successful, and then maybe let it continue or stop.
    // For text adventure, normally one response with tool calls is enough, but we must satisfy API requirements.
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const tc of assistantMessage.tool_calls) {
        core.history.push({
          id: Date.now().toString() + '-tool-' + tc.id,
          role: 'tool',
          content: JSON.stringify({ success: true }),
          tool_call_id: tc.id,
        });
      }
    }

    core.saveChatState();
    renderHistory();
    chatStatus.textContent = '';
  } catch (err: any) {
    console.error(err);
    chatStatus.textContent = 'Error: ' + err.message;
    chatStatus.style.color = 'red';
  } finally {
    sendBtn.disabled = false;
  }
}

init();
