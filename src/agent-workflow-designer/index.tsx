import { UndoRedoManager } from '../shared/undo-redo.js';
import { ChatCore, ChatMessage } from '../llm-chat/core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';
import { getStorage, setStorage } from '../shared/storage.js';
import '../shared/components/styles.css';

const SYSTEM_PROMPT = `You are a multi-agent workflow designer. The user will interactively chat with you to design and improve an agent workflow.

Based on the chat, you must design a workflow consisting of:
1. One "Workflow Driving Prompt" (the orchestrator prompt that dispatches sub-agents).
2. Several system prompts, one for each sub-agent in the workflow.

IMPORTANT: Whenever the workflow is created or updated, you MUST call the "update_workflow" tool with the full current state of the workflow prompts.

Keep your chat responses concise and always rely on the tool to update the workflow.`;

export interface WorkflowAgent {
  name: string;
  content: string;
}

export interface ParsedWorkflow {
  orchestrator: string;
  agents: WorkflowAgent[];
}

export let currentWorkflow: ParsedWorkflow | null = null;
let undoManager: UndoRedoManager<ChatMessage[]> | null = null;

function getTabSessionId(): string {
  let sessionId = sessionStorage.getItem('tab-session-id');
  if (!sessionId) {
    sessionId =
      Date.now().toString() + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('tab-session-id', sessionId);
  }
  return sessionId;
}

class DesignerChat extends ChatCore {
  constructor() {
    super(`agent-workflow-designer-${getTabSessionId()}-`);
    this.systemPrompt = SYSTEM_PROMPT;
    this.toolsEnabled = true;
    this.registerTool({
      name: 'update_workflow',
      description:
        'Updates the multi-agent workflow state with the orchestrator prompt and sub-agent prompts.',
      parameters: {
        type: 'object',
        properties: {
          orchestrator: {
            type: 'string',
            description:
              'The Workflow Driving Prompt (orchestrator prompt) content.',
          },
          agents: {
            type: 'array',
            description: 'The list of sub-agents in the workflow.',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the sub-agent.',
                },
                content: {
                  type: 'string',
                  description: 'The prompt content for the sub-agent.',
                },
              },
              required: ['name', 'content'],
            },
          },
        },
        required: ['orchestrator', 'agents'],
      },
      execute: (args: any) => {
        // Will be handled as a side-effect via streaming chunks
        return { success: true };
      },
    });

    undoManager = new UndoRedoManager(
      [...this.history],
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
    );
  }

  loadChatState() {
    super.loadChatState();
    try {
      this.history = JSON.parse(
        getStorage('agent-workflow-designer-history') || '[]',
      );
    } catch {
      this.history = [];
    }
    if (undoManager) {
      undoManager.save([...this.history]);
    }
  }

  saveChatState() {
    super.saveChatState();
    setStorage('agent-workflow-designer-history', JSON.stringify(this.history));
    if (undoManager) {
      undoManager.save([...this.history]);
    }
  }
}

class TestChat extends ChatCore {
  constructor() {
    super(`test-workflow-chat-${getTabSessionId()}-`);
  }
  loadChatState() {
    // Ephemeral, do nothing
  }
  saveChatState() {
    // Ephemeral, do nothing
  }
}

const core = new DesignerChat();
const testCore = new TestChat();

