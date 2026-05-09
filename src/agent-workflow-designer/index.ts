import { ChatCore, ChatMessage } from '../llm-chat/core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { getRequiredElement } from '../shared/dom-utils.js';

const SYSTEM_PROMPT = `You are a multi-agent workflow designer. The user will interactively chat with you to design and improve an agent workflow.

Based on the chat, you must design a workflow consisting of:
1. One "Workflow Driving Prompt" (the orchestrator prompt that dispatches sub-agents).
2. Several system prompts, one for each sub-agent in the workflow.

IMPORTANT: At the end of EVERY response, you MUST append a markdown block containing the *current state* of the workflow prompts. It must be formatted exactly as follows:

\`\`\`markdown
# Workflow Driving Prompt
[Content of the orchestrator prompt]

# Agent: [Agent Name 1]
[Content of the prompt for Agent 1]

# Agent: [Agent Name 2]
[Content of the prompt for Agent 2]
\`\`\`

You can have as many agents as needed. Make sure the headers exactly match the format above. Keep your chat response concise and place the markdown block at the very end.`;

class WorkflowDesignerCore extends ChatCore {
  constructor() {
    super();
    this.systemPrompt = SYSTEM_PROMPT; // Override default
  }

  // Override loadState to use different local storage keys to not conflict with regular llm-chat
  loadChatState() {
    super.loadChatState();
    try {
      this.history = JSON.parse(
        localStorage.getItem('agent-workflow-designer-history') || '[]',
      );
    } catch {
      this.history = [];
    }
  }

  saveChatState() {
    super.saveChatState();
    localStorage.setItem(
      'agent-workflow-designer-history',
      JSON.stringify(this.history),
    );
  }
}

class TestWorkflowCore extends ChatCore {
  loadChatState() {
    super.loadChatState();
    // Ephemeral, do nothing
  }

  saveChatState() {
    super.saveChatState();
    // Ephemeral, do nothing
  }
}

const core = new WorkflowDesignerCore();
const testCore = new TestWorkflowCore();

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

const workflowContainer = getRequiredElement(
  'workflow-container',
  HTMLDivElement,
);

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

export interface WorkflowAgent {
  name: string;
  content: string;
}

export interface ParsedWorkflow {
  orchestrator: string;
  agents: WorkflowAgent[];
}

export let currentWorkflow: ParsedWorkflow | null = null;

export function parseWorkflowMarkdown(text: string): ParsedWorkflow | null {
  // Extract markdown block
  const markdownMatch = text.match(/```markdown\s*([\s\S]*?)\s*```/);
  const markdownContent = markdownMatch ? markdownMatch[1] : text;

  // Find Workflow Driving Prompt
  const orchestratorRegex =
    /#\s*Workflow Driving Prompt\s+([\s\S]*?)(?=#\s*Agent:|$)/i;
  const orchestratorMatch = markdownContent.match(orchestratorRegex);

  if (!orchestratorMatch) {
    return null;
  }

  const orchestrator = orchestratorMatch[1].trim();

  // Find Agents
  const agentRegex = /#\s*Agent:\s*(.+?)\s+([\s\S]*?)(?=#\s*Agent:|$)/gi;
  const agents: WorkflowAgent[] = [];

  let match;
  while ((match = agentRegex.exec(markdownContent)) !== null) {
    agents.push({
      name: match[1].trim(),
      content: match[2].trim(),
    });
  }

  return {
    orchestrator,
    agents,
  };
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

  // Render Orchestrator
  const orchCard = document.createElement('div');
  orchCard.className = 'workflow-card';
  orchCard.innerHTML = `
      <h3>Workflow Driving Prompt</h3>
      <textarea rows="6" readonly>${workflow.orchestrator}</textarea>
      <div class="card-actions">
          <button class="copy-btn" data-type="orchestrator">Copy</button>
          <button class="download-btn" data-type="orchestrator">Download</button>
      </div>
  `;
  workflowContainer.appendChild(orchCard);

  // Render Agents List Header
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
                  <button class="copy-btn" data-type="agent" data-index="${index}">Copy</button>
                  <button class="download-btn" data-type="agent" data-index="${index}">Download</button>
              </div>
          `;
      agentsList.appendChild(agentCard);
    });

    workflowContainer.appendChild(agentsList);
  }

  // Re-bind buttons after rendering
  setupWorkflowCardButtons();
}

let parseAndRenderWorkflow = (text: string) => {
  if (!text) {
    renderWorkflow(null);
    return;
  }
  const parsed = parseWorkflowMarkdown(text);
  renderWorkflow(parsed);
};

// Helper to download text as file
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

// Helper to copy to clipboard
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

function getConcatenatedMarkdown(): string {
  if (!currentWorkflow) return '';

  let md = `# Workflow Driving Prompt\n\n${currentWorkflow.orchestrator}\n\n`;
  for (const agent of currentWorkflow.agents) {
    md += `# Agent: ${agent.name}\n\n${agent.content}\n\n`;
  }
  return md.trim();
}

