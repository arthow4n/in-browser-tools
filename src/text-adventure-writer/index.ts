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

const characterNameInput = getRequiredElement(
  'character-name',
  HTMLInputElement,
);
const characterDescriptionInput = getRequiredElement(
  'character-description',
  HTMLTextAreaElement,
);

const scenarioRequestInput = getRequiredElement(
  'scenario-request',
  HTMLTextAreaElement,
);

const characterGuidanceInput = getRequiredElement(
  'character-guidance',
  HTMLInputElement,
);
const generateCharacterBtn = getRequiredElement(
  'generate-character-btn',
  HTMLButtonElement,
);

const introGuidanceInput = getRequiredElement(
  'intro-guidance',
  HTMLInputElement,
);
const generateIntroBtn = getRequiredElement(
  'generate-intro-btn',
  HTMLButtonElement,
);

const actionGuidanceInput = getRequiredElement(
  'action-guidance',
  HTMLInputElement,
);
const generateActionBtn = getRequiredElement(
  'generate-action-btn',
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
const advancedDetails = getRequiredElement(
  'advanced-details',
  HTMLDetailsElement,
);

function init() {
  apiKeyInput.value = core.apiKey;
  modelInput.value = core.model;
  characterNameInput.value = core.characterName;
  characterDescriptionInput.value = core.characterDescription;
  scenarioRequestInput.value = core.scenarioRequest;

  scenarioRequestInput.addEventListener('input', (e) => {
    if (e.currentTarget instanceof HTMLTextAreaElement) {
      core.scenarioRequest = e.currentTarget.value;
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

  setupRegenerationUI({
    btnElement: generateCharacterBtn,
    inputElement: characterGuidanceInput,
    callback: handleGenerateCharacter,
  });

  setupRegenerationUI({
    btnElement: generateIntroBtn,
    inputElement: introGuidanceInput,
    callback: handleGenerateIntro,
  });

  generateActionBtn.addEventListener('click', handleGenerateAction);

  clearHistoryBtn.addEventListener('click', () => {
    core.history = [];
    core.saveChatState();
    renderHistory();
  });

  advancedDetails.addEventListener('toggle', () => {
    if (advancedDetails.open) {
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        });
      }, 0);
    }
  });

  renderHistory();
}

function createAdvancedMessageElement(msg: ChatMessage): HTMLDivElement {
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
      // If the message has tool calls (how narrator/characters speak),
      // we allow editing the raw JSON arguments so they can adjust the story.
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Simplified: We assume editing the first tool call is the main use case
        // or we just serialize all tool calls. Let's serialize the whole array for full control.
        editTextarea.value = JSON.stringify(msg.tool_calls, null, 2);
      } else {
        editTextarea.value = msg.content;
      }
      editTextarea.rows = 4;
      editTextarea.style.width = '100%';
      div.replaceChild(editTextarea, contentDiv);
    } else {
      isEditing = false;
      editBtn.textContent = 'Edit';

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        try {
          msg.tool_calls = JSON.parse(editTextarea.value);
        } catch (e) {
          chatStatus.textContent = 'Invalid JSON formatting for tool calls.';
          chatStatus.style.color = 'red';
          isEditing = true;
          editBtn.textContent = 'Save';
          return;
        }
      } else {
        msg.content = editTextarea.value;
      }

      let newDisplayContent = msg.content;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        newDisplayContent += '\n\n**Tool Calls:**\n';
        for (const tc of msg.tool_calls) {
          newDisplayContent += `- ${tc.function.name}(${tc.function.arguments})\n`;
        }
      }
      contentDiv.textContent = newDisplayContent;

      div.replaceChild(contentDiv, editTextarea);
      core.saveChatState();
      // Also need to re-render the normal story history since we changed the underlying data
      renderHistory(false); // Don't loop infinitely
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

  await generateResponse();
}

function setupRegenerationUI(params: {
  btnElement: HTMLButtonElement;
  inputElement: HTMLInputElement;
  callback: (cbParams: { guidance: string }) => Promise<void>;
}) {
  params.btnElement.addEventListener('click', () => {
    params.callback({ guidance: params.inputElement.value.trim() });
  });
}

async function handleGenerateCharacter(params: { guidance: string }) {
  const scenarioText = core.scenarioRequest.trim();
  if (!scenarioText) {
    chatStatus.textContent = 'Please enter a scenario request first.';
    chatStatus.style.color = 'red';
    return;
  }

  await runWithUIState(
    generateCharacterBtn,
    chatStatus,
    'Generating character...',
    async () => {
      const generator = core.generateCharacter({
        scenarioRequest: scenarioText,
        guidance: params.guidance,
      });

      let toolArgs = '';

      for await (const chunk of generator) {
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolArgs = chunk.toolCall.arguments; // streamCompletionWithTools aggregates tool calls and yields the final string at the end.
        }
      }

      if (toolArgs) {
        const parsed = JSON.parse(toolArgs);
        if (parsed.characterName) {
          core.characterName = parsed.characterName;
          characterNameInput.value = core.characterName;
        }
        if (parsed.characterDescription) {
          core.characterDescription = parsed.characterDescription;
          characterDescriptionInput.value = core.characterDescription;
        }
        core.saveChatState();
      }
    },
    'Character generated.',
  );
}

async function handleGenerateAction() {
  const guidance = actionGuidanceInput.value.trim();

  await runWithUIState(
    generateActionBtn,
    chatStatus,
    'Generating next action...',
    async () => {
      const generator = core.generateNextAction(guidance);
      let fullText = '';

      for await (const chunk of generator) {
        fullText += chunk;
        userInput.value = fullText;
      }
    },
    'Action suggested.',
  );
}

async function handleGenerateIntro(params: { guidance: string }) {
  const scenarioText = core.scenarioRequest.trim();
  if (!scenarioText) {
    chatStatus.textContent = 'Please enter a scenario request first.';
    chatStatus.style.color = 'red';
    return;
  }

  // Clear previous history since we are restarting/regenerating the intro scenario
  core.history = [];

  const initialMessages: ChatMessage[] = [];
  if (core.characterDescription) {
    initialMessages.push({
      id: Date.now().toString() + '-sys',
      role: 'system',
      content: `[OOC - Character Update]: The user is playing as ${core.characterName || 'an unknown character'}. Description: ${core.characterDescription}`,
    });
  }

  let introPrompt = `[OOC - Initial Scenario]: The user requested the following scenario to begin: ${scenarioText}`;
  if (params.guidance) {
    introPrompt += `\n\n[OOC - Guidance for Intro]: ${params.guidance}`;
  }

  initialMessages.push({
    id: Date.now().toString(),
    role: 'user',
    content: introPrompt,
  });

  core.history.push(...initialMessages);
  core.saveChatState();
  renderHistory();

  await generateResponse();
}

async function generateResponse() {
  generateIntroBtn.disabled = true;

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
  });

  generateIntroBtn.disabled = false;
}

init();