// --- DOM Elements ---
const llmSettingsContainer = getRequiredElement(
  'llm-settings-container',
  HTMLDivElement,
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
const undoChatBtn = getRequiredElement('undo-chat-btn', HTMLButtonElement);
const redoChatBtn = getRequiredElement('redo-chat-btn', HTMLButtonElement);

const workflowContainer = getRequiredElement(
  'workflow-container',
  HTMLDivElement,
);
const importTextarea = getRequiredElement(
  'import-textarea',
  HTMLTextAreaElement,
);
const importBtn = getRequiredElement('import-btn', HTMLButtonElement);
const fixImportBtn = getRequiredElement('fix-import-btn', HTMLButtonElement);
const importStatus = getRequiredElement('import-status', HTMLSpanElement);
const copyAllBtn = getRequiredElement('copy-all-btn', HTMLButtonElement);
const downloadAllBtn = getRequiredElement(
  'download-all-btn',
  HTMLButtonElement,
);
const vizStatus = getRequiredElement('viz-status', HTMLSpanElement);

const testRunSection = getRequiredElement('test-run-section', HTMLElement);
const testOutputContainer = getRequiredElement(
  'test-output-container',
  HTMLDivElement,
);
const testUserInput = getRequiredElement(
  'test-user-input',
  HTMLTextAreaElement,
);
const runTestBtn = getRequiredElement('run-test-btn', HTMLButtonElement);
const evalTestBtn = getRequiredElement('eval-test-btn', HTMLButtonElement);
const evalOutputContainer = getRequiredElement(
  'eval-output-container',
  HTMLDivElement,
);
const testStatus = getRequiredElement('test-status', HTMLSpanElement);

// --- Initialization ---
function init() {
  setupLLMSettings(llmSettingsContainer, core);
  renderHistory();
  updateUndoRedoButtons();

  if (core.history.length > 0) {
    const lastAssisWithTool = [...core.history]
      .reverse()
      .find(
        (m) =>
          m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0,
      );

    if (lastAssisWithTool && lastAssisWithTool.tool_calls) {
      const tc = lastAssisWithTool.tool_calls.find(
        (t) => t.function.name === 'update_workflow',
      );
      if (tc) {
        parseAndRenderWorkflow(tc.function.arguments);
      }
    }
  }
}

function updateUndoRedoButtons() {
  if (undoManager) {
    undoChatBtn.disabled = !undoManager.canUndo;
    redoChatBtn.disabled = !undoManager.canRedo;
  }
}

// --- Chat Logic ---
function createMessageElement(
  msg: ChatMessage,
  titleOverride?: string,
): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  div.dataset.id = msg.id;

  const roleLabel = document.createElement('div');
  roleLabel.style.fontWeight = 'bold';
  roleLabel.style.marginBottom = '5px';
  roleLabel.style.textTransform = 'capitalize';
  roleLabel.textContent = titleOverride || msg.role;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.textContent = msg.content;

  div.appendChild(roleLabel);
  div.appendChild(contentDiv);
  return div;
}

export function renderHistory() {
  historyContainer.innerHTML = '';
  for (const msg of core.history) {
    historyContainer.appendChild(createMessageElement(msg));
  }
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

async function handleChatSend() {
  const text = userInputTextarea.value.trim();
  if (!text) return;

  if (!core.apiKey || !core.model) {
    chatStatus.textContent =
      'API Key and Model are required. Please set them in settings.';
    chatStatus.style.color = 'red';
    return;
  }

  await runWithUIState(sendBtn, chatStatus, 'Sending...', async () => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    core.history.push(userMsg);
    core.saveChatState();
    renderHistory();
    userInputTextarea.value = '';

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };
    const assistantEl = createMessageElement(assistantMsg);
    assistantEl.classList.add('streaming');
    historyContainer.appendChild(assistantEl);
    const contentDiv = assistantEl.querySelector('.content') as HTMLDivElement;

    let updatedWorkflow = false;

    try {
      const generator = core.streamChatCompletionWithTools([]);
      for await (const chunk of generator) {
        if (chunk.type === 'text' && chunk.text) {
          assistantMsg.content += chunk.text;
          contentDiv.textContent = assistantMsg.content;
          historyContainer.scrollTop = historyContainer.scrollHeight;
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          if (!assistantMsg.tool_calls) {
            assistantMsg.tool_calls = [];
          }
          assistantMsg.tool_calls.push({
            id: chunk.toolCall.id,
            type: 'function',
            function: {
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments,
            },
          });

          if (chunk.toolCall.name === 'update_workflow') {
            try {
              const parsedArgs = JSON.parse(
                chunk.toolCall.arguments,
              ) as ParsedWorkflow;
              renderWorkflow(parsedArgs);
              updatedWorkflow = true;
            } catch (e) {
              console.error('Failed to parse update_workflow arguments', e);
            }
          }
        }
      }
    } catch (e: any) {
      assistantMsg.content += `\n[Error: ${e.message}]`;
      contentDiv.textContent = assistantMsg.content;
      throw e;
    } finally {
      assistantEl.classList.remove('streaming');
      core.history.push(assistantMsg);

      if (updatedWorkflow && assistantMsg.tool_calls?.length) {
        const toolCallId = assistantMsg.tool_calls.find(
          (tc) => tc.function.name === 'update_workflow',
        )?.id;
        if (toolCallId) {
          const toolMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'tool',
            content: JSON.stringify({ success: true }),
            tool_call_id: toolCallId,
          };
          core.history.push(toolMsg);
        }
      }

      core.saveChatState();
      renderHistory();
      updateUndoRedoButtons();
    }
  });
}

sendBtn.addEventListener('click', handleChatSend);