const copyAllBtn = getRequiredElement('copy-all-btn', HTMLButtonElement);
const downloadAllBtn = getRequiredElement(
  'download-all-btn',
  HTMLButtonElement,
);
const vizStatus = getRequiredElement('viz-status', HTMLSpanElement);

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

function setupWorkflowCardButtons() {
  const copyBtns = document.querySelectorAll('.copy-btn');
  const downloadBtns = document.querySelectorAll('.download-btn');

  copyBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!currentWorkflow) return;
      const target = e.currentTarget;
      if (!(target instanceof HTMLButtonElement)) {
        throw new Error('Event currentTarget is not an HTMLButtonElement');
      }
      const type = target.dataset.type;
      const index = target.dataset.index
        ? parseInt(target.dataset.index, 10)
        : -1;

      if (type === 'orchestrator') {
        copyToClipboard(currentWorkflow.orchestrator, target);
      } else if (type === 'agent' && index >= 0) {
        copyToClipboard(currentWorkflow.agents[index].content, target);
      }
    });
  });

  downloadBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!currentWorkflow) return;
      const target = e.currentTarget;
      if (!(target instanceof HTMLButtonElement)) {
        throw new Error('Event currentTarget is not an HTMLButtonElement');
      }
      const type = target.dataset.type;
      const index = target.dataset.index
        ? parseInt(target.dataset.index, 10)
        : -1;

      if (type === 'orchestrator') {
        downloadFile(
          'workflow-driving-prompt.md',
          currentWorkflow.orchestrator,
        );
      } else if (type === 'agent' && index >= 0) {
        const agent = currentWorkflow.agents[index];
        const safeName = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        downloadFile(`agent-${safeName}.md`, agent.content);
      }
    });
  });
}

// --- Test Chat Events ---
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
  testCore.systemPrompt = `You are simulating the following multi-agent workflow. Behave as the orchestrator and sub-agents as necessary to fulfill the user's request. Always respond directly to the user based on these prompts:\n\n${markdown}`;
  testCore.apiKey = core.apiKey;
  testCore.model = core.model;

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
  const assistantEl = createMessageElement(assistantMsg);
  assistantEl.classList.add('streaming');
  testOutputContainer.appendChild(assistantEl);
  const contentDiv = assistantEl.querySelector('.content');
  if (!(contentDiv instanceof HTMLDivElement)) {
    throw new Error('Content div not found in assistant message element');
  }

  try {
    const generator = testCore.streamCompletion([]);
    for await (const chunk of generator) {
      assistantMsg.content += chunk;
      contentDiv.textContent = assistantMsg.content;
      testOutputContainer.scrollTop = testOutputContainer.scrollHeight;
    }
  } catch (e: any) {
    testStatus.textContent = `Test Chat Error: ${e.message}`;
    testStatus.style.color = 'red';
    assistantMsg.content += `\n[Error: ${e.message}]`;
    contentDiv.textContent = assistantMsg.content;
  } finally {
    assistantEl.classList.remove('streaming');
    testCore.history.push(assistantMsg);
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

    // Attempt to parse JSON response
    let suggestions: string[] = [];
    try {
      // Find JSON array in the text in case there's markdown wrapping
      const match = content.match(/\[[\s\S]*?\]/);
      const jsonStr = match ? match[0] : content;
      suggestions = JSON.parse(jsonStr);
      if (!Array.isArray(suggestions)) throw new Error('Not an array');
    } catch (e) {
      console.warn('Could not parse JSON properly, falling back', e);
      // Fallback: split by newlines if parsing fails
      suggestions = content
        .split('\n')
        .filter((line: string) => line.trim().length > 0);
    }

    evalOutputContainer.innerHTML = '<h3>Suggestions</h3>';
    suggestions.forEach((suggestion) => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn';
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

// --- Initialization ---
function init() {
  setupLLMSettings(llmSettingsContainer, core);

  renderHistory();

  // If there's history, try to parse the last assistant message
  if (core.history.length > 0) {
    const lastAssis = [...core.history]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (lastAssis) {
      parseAndRenderWorkflow(lastAssis.content);
    }
  }
}

// --- Chat Events ---
function createMessageElement(msg: ChatMessage): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  div.dataset.id = msg.id;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.textContent = msg.content;

  const roleLabel = document.createElement('div');
  roleLabel.style.fontWeight = 'bold';
  roleLabel.style.marginBottom = '5px';
  roleLabel.style.textTransform = 'capitalize';
  roleLabel.textContent = msg.role;

  div.appendChild(roleLabel);
  div.appendChild(contentDiv);

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
    parseAndRenderWorkflow(''); // Clear workflow UI
  }
});

