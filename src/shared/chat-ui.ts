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

  const improveBtn = document.createElement('button');
  improveBtn.textContent = 'Improve';

  controls.appendChild(improveBtn);
  controls.appendChild(editBtn);
  controls.appendChild(deleteBtn);
  controls.appendChild(deleteBelowBtn);

  div.appendChild(roleLabel);
  div.appendChild(contentDiv);
  div.appendChild(controls);

  // Improve logic
  const improveControls = document.createElement('div');
  improveControls.style.display = 'none';
  improveControls.style.marginTop = '10px';
  improveControls.style.padding = '10px';
  improveControls.style.border = '1px solid #ccc';
  improveControls.style.borderRadius = '5px';

  const instructionsInput = document.createElement('input');
  instructionsInput.type = 'text';
  instructionsInput.placeholder = 'Optional Instructions (e.g. Make it more professional)';
  instructionsInput.style.width = '100%';
  instructionsInput.style.marginBottom = '10px';
  instructionsInput.style.padding = '5px';
  instructionsInput.style.boxSizing = 'border-box';

  const doImproveBtn = document.createElement('button');
  doImproveBtn.textContent = 'Improve / Regenerate';
  doImproveBtn.style.marginRight = '5px';

  const cancelImproveBtn = document.createElement('button');
  cancelImproveBtn.textContent = 'Cancel';
  cancelImproveBtn.style.marginRight = '5px';

  const improveStatus = document.createElement('span');
  improveStatus.style.fontWeight = 'bold';

  improveControls.appendChild(instructionsInput);
  improveControls.appendChild(doImproveBtn);
  improveControls.appendChild(cancelImproveBtn);
  improveControls.appendChild(improveStatus);

  div.appendChild(improveControls);

  improveBtn.addEventListener('click', () => {
    improveControls.style.display = improveControls.style.display === 'none' ? 'block' : 'none';
  });

  cancelImproveBtn.addEventListener('click', () => {
    improveControls.style.display = 'none';
  });

  doImproveBtn.addEventListener('click', async () => {
    const instructions = instructionsInput.value.trim();
    const originalContent = msg.content;
    const prompt = 'Please improve the following message to be more detailed. Original Message:\n' + originalContent + (instructions ? '\n\nInstructions:\n' + instructions : '');

    doImproveBtn.disabled = true;
    improveStatus.textContent = 'Improving...';
    improveStatus.style.color = 'black';

    msg.content = '';
    contentDiv.textContent = '';

    try {
      // @ts-ignore
      const generator = core.streamChatCompletionWithTools([{
        id: Date.now().toString(),
        role: 'user',
        content: prompt
      }]);

      for await (const chunk of generator) {
        if (chunk.type === 'text' && chunk.text) {
          msg.content += chunk.text;
          contentDiv.textContent = msg.content;

          // auto scroll if possible
          const historyContainer = div.parentElement;
          if (historyContainer) {
            historyContainer.scrollTop = historyContainer.scrollHeight;
          }
        }
      }

      if (core.saveChatState) core.saveChatState();
      renderHistory();
      improveControls.style.display = 'none';
    } catch (e: any) {
      improveStatus.textContent = `Error: ${e.message}`;
      improveStatus.style.color = 'red';
      msg.content = originalContent + `\n[Improve Error: ${e.message}]`;
      contentDiv.textContent = msg.content;
    } finally {
      doImproveBtn.disabled = false;
      if (improveStatus.textContent === 'Improving...') {
          improveStatus.textContent = '';
      }
    }
  });

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