undoChatBtn.addEventListener('click', () => {
  if (undoManager) {
    const state = undoManager.undo();
    if (state) {
      core.history = [...state];
      setStorage(
        'agent-workflow-designer-history',
        JSON.stringify(core.history),
      );
      renderHistory();
      const lastAssisWithTool = [...core.history]
        .reverse()
        .find(
          (m) =>
            m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0,
        );

      let foundArgs = '';
      if (lastAssisWithTool && lastAssisWithTool.tool_calls) {
        const tc = lastAssisWithTool.tool_calls.find(
          (t) => t.function.name === 'update_workflow',
        );
        if (tc) foundArgs = tc.function.arguments;
      }
      parseAndRenderWorkflow(foundArgs);
      updateUndoRedoButtons();
    }
  }
});

redoChatBtn.addEventListener('click', () => {
  if (undoManager) {
    const state = undoManager.redo();
    if (state) {
      core.history = [...state];
      setStorage(
        'agent-workflow-designer-history',
        JSON.stringify(core.history),
      );
      renderHistory();
      const lastAssisWithTool = [...core.history]
        .reverse()
        .find(
          (m) =>
            m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0,
        );

      let foundArgs = '';
      if (lastAssisWithTool && lastAssisWithTool.tool_calls) {
        const tc = lastAssisWithTool.tool_calls.find(
          (t) => t.function.name === 'update_workflow',
        );
        if (tc) foundArgs = tc.function.arguments;
      }
      parseAndRenderWorkflow(foundArgs);
      updateUndoRedoButtons();
    }
  }
});

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear entire chat history?')) {
    core.history = [];
    core.saveChatState();
    renderHistory();
    parseAndRenderWorkflow('');
    updateUndoRedoButtons();
  }
});

// --- Workflow Parsing & Visualization ---
// Helper to parse workflow purely from tool call JSON
export function parseWorkflowFromJson(jsonStr: string): ParsedWorkflow | null {
  try {
    return JSON.parse(jsonStr) as ParsedWorkflow;
  } catch {
    return null;
  }
}

export function renderWorkflow(workflow: ParsedWorkflow | null) {
  currentWorkflow = workflow;
  workflowContainer.innerHTML = '';
  testRunSection.style.display = workflow ? 'block' : 'none';

  if (!workflow) {
    workflowContainer.innerHTML =
      '<p style="color: #666; font-style: italic;">No valid workflow found. Chat with the LLM to generate one.</p>';
    return;
  }

  const orchCard = document.createElement('div');
  orchCard.className = 'workflow-card';
  orchCard.innerHTML = `
    <h3>Workflow Driving Prompt</h3>
    <textarea rows="6" readonly>${workflow.orchestrator}</textarea>
    <div class="card-actions">
      <button class="copy-btn btn btn-secondary" data-type="orchestrator">Copy</button>
      <button class="download-btn btn btn-secondary" data-type="orchestrator">Download</button>
    </div>
  `;
  workflowContainer.appendChild(orchCard);

  if (workflow.agents.length > 0) {
    const agentsHeader = document.createElement('h3');
    agentsHeader.style.marginTop = '20px';
    agentsHeader.textContent = 'Sub-Agents';
    workflowContainer.appendChild(agentsHeader);

    const agentsList = document.createElement('div');
    agentsList.className = 'sub-agents-list';

    workflow.agents.forEach((agent, index) => {
      const agentCard = document.createElement('div');
      agentCard.className = 'workflow-card';
      agentCard.innerHTML = `
        <h3>Agent: ${agent.name}</h3>
        <textarea rows="5" readonly>${agent.content}</textarea>
        <div class="card-actions">
          <button class="copy-btn btn btn-secondary" data-type="agent" data-index="${index}">Copy</button>
          <button class="download-btn btn btn-secondary" data-type="agent" data-index="${index}">Download</button>
        </div>
      `;
      agentsList.appendChild(agentCard);
    });
    workflowContainer.appendChild(agentsList);
  }
  setupWorkflowCardButtons();
}

let parseAndRenderWorkflow = (jsonStr: string) => {
  if (!jsonStr) {
    renderWorkflow(null);
    return;
  }
  const parsed = parseWorkflowFromJson(jsonStr);
  renderWorkflow(parsed);
};

// --- Export & Import ---
function getConcatenatedMarkdown(): string {
  if (!currentWorkflow) return '';
  let md = `# Workflow Driving Prompt\n\n${currentWorkflow.orchestrator}\n\n`;
  for (const agent of currentWorkflow.agents) {
    md += `# Agent: ${agent.name}\n\n${agent.content}\n\n`;
  }
  return md.trim();
}

