import { ChatMessage, LLMCore } from './llm-core.js';
import { ChatCore } from '../llm-chat/core.js';

export function createMessageElement(
  msg: ChatMessage,
  core: ChatCore | any,
  renderHistory: () => void,
): HTMLDivElement {
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
      if (core.saveChatState) core.saveChatState();
    }
  });

  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this message?')) {
      core.history = core.history.filter((m: any) => m.id !== msg.id);
      if (core.saveChatState) core.saveChatState();
      renderHistory();
    }
  });

  deleteBelowBtn.addEventListener('click', () => {
    if (confirm('Delete this message and all messages below it?')) {
      const idx = core.history.findIndex((m: any) => m.id === msg.id);
      if (idx !== -1) {
        core.history = core.history.slice(0, idx);
        if (core.saveChatState) core.saveChatState();
        renderHistory();
      }
    }
  });

  return div;
}
