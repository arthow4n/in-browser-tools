import { getRequiredElement } from '../shared/dom-utils.js';
import { TextAdventureCore } from './core.js';
import { ChatMessage } from '../llm-chat/core.js';
import { runWithUIState } from '../shared/ui-utils.js';

const core = new TextAdventureCore();

const apiKeyInput = getRequiredElement('shared-api-key', HTMLInputElement);
const modelInput = getRequiredElement('shared-model-input', HTMLInputElement);
const fetchModelsBtn = getRequiredElement(
  'fetch-models-btn',
  HTMLButtonElement,
);
const modelsList = getRequiredElement('shared-models-list', HTMLUListElement);

const setupView = getRequiredElement('setup-view', HTMLDivElement);
const gameView = getRequiredElement('game-view', HTMLDivElement);

const scenarioRequestInput = getRequiredElement(
  'scenario-request',
  HTMLTextAreaElement,
);
const characterDescriptionInput = getRequiredElement(
  'character-description',
  HTMLTextAreaElement,
);
const startGameBtn = getRequiredElement(
  'start-game-btn',
  HTMLButtonElement,
);

const historyContainer = getRequiredElement(
  'history-container',
  HTMLDivElement,
);
const advancedHistoryContainer = getRequiredElement(
  'advanced-history-container',
  HTMLDivElement,
);
const userInput = getRequiredElement('user-input', HTMLTextAreaElement);
const sendBtn = getRequiredElement('send-btn', HTMLButtonElement);
const chatStatus = getRequiredElement('chat-status', HTMLSpanElement);
const restartBtn = getRequiredElement('restart-btn', HTMLButtonElement);
const advancedDetails = getRequiredElement(
  'advanced-details',
  HTMLDetailsElement,
);

function init() {
  apiKeyInput.value = core.apiKey;
  modelInput.value = core.model;
  scenarioRequestInput.value = core.scenarioRequest;
  characterDescriptionInput.value = core.characterDescription;

  scenarioRequestInput.addEventListener('input', (e) => {
    if (e.currentTarget instanceof HTMLTextAreaElement) {
      core.scenarioRequest = e.currentTarget.value;
      core.saveChatState();
    }
  });

  characterDescriptionInput.addEventListener('input', (e) => {
    if (e.currentTarget instanceof HTMLTextAreaElement) {
      core.characterDescription = e.currentTarget.value;
      core.saveChatState();
    }
  });

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

  fetchModelsBtn.addEventListener('click', async () => {
    await runWithUIState(
      fetchModelsBtn,
      chatStatus,
      'Fetching models...',
      async () => {
        const models = await core.fetchModels();
        modelsList.innerHTML = '';
        for (const m of models) {
          const li = document.createElement('li');
          li.textContent = m.id;
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => {
            core.model = m.id;
            modelInput.value = m.id;
            core.saveState();
            modelsList.style.display = 'none';
          });
          modelsList.appendChild(li);
        }
        modelsList.style.display = 'block';
      },
      'Models fetched.',
    );
  });

  startGameBtn.addEventListener('click', handleStartGame);
  sendBtn.addEventListener('click', handleSend);
  restartBtn.addEventListener('click', handleRestart);

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  if (core.history.length > 0) {
    core.systemPrompt = core.getDynamicSystemPrompt();
    showGameView();
    renderHistory();
  } else {
    showSetupView();
  }
}

function showSetupView() {
  setupView.style.display = 'block';
  gameView.style.display = 'none';
}

function showGameView() {
  setupView.style.display = 'none';
  gameView.style.display = 'block';
}

function createAdvancedMessageElement(msg: ChatMessage) {
  const div = document.createElement('div');
  div.className = 'message ' + msg.role;

  const roleLabel = document.createElement('strong');
  roleLabel.textContent = msg.role.toUpperCase() + ': ';
  div.appendChild(roleLabel);

  if (msg.content) {
    const contentNode = document.createTextNode(msg.content);
    div.appendChild(contentNode);
  }

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      const tcDiv = document.createElement('div');
      tcDiv.style.marginTop = '10px';
      tcDiv.style.padding = '10px';
      tcDiv.style.backgroundColor = '#fce4ec';
      tcDiv.style.borderRadius = '5px';
      tcDiv.style.fontSize = '0.9em';
      tcDiv.textContent = `Tool Call [${tc.function.name}]: ${tc.function.arguments}`;
      div.appendChild(tcDiv);
    }
  }

  if (msg.tool_call_id) {
    div.style.backgroundColor = '#e8eaf6';
    const idLabel = document.createElement('div');
    idLabel.style.fontSize = '0.8em';
    idLabel.style.color = '#666';
    idLabel.textContent = `Result for tool: ${msg.tool_call_id}`;
    div.insertBefore(idLabel, div.firstChild);
  }

  return div;
}

function renderAdvancedHistory() {
  advancedHistoryContainer.innerHTML = '';
  for (const msg of core.history) {
    advancedHistoryContainer.appendChild(createAdvancedMessageElement(msg));
  }
  advancedHistoryContainer.scrollTop = advancedHistoryContainer.scrollHeight;
}

function renderHistory(updateAdvanced: boolean = true) {
  historyContainer.innerHTML = '';
  for (const msg of core.history) {
    if (msg.role === 'user') {
      const div = document.createElement('div');
      div.className = 'message user';
      div.textContent = msg.content;
      historyContainer.appendChild(div);
    } else if (msg.role === 'assistant') {
      let hasToolCallsRendered = false;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'speak') {
            hasToolCallsRendered = true;
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

      // Fallback: If no tool calls were rendered but there is plain text content, render it as Narrator.
      if (!hasToolCallsRendered && msg.content && msg.content.trim()) {
        const div = document.createElement('div');
        div.className = 'message narrator';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'character-name';
        nameSpan.textContent = 'Narrator';
        div.appendChild(nameSpan);

        const msgNode = document.createTextNode(msg.content);
        div.appendChild(msgNode);

        historyContainer.appendChild(div);
      }
    }
  }
  historyContainer.scrollTop = historyContainer.scrollHeight;
  if (updateAdvanced) {
    renderAdvancedHistory();
  }
}

async function handleStartGame() {
  const scenarioText = core.scenarioRequest.trim();
  if (!scenarioText) {
    chatStatus.textContent = 'Please enter a scenario request first.';
    chatStatus.style.color = 'red';
    return;
  }

  core.systemPrompt = core.getDynamicSystemPrompt();
  core.history = [];

  const initialPrompt = "Start the adventure based on the setup.";
  core.history.push({
    id: Date.now().toString(),
    role: 'user',
    content: initialPrompt,
  });

  core.saveChatState();
  showGameView();
  renderHistory();

  await generateResponse();
}

async function handleSend() {
  const userText = userInput.value.trim();

  if (!userText) return;

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: userText,
  };
  core.history.push(userMessage);

  core.saveChatState();
  renderHistory();

  userInput.value = '';

  await generateResponse();
}

function handleRestart() {
  if (confirm("Are you sure you want to restart the game? This will clear your current progress.")) {
    core.history = [];
    core.saveChatState();
    showSetupView();
  }
}

async function generateResponse() {
  await runWithUIState(sendBtn, chatStatus, 'Generating...', async () => {
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
  });
}

init();