function downloadFile(filename: string, content: string) {
  const element = document.createElement('a');
  element.setAttribute(
    'href',
    'data:text/markdown;charset=utf-8,' + encodeURIComponent(content),
  );
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

async function copyToClipboard(text: string, button: HTMLButtonElement) {
  vizStatus.textContent = '';
  try {
    await navigator.clipboard.writeText(text);
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  } catch (err) {
    vizStatus.textContent = 'Failed to copy to clipboard';
    vizStatus.style.color = 'red';
  }
}

function setupWorkflowCardButtons() {
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!currentWorkflow) return;
      const target = e.currentTarget;
      if (!(target instanceof HTMLButtonElement)) return;
      const type = target.dataset.type;
      const index = parseInt(target.dataset.index || '-1', 10);
      if (type === 'orchestrator')
        copyToClipboard(currentWorkflow.orchestrator, target);
      else if (type === 'agent' && index >= 0)
        copyToClipboard(currentWorkflow.agents[index].content, target);
    });
  });

  document.querySelectorAll('.download-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!currentWorkflow) return;
      const target = e.currentTarget;
      if (!(target instanceof HTMLButtonElement)) return;
      const type = target.dataset.type;
      const index = parseInt(target.dataset.index || '-1', 10);
      if (type === 'orchestrator')
        downloadFile(
          'workflow-driving-prompt.md',
          currentWorkflow.orchestrator,
        );
      else if (type === 'agent' && index >= 0) {
        const agent = currentWorkflow.agents[index];
        const safeName = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        downloadFile(`agent-${safeName}.md`, agent.content);
      }
    });
  });
}

copyAllBtn.addEventListener('click', () => {
  vizStatus.textContent = '';
  if (!currentWorkflow) {
    vizStatus.textContent = 'No workflow to copy';
    vizStatus.style.color = 'red';
    return;
  }
  copyToClipboard(getConcatenatedMarkdown(), copyAllBtn);
});

downloadAllBtn.addEventListener('click', () => {
  vizStatus.textContent = '';
  if (!currentWorkflow) {
    vizStatus.textContent = 'No workflow to download';
    vizStatus.style.color = 'red';
    return;
  }
  downloadFile('workflow.md', getConcatenatedMarkdown());
});

function handleImport() {
  importStatus.textContent = '';
  const text = importTextarea.value.trim();
  if (!text) {
    importStatus.textContent = 'Please paste markdown to import.';
    importStatus.style.color = 'red';
    return;
  }
  // Try parsing as JSON first, if it fails, show the fix button
  const parsed = parseWorkflowFromJson(text);
  if (parsed && parsed.orchestrator && parsed.agents) {
    renderWorkflow(parsed);
    fixImportBtn.style.display = 'none';

    const importMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `I am importing an existing workflow:\n\n\`\`\`markdown\n${text}\n\`\`\``,
    };
    core.history.push(importMsg);
    core.saveChatState();
    renderHistory();
    updateUndoRedoButtons();

    importTextarea.value = '';
    importStatus.textContent = 'Workflow imported successfully!';
    importStatus.style.color = 'green';
  } else {
    importStatus.textContent =
      'Could not parse the markdown automatically. Click "Fix Import with LLM".';
    importStatus.style.color = 'red';
    fixImportBtn.style.display = 'inline-block';
  }
}

importBtn.addEventListener('click', handleImport);

