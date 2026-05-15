import '../shared/components/styles.css';
import { getRequiredElement } from '../shared/dom-utils.js';
import { TextAdventureCore } from './core.js';
import { ChatMessage } from '../llm-chat/core.js';
import { runWithUIState } from '../shared/ui-utils.js';
import { setupLLMSettings } from '../shared/llm-settings.js';

const core = new TextAdventureCore();

const outputLanguageInput = getRequiredElement(
  'output-language',
  HTMLInputElement,
);
const sharedLlmSettingsContainer = getRequiredElement(
  'shared-llm-settings-container',
  HTMLDivElement,
);

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

const scenarioGuidanceInput = getRequiredElement(
  'scenario-guidance',
  HTMLInputElement,
);

const suggestScenariosBtn = getRequiredElement(
  'suggest-scenarios-btn',
  HTMLButtonElement,
);

const improveScenarioBtn = getRequiredElement(
  'improve-scenario-btn',
  HTMLButtonElement,
);

const scenarioSuggestionsContainer = getRequiredElement(
  'scenario-suggestions-container',
  HTMLDivElement,
);

let previousScenarioSuggestions: string[] = [];

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
const elaborateBtn = getRequiredElement('elaborate-btn', HTMLButtonElement);
const regenerateLastBtn = getRequiredElement(
  'regenerate-last-btn',
  HTMLButtonElement,
);
const clearHistoryBtn = getRequiredElement(
  'clear-history-btn',
  HTMLButtonElement,
);
const oocUserInput = getRequiredElement('ooc-user-input', HTMLTextAreaElement);
const oocSendBtn = getRequiredElement('ooc-send-btn', HTMLButtonElement);
const oocChatStatus = getRequiredElement('ooc-chat-status', HTMLSpanElement);
const oocChatHistory = getRequiredElement('ooc-chat-history', HTMLDivElement);
const clearOocHistoryBtn = getRequiredElement(
  'clear-ooc-history-btn',
  HTMLButtonElement,
);

const advancedDetails = getRequiredElement(
  'advanced-details',
  HTMLDetailsElement,
);