sendBtn.addEventListener('click', async () => {
  chatStatus.textContent = '';
  const text = userInputTextarea.value.trim();
  if (!text) return;

  if (!core.apiKey || !core.model) {
    chatStatus.textContent =
      'API Key and Model are required. Please set them in settings.';
    chatStatus.style.color = 'red';
    return;
  }

  const userMsg: ChatMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: text,
  };

  core.history.push(userMsg);
  core.saveChatState();
  renderHistory();
  userInputTextarea.value = '';
  sendBtn.disabled = true;

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

  try {
    const generator = core.streamCompletion([]);
    for await (const chunk of generator) {
      assistantMsg.content += chunk;
      contentDiv.textContent = assistantMsg.content;
      historyContainer.scrollTop = historyContainer.scrollHeight;
    }
  } catch (e: any) {
    chatStatus.textContent = `Chat Error: ${e.message}`;
    chatStatus.style.color = 'red';
    assistantMsg.content += `\n[Error: ${e.message}]`;
    contentDiv.textContent = assistantMsg.content;
  } finally {
    assistantEl.classList.remove('streaming');
    core.history.push(assistantMsg);
    core.saveChatState();
    renderHistory();
    sendBtn.disabled = false;

    // Parse workflow after done streaming
    parseAndRenderWorkflow(assistantMsg.content);
  }
});

// Run init
init();

const importTextarea = getRequiredElement(
  'import-textarea',
  HTMLTextAreaElement,
);
const importBtn = getRequiredElement('import-btn', HTMLButtonElement);
const fixImportBtn = getRequiredElement('fix-import-btn', HTMLButtonElement);
const importStatus = getRequiredElement('import-status', HTMLSpanElement);

function handleImport() {
  importStatus.textContent = '';
  const text = importTextarea.value.trim();
  if (!text) {
    importStatus.textContent = 'Please paste markdown to import.';
    importStatus.style.color = 'red';
    return;
  }

  const parsed = parseWorkflowMarkdown(text);
  if (parsed) {
    renderWorkflow(parsed);
    fixImportBtn.style.display = 'none';

    // Add to chat history as a user importing a state
    const importMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `I am importing an existing workflow:\n\n\`\`\`markdown\n${text}\n\`\`\``,
    };
    core.history.push(importMsg);
    core.saveChatState();
    renderHistory();

    importTextarea.value = '';
    importStatus.textContent = 'Workflow imported successfully!';
    importStatus.style.color = 'green';
  } else {
    importStatus.textContent =
      'Could not parse the markdown automatically. The headers might be malformed. Click "Fix Import with LLM" to use AI to fix the format.';
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

  const fixPrompt = `Please fix the following malformed workflow markdown so it strictly adheres to this format:

\`\`\`markdown
# Workflow Driving Prompt
[Content]

# Agent: [Agent Name 1]
[Content]

# Agent: [Agent Name 2]
[Content]
\`\`\`

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
      }),
    });

    if (!res.ok) throw new Error('Failed to fix import');

    const data = await res.json();
    const fixedText = data.choices[0]?.message?.content;

    if (fixedText) {
      importTextarea.value = fixedText;
      handleImport(); // Attempt import again with the fixed text
    }
  } catch (e: any) {
    importStatus.textContent = `Error fixing import: ${e.message}`;
    importStatus.style.color = 'red';
  } finally {
    fixImportBtn.disabled = false;
    fixImportBtn.textContent = 'Fix Import with LLM';
  }
});

// Export so it can be overwritten in later steps
export { parseAndRenderWorkflow, core, renderHistory, createMessageElement };