fixImportBtn.addEventListener('click', async () => {
  importStatus.textContent = '';
  const text = importTextarea.value.trim();
  if (!text) return;
  if (!core.apiKey || !core.model) {
    importStatus.textContent = 'API Key and Model are required for LLM fixing.';
    importStatus.style.color = 'red';
    return;
  }

  fixImportBtn.disabled = true;
  fixImportBtn.textContent = 'Fixing...';

  const fixPrompt = `Please parse the following malformed workflow markdown and return a JSON object with the exact following structure.
Do not wrap it in markdown. Do not include any other text. Output raw JSON only.

Structure:
{
  "orchestrator": "The orchestrator prompt content",
  "agents": [
    { "name": "Agent Name 1", "content": "Prompt for Agent 1" },
    { "name": "Agent Name 2", "content": "Prompt for Agent 2" }
  ]
}

Here is the malformed workflow:

${text}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${core.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: core.model,
        messages: [{ role: 'user', content: fixPrompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) throw new Error('Failed to fix import');
    const data = await res.json();
    const fixedText = data.choices[0]?.message?.content;
    if (fixedText) {
      try {
        const parsedWorkflow = JSON.parse(fixedText);
        renderWorkflow(parsedWorkflow);
        fixImportBtn.style.display = 'none';

        const importMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: `I am importing an existing workflow from the malformed text.`,
        };
        core.history.push(importMsg);

        // Add a fake assistant message with tool call to simulate proper import
        const fakeAssistantId = (Date.now() + 1).toString();
        const fakeToolCallId = 'call_' + Date.now();
        const assistantMsg: ChatMessage = {
          id: fakeAssistantId,
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: fakeToolCallId,
              type: 'function',
              function: {
                name: 'update_workflow',
                arguments: JSON.stringify(parsedWorkflow),
              },
            },
          ],
        };
        const toolMsg: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'tool',
          content: JSON.stringify({ success: true }),
          tool_call_id: fakeToolCallId,
        };

        core.history.push(assistantMsg);
        core.history.push(toolMsg);

        core.saveChatState();
        renderHistory();
        updateUndoRedoButtons();

        importTextarea.value = '';
        importStatus.textContent = 'Workflow fixed and imported successfully!';
        importStatus.style.color = 'green';
      } catch (parseError) {
        importStatus.textContent = 'LLM did not return valid JSON.';
        importStatus.style.color = 'red';
      }
    }
  } catch (e: any) {
    importStatus.textContent = `Error fixing import: ${e.message}`;
    importStatus.style.color = 'red';
  } finally {
    fixImportBtn.disabled = false;
    fixImportBtn.textContent = 'Fix Import with LLM';
  }
});

// --- Test Chat Logic ---
runTestBtn.addEventListener('click', async () => {
  testStatus.textContent = '';
  const text = testUserInput.value.trim();
  if (!text) return;
  if (!core.apiKey || !core.model) {
    testStatus.textContent =
      'API Key and Model are required. Please set them in settings.';
    testStatus.style.color = 'red';
    return;
  }

  const markdown = getConcatenatedMarkdown();
  testCore.systemPrompt = `You are the orchestrator in the following multi-agent workflow. Fulfill the user's request by calling the appropriate sub-agent tools as necessary.\n\n${markdown}`;
  testCore.apiKey = core.apiKey;
  testCore.model = core.model;
  testCore.toolsEnabled = true;
  testCore.tools = [];

  if (currentWorkflow && currentWorkflow.agents) {
    currentWorkflow.agents.forEach((agent) => {
      const toolName = `call_agent_${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      testCore.registerTool({
        name: toolName,
        description: `Call sub-agent ${agent.name}`,
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: `The message to send to sub-agent ${agent.name}.`,
            },
          },
          required: ['message'],
        },
        execute: (args: any) => {
          return { success: true };
        },
      });
    });
  }

  const userMsg: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: text,
  };

  testCore.history.push(userMsg);
  testUserInput.value = '';
  runTestBtn.disabled = true;
  evalTestBtn.disabled = true;

  testOutputContainer.appendChild(createMessageElement(userMsg));
  testOutputContainer.scrollTop = testOutputContainer.scrollHeight;

  const assistantMsg: ChatMessage = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
  };
  try {
    let isLooping = true;
    while (isLooping) {
      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
      };
      const assistantEl = createMessageElement(assistantMsg, 'Orchestrator');
      assistantEl.classList.add('streaming');
      testOutputContainer.appendChild(assistantEl);
      const contentDiv = assistantEl.querySelector(
        '.content',
      ) as HTMLDivElement;

      let pendingToolCalls: any[] = [];
      try {
        const generator = testCore.streamChatCompletionWithTools([]);
        for await (const chunk of generator) {
          if (chunk.type === 'text' && chunk.text) {
            assistantMsg.content += chunk.text;
            contentDiv.textContent = assistantMsg.content;
            testOutputContainer.scrollTop = testOutputContainer.scrollHeight;
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            if (!assistantMsg.tool_calls) {
              assistantMsg.tool_calls = [];
            }
            assistantMsg.tool_calls.push({
              id: chunk.toolCall.id,
              type: 'function',
              function: {
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              },
            });
            pendingToolCalls.push(chunk.toolCall);
          }
        }
      } finally {
        assistantEl.classList.remove('streaming');
      }

      testCore.history.push(assistantMsg);

      if (pendingToolCalls.length > 0) {
        for (const pendingToolCall of pendingToolCalls) {
          // Find corresponding agent
          const agentNameMatch = pendingToolCall.name.replace(
            'call_agent_',
            '',
          );
          const agent = currentWorkflow?.agents.find(
            (a) =>
              a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') ===
              agentNameMatch,
          );

          let toolResponseContent = '';
          if (agent) {
            try {
              const args = JSON.parse(pendingToolCall.arguments);

              // Subagent ChatCore
              const subAgentCore = new TestChat();
              subAgentCore.apiKey = core.apiKey;
              subAgentCore.model = core.model;
              subAgentCore.systemPrompt = agent.content;

              const subAgentUserMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: args.message || '',
              };
              subAgentCore.history.push(subAgentUserMsg);

              const subAssistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
              };
              const subAssistantEl = createMessageElement(
                subAssistantMsg,
                `Sub-Agent: ${agent.name}`,
              );
              subAssistantEl.classList.add('streaming');
              testOutputContainer.appendChild(subAssistantEl);
              const subContentDiv = subAssistantEl.querySelector(
                '.content',
              ) as HTMLDivElement;
              testOutputContainer.scrollTop = testOutputContainer.scrollHeight;

              try {
                const subGenerator = subAgentCore.streamChatCompletion([]);
                for await (const chunk of subGenerator) {
                  subAssistantMsg.content += chunk;
                  subContentDiv.textContent = subAssistantMsg.content;
                  testOutputContainer.scrollTop =
                    testOutputContainer.scrollHeight;
                }
                toolResponseContent = subAssistantMsg.content;
              } finally {
                subAssistantEl.classList.remove('streaming');
              }
            } catch (err: any) {
              toolResponseContent = `Error running sub-agent: ${err.message}`;
            }
          } else {
            toolResponseContent = `Error: Sub-agent for tool ${pendingToolCall.name} not found.`;
          }

          const toolMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'tool',
            content: toolResponseContent,
            tool_call_id: pendingToolCall.id,
          };
          testCore.history.push(toolMsg);
        }
      } else {
        isLooping = false; // No more tool calls, exit loop
      }
    }
  } catch (e: any) {
    testStatus.textContent = `Test Chat Error: ${e.message}`;
    testStatus.style.color = 'red';
  } finally {
    runTestBtn.disabled = false;
    evalTestBtn.disabled = false;
  }
});

evalTestBtn.addEventListener('click', async () => {
  testStatus.textContent = '';
  if (!core.apiKey || !core.model) {
    testStatus.textContent = 'API Key and Model are required.';
    testStatus.style.color = 'red';
    return;
  }

  evalTestBtn.disabled = true;
  evalTestBtn.textContent = 'Evaluating...';

  const evalPrompt = `Please review the following test run of the multi-agent workflow and the workflow definition itself. Suggest 3 concrete improvements to the workflow prompts. Format your response strictly as a JSON array of strings, where each string is a suggested prompt improvement that the user can directly send to the designer LLM to implement. Do not include any other text.

Workflow:
${getConcatenatedMarkdown()}

Test Run History:
${JSON.stringify(testCore.history, null, 2)}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${core.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: core.model,
        messages: [{ role: 'user', content: evalPrompt }],
      }),
    });

    if (!res.ok) throw new Error('Failed to evaluate test run');
    const data = await res.json();
    const content = data.choices[0]?.message?.content;

    let suggestions: string[] = [];
    try {
      const match = content.match(/\[[\s\S]*?\]/);
      const jsonStr = match ? match[0] : content;
      suggestions = JSON.parse(jsonStr);
      if (!Array.isArray(suggestions)) throw new Error('Not an array');
    } catch (e) {
      console.warn('Could not parse JSON properly, falling back', e);
      suggestions = content
        .split('\n')
        .filter((line: string) => line.trim().length > 0);
    }

    evalOutputContainer.innerHTML = '<h3>Suggestions</h3>';
    suggestions.forEach((suggestion) => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn btn btn-secondary';
      btn.textContent = suggestion;
      btn.addEventListener('click', () => {
        userInputTextarea.value = suggestion;
        userInputTextarea.focus();
      });
      evalOutputContainer.appendChild(btn);
    });
  } catch (e: any) {
    testStatus.textContent = `Evaluation Error: ${e.message}`;
    testStatus.style.color = 'red';
  } finally {
    evalTestBtn.disabled = false;
    evalTestBtn.textContent = 'Evaluate Run & Suggest Improvements';
  }
});

init();

export { parseAndRenderWorkflow, core, createMessageElement };