function init() {
  setupLLMSettings(sharedLlmSettingsContainer, core);

  characterNameInput.value = core.characterName;
  characterDescriptionInput.value = core.characterDescription;
  scenarioRequestInput.value = core.scenarioRequest;
  outputLanguageInput.value = core.outputLanguage;

  outputLanguageInput.addEventListener('input', (e) => {
    if (e.currentTarget instanceof HTMLInputElement) {
      core.outputLanguage = e.currentTarget.value;
      core.saveChatState();
    }
  });

  scenarioRequestInput.addEventListener('input', (e) => {
    if (e.currentTarget instanceof HTMLTextAreaElement) {
      core.scenarioRequest = e.currentTarget.value;
      core.saveChatState();
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

  sendBtn.addEventListener('click', handleSend);

  suggestScenariosBtn.addEventListener('click', handleSuggestScenarios);
  improveScenarioBtn.addEventListener('click', handleImproveScenario);

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

  elaborateBtn.addEventListener('click', handleElaborate);

  regenerateLastBtn.addEventListener('click', () => {
    let lastUserIdx = -1;
    for (let i = core.history.length - 1; i >= 0; i--) {
      if (core.history[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx !== -1) {
      core.history = core.history.slice(0, lastUserIdx + 1);
      core.saveChatState();
      renderHistory();
      generateResponse();
    } else {
      chatStatus.textContent = 'No user message to regenerate from.';
      chatStatus.style.color = 'red';
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    core.history = [];
    core.saveChatState();
    renderHistory();
  });

  oocSendBtn.addEventListener('click', handleOOCSend);

  clearOocHistoryBtn.addEventListener('click', () => {
    oocChatHistory.innerHTML = '';
    oocChatHistory.style.display = 'none';

    // The OOC history isn't actually saved in core.history or persisted across sessions,
    // so clearing the UI is sufficient for the current implementation.
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

async function handleOOCSend() {
  const question = oocUserInput.value.trim();
  if (!question) return;

  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'message user';
  userMsgDiv.textContent = question;
  oocChatHistory.appendChild(userMsgDiv);
  oocChatHistory.style.display = 'block';
  oocUserInput.value = '';

  await runWithUIState(
    oocSendBtn,
    oocChatStatus,
    'Thinking...',
    async () => {
      const gmMsgDiv = document.createElement('div');
      gmMsgDiv.className = 'message system';
      oocChatHistory.appendChild(gmMsgDiv);

      const generator = core.generateOOCResponse(question);
      for await (const chunk of generator) {
        gmMsgDiv.textContent += chunk;
        oocChatHistory.scrollTop = oocChatHistory.scrollHeight;
      }
    },
    '',
  );
}

function createAdvancedMessageElement(msg: ChatMessage): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  if (msg.id) {
    div.dataset.id = msg.id;
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  if (msg.content) {
    const textDiv = document.createElement('div');
    if (msg.role === 'assistant') {
      textDiv.innerHTML = `<strong>Agent Thoughts:</strong><br/>`;
    }
    const textContentNode = document.createTextNode(msg.content);
    textDiv.appendChild(textContentNode);
    textDiv.style.marginBottom = '10px';
    contentDiv.appendChild(textDiv);
  }

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const toolDiv = document.createElement('div');
    toolDiv.innerHTML = `<strong>Tool Calls:</strong><br/>`;
    toolDiv.style.padding = '10px';
    toolDiv.style.backgroundColor = '#f0f0f0';
    toolDiv.style.borderLeft = '3px solid #ccc';
    toolDiv.style.marginTop = '5px';
    toolDiv.style.fontFamily = 'monospace';
    toolDiv.style.whiteSpace = 'pre-wrap';

    for (const tc of msg.tool_calls) {
      const tcText = document.createTextNode(
        `- ${tc.function.name}(${tc.function.arguments})\n`,
      );
      toolDiv.appendChild(tcText);
    }
    contentDiv.appendChild(toolDiv);
  }

  const roleLabel = document.createElement('div');
  roleLabel.style.fontWeight = 'bold';
  roleLabel.style.marginBottom = '5px';
  roleLabel.style.textTransform = 'capitalize';
  roleLabel.textContent = msg.role;

  const controls = document.createElement('div');
  controls.className = 'message-controls';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary';
  editBtn.textContent = 'Edit';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Delete';

  const regenerateBelowBtn = document.createElement('button');
  regenerateBelowBtn.className = 'btn btn-warning';
  regenerateBelowBtn.textContent = 'Regenerate ↓';

  controls.appendChild(editBtn);
  controls.appendChild(deleteBtn);
  controls.appendChild(regenerateBelowBtn);

  div.appendChild(roleLabel);
  div.appendChild(contentDiv);
  div.appendChild(controls);

  // Edit logic
  let isEditing = false;
  let editContainer: HTMLDivElement;
  let contentTextarea: HTMLTextAreaElement;
  let toolCallTextareas: { tc: any; textarea: HTMLTextAreaElement }[] = [];

  editBtn.addEventListener('click', () => {
    if (!isEditing) {
      isEditing = true;
      editBtn.textContent = 'Save';

      editContainer = document.createElement('div');

      contentTextarea = document.createElement('textarea');
      contentTextarea.value = msg.content || '';
      contentTextarea.rows = 4;
      contentTextarea.style.width = '100%';
      contentTextarea.placeholder = 'Agent Thoughts (Plain text)';
      editContainer.appendChild(contentTextarea);

      toolCallTextareas = [];
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const label = document.createElement('div');
          label.textContent = `Tool Call: ${tc.function.name}`;
          label.style.marginTop = '10px';
          label.style.fontWeight = 'bold';
          editContainer.appendChild(label);

          const tcTextarea = document.createElement('textarea');
          try {
            // Pretty print the arguments JSON
            const parsedArgs = JSON.parse(tc.function.arguments);
            tcTextarea.value = JSON.stringify(parsedArgs, null, 2);
          } catch {
            tcTextarea.value = tc.function.arguments;
          }
          tcTextarea.rows = 4;
          tcTextarea.style.width = '100%';
          editContainer.appendChild(tcTextarea);
          toolCallTextareas.push({ tc, textarea: tcTextarea });
        }
      }

      div.replaceChild(editContainer, contentDiv);
    } else {
      // Saving logic
      for (const item of toolCallTextareas) {
        try {
          const parsedArgs = JSON.parse(item.textarea.value);
          item.tc.function.arguments = JSON.stringify(parsedArgs);
        } catch (e) {
          chatStatus.textContent = `Invalid JSON for tool call ${item.tc.function.name}`;
          chatStatus.style.color = 'red';
          return; // Abort save
        }
      }

      isEditing = false;
      editBtn.textContent = 'Edit';

      msg.content = contentTextarea.value;

      // Rebuild the display content
      contentDiv.innerHTML = '';
      if (msg.content) {
        const textDiv = document.createElement('div');
        if (msg.role === 'assistant') {
          textDiv.innerHTML = `<strong>Agent Thoughts:</strong><br/>`;
        }
        const textContentNode = document.createTextNode(msg.content);
        textDiv.appendChild(textContentNode);
        textDiv.style.marginBottom = '10px';
        contentDiv.appendChild(textDiv);
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const toolDiv = document.createElement('div');
        toolDiv.innerHTML = `<strong>Tool Calls:</strong><br/>`;
        toolDiv.style.padding = '10px';
        toolDiv.style.backgroundColor = '#f0f0f0';
        toolDiv.style.borderLeft = '3px solid #ccc';
        toolDiv.style.marginTop = '5px';
        toolDiv.style.fontFamily = 'monospace';
        toolDiv.style.whiteSpace = 'pre-wrap';

        for (const tc of msg.tool_calls) {
          const tcText = document.createTextNode(
            `- ${tc.function.name}(${tc.function.arguments})\n`,
          );
          toolDiv.appendChild(tcText);
        }
        contentDiv.appendChild(toolDiv);
      }

      div.replaceChild(contentDiv, editContainer);
      core.saveChatState();
      // Re-render the normal story history
      renderHistory(false);
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this message?')) {
      core.history = core.history.filter((m) => m.id !== msg.id);
      core.saveChatState();
      renderHistory();
    }
  });

  regenerateBelowBtn.addEventListener('click', () => {
    if (confirm('Delete all messages after this point and regenerate?')) {
      const idx = core.history.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        if (msg.role === 'user') {
          core.history = core.history.slice(0, idx + 1);
        } else {
          core.history = core.history.slice(0, idx);
        }
        core.saveChatState();
        renderHistory();
        generateResponse();
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

  const newMessages: ChatMessage[] = [];

  if (directionText) {
    const directionMessage: ChatMessage = {
      id: Date.now().toString() + '-sys',
      role: 'system',
      content: `[OOC - Story Direction]: ${directionText}`,
    };
    newMessages.push(directionMessage);
  }

  const finalContent = `[${core.characterName}]: ${userText || '*Waits silently*'}`;
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

async function handleSuggestScenarios() {
  await runWithUIState(
    suggestScenariosBtn,
    chatStatus,
    'Suggesting scenarios...',
    async () => {
      const generator = core.generateScenarioSuggestions({
        currentScenario: scenarioRequestInput.value.trim(),
        guidance: scenarioGuidanceInput.value.trim(),
        previousSuggestions: previousScenarioSuggestions,
      });

      let toolArgs = '';
      for await (const chunk of generator) {
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolArgs += chunk.toolCall.arguments;
        }
      }

      if (toolArgs) {
        try {
          const parsed = JSON.parse(toolArgs);
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            scenarioSuggestionsContainer.innerHTML = '';
            parsed.suggestions.forEach((suggestion: string) => {
              const btn = document.createElement('button');
              btn.className = 'btn btn-secondary';
              btn.style.textAlign = 'left';
              btn.style.whiteSpace = 'normal';
              btn.style.height = 'auto';
              btn.style.padding = '10px';
              btn.textContent = suggestion;
              btn.addEventListener('click', () => {
                core.scenarioRequest = suggestion;
                scenarioRequestInput.value = suggestion;
                core.saveChatState();
                scenarioSuggestionsContainer.innerHTML = '';
              });
              scenarioSuggestionsContainer.appendChild(btn);
            });
            previousScenarioSuggestions.push(...parsed.suggestions);
            suggestScenariosBtn.textContent = 'Regenerate Suggestions';
          }
        } catch (e) {
          console.error('Failed to parse scenario suggestions', e);
          throw new Error('Failed to parse suggestions from the AI.');
        }
      }
    },
    'Scenarios suggested.',
  );
}

async function handleImproveScenario() {
  await runWithUIState(
    improveScenarioBtn,
    chatStatus,
    'Improving scenario...',
    async () => {
      const generator = core.improveScenarioRequest(
        scenarioRequestInput.value.trim(),
        scenarioGuidanceInput.value.trim(),
      );

      let toolArgs = '';
      for await (const chunk of generator) {
        if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolArgs += chunk.toolCall.arguments;
        }
      }

      if (toolArgs) {
        try {
          const parsed = JSON.parse(toolArgs);
          if (parsed.improvedScenario) {
            core.scenarioRequest = parsed.improvedScenario;
            scenarioRequestInput.value = parsed.improvedScenario;
            core.saveChatState();
            scenarioSuggestionsContainer.innerHTML = '';
          }
        } catch (e) {
          console.error('Failed to parse improved scenario', e);
          throw new Error('Failed to parse improved scenario from the AI.');
        }
      }
    },
    'Scenario improved.',
  );
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
          toolArgs += chunk.toolCall.arguments; // streamCompletionWithTools aggregates tool calls and yields the final string at the end.
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

async function handleElaborate() {
  if (core.history.length === 0) {
    chatStatus.textContent = 'No history to elaborate on.';
    chatStatus.style.color = 'red';
    return;
  }

  const elaborateMessage: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content:
      '[OOC]: Please rewrite and significantly elaborate on your last response. Make it much more vibrant, detailed, and immersive. Describe the environment, sensory details, and character emotions more deeply, and significantly expand the narrative length by adding more events or richer environmental exposition.',
  };

  core.history.push(elaborateMessage);
  core.saveChatState();
  renderHistory();

  await generateResponse();
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

  let introPrompt = `[OOC - Initial Scenario]: The user requested the following scenario to begin: ${scenarioText}`;
  if (params.guidance) {
    introPrompt += `\n\n[OOC - Guidance for Intro]: ${params.guidance}`;
  }
  introPrompt += `\n\nStart the story immediately. Make your tool calls to narrate and speak as normal.`;

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
