import { RepoChatCore } from './core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { askQuestionTool } from './tools/ask-question.js';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';
import { ChatMessage } from '../llm-chat/core.js';
import { createMessageElement } from '../shared/chat-ui.js';

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
const askQuestionContainer = getRequiredElement(
  'ask-question-container',
  HTMLDivElement,
);
const questionText = getRequiredElement('question-text', HTMLParagraphElement);
const suggestedAnswersContainer = getRequiredElement(
  'suggested-answers-container',
  HTMLDivElement,
);
const freeTextAnswer = getRequiredElement(
  'free-text-answer',
  HTMLInputElement,
);
const submitAnswerBtn = getRequiredElement(
  'submit-answer-btn',
  HTMLButtonElement,
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

      const generator = core.streamChatCompletionWithTools([]);

      while (true) {
        const { value: chunk, done } = await generator.next();
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
        if (currentContentDiv) {
          currentContentDiv.textContent = displayContent;
        }
        historyContainer.scrollTop = historyContainer.scrollHeight;
      }

      if (currentAssistantEl) {
        currentAssistantEl.classList.remove('streaming');
      }

      // Check if there are tool calls to execute
      if (currentAssistantMsg?.tool_calls && currentAssistantMsg.tool_calls.length > 0) {
        let hasToolCalls = false;
        for (const tc of currentAssistantMsg.tool_calls) {
          hasToolCalls = true;
          const tool = core.tools.find((t) => t.name === tc.function.name);
          if (tool) {
            let args: any = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch (e) {
               console.error('Failed to parse arguments', e);
            }

            if (tool.name === 'ask_question') {
               // Show UI and wait
               askQuestionContainer.style.display = 'block';
               questionText.textContent = args.question;

               let submitCustomHandler: (() => void) | null = null;

               suggestedAnswersContainer.innerHTML = '';
               for (const answer of (args.suggested_answers || [])) {
                 const btn = document.createElement('button');
                 btn.textContent = answer;
                 btn.onclick = () => {
                   askQuestionContainer.style.display = 'none';
                   if (submitCustomHandler) {
                     submitAnswerBtn.removeEventListener('click', submitCustomHandler);
                   }
                   (window as any).resolveAskQuestion(answer);
                 };
                 suggestedAnswersContainer.appendChild(btn);
               }

               submitCustomHandler = () => {
                 const customAns = freeTextAnswer.value.trim();
                 if (customAns) {
                   askQuestionContainer.style.display = 'none';
                   freeTextAnswer.value = '';
                   if (submitCustomHandler) {
                     submitAnswerBtn.removeEventListener('click', submitCustomHandler);
                   }
                   (window as any).resolveAskQuestion(customAns);
                 }
               };
               submitAnswerBtn.addEventListener('click', submitCustomHandler);

               // Execute waits until resolveAskQuestion is called
               const result = await tool.execute(args);

               const toolMsg: ChatMessage = {
                 id: 'msg_tool_' + Date.now() + Math.random(),
                 role: 'tool',
                 content: result,
                 tool_call_id: tc.id,
               };
               core.history.push(toolMsg);
               renderHistory();

            } else {
               // Normal tool execution
               const result = await tool.execute(args);
               const toolMsg: ChatMessage = {
                 id: 'msg_tool_' + Date.now() + Math.random(),
                 role: 'tool',
                 content: typeof result === 'string' ? result : JSON.stringify(result),
                 tool_call_id: tc.id,
               };
               core.history.push(toolMsg);
               renderHistory();
            }
          } else {
            // Unregistered tool hallucination
            const toolMsg: ChatMessage = {
              id: 'msg_tool_' + Date.now() + Math.random(),
              role: 'tool',
              content: `Error: Tool ${tc.function.name} not found. Please do not call this tool.`,
              tool_call_id: tc.id,
            };
            core.history.push(toolMsg);
            renderHistory();
          }
        }

        // Trigger follow up once all tool calls are processed
        if (hasToolCalls) {
          await handleChatGeneration();
        }
      }
    },
    ''
  );
}
