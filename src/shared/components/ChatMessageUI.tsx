import React, { useState } from 'react';
import { ChatMessage } from '../llm-core.js';
import { ChatCore } from '../../llm-chat/core.js';
import { Input } from './Input.js';
import { TextArea } from './TextArea.js';
import { Button } from './Button.js';

interface ChatMessageUIProps {
  msg: ChatMessage & { id?: string };
  core: any; // We can type this to ChatCore if we expose a shared interface that provides streamChatCompletionWithTools
  onUpdate: () => void;
  isStreaming?: boolean;
}

export const ChatMessageUI: React.FC<ChatMessageUIProps> = ({
  msg,
  core,
  onUpdate,
  isStreaming,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);

  const [showImprove, setShowImprove] = useState(false);
  const [improveInstructions, setImproveInstructions] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [improveError, setImproveError] = useState('');

  let displayContent = msg.content;
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    displayContent += '\n\n**Tool Calls:**\n';
    for (const tc of msg.tool_calls) {
      displayContent += `- ${tc.function.name}(${tc.function.arguments})\n`;
    }
  }

  const handleEdit = () => {
    if (isEditing) {
      msg.content = editContent;
      if (core.saveChatState) core.saveChatState();
      setIsEditing(false);
      onUpdate();
    } else {
      setEditContent(msg.content);
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      core.history = core.history.filter((m: any) => m.id !== msg.id);
      if (core.saveChatState) core.saveChatState();
      onUpdate();
    }
  };

  const handleDeleteBelow = () => {
    if (confirm('Delete this message and all messages below it?')) {
      const idx = core.history.findIndex((m: any) => m.id === msg.id);
      if (idx !== -1) {
        core.history = core.history.slice(0, idx);
        if (core.saveChatState) core.saveChatState();
        onUpdate();
      }
    }
  };

  const doImprove = async () => {
    const prompt =
      'Please improve the following message to be more detailed. Original Message:\n' +
      msg.content +
      (improveInstructions ? '\n\nInstructions:\n' + improveInstructions : '');
    setIsImproving(true);
    setImproveError('');
    msg.content = ''; // Clear for streaming

    try {
      const generator = core.streamChatCompletionWithTools([
        {
          id: Date.now().toString(),
          role: 'user',
          content: prompt,
        },
      ]);

      for await (const chunk of generator) {
        if (chunk.type === 'text' && chunk.text) {
          msg.content += chunk.text;
          // Force re-render during streaming can be tricky without global state,
          // but we can call onUpdate here to trigger a re-render from the parent.
          // Note: for performance, it might be better to manage streaming state in the parent.
          onUpdate();
        }
      }
      if (core.saveChatState) core.saveChatState();
      setShowImprove(false);
    } catch (e: any) {
      setImproveError(e.message);
      msg.content += `\n[Improve Error: ${e.message}]`;
    } finally {
      setIsImproving(false);
      onUpdate();
    }
  };

  return (
    <div
      className={`message ${msg.role} ${isStreaming ? 'streaming' : ''}`}
      data-id={msg.id}
    >
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: '5px',
          textTransform: 'capitalize',
        }}
      >
        {msg.role}
      </div>

      {isEditing ? (
        <TextArea
          rows={4}
          style={{ width: '100%' }}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
        />
      ) : (
        <div className="content" style={{ whiteSpace: 'pre-wrap' }}>
          {displayContent}
        </div>
      )}

      <div className="message-controls" style={{ marginTop: '10px' }}>
        <Button
          variant="secondary"
          onClick={() => setShowImprove(!showImprove)}
        >
          Improve
        </Button>
        <Button variant="secondary" onClick={handleEdit}>
          {isEditing ? 'Save' : 'Edit'}
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
        <Button variant="danger" onClick={handleDeleteBelow}>
          Delete ↓
        </Button>
      </div>

      {showImprove && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
          }}
        >
          <Input
            type="text"
            placeholder="Optional Instructions (e.g. Make it more professional)"
            style={{
              width: '100%',
              marginBottom: '10px',
              padding: '5px',
              boxSizing: 'border-box',
            }}
            value={improveInstructions}
            onChange={(e) => setImproveInstructions(e.target.value)}
          />
          <Button disabled={isImproving} onClick={doImprove}>
            Improve / Regenerate
          </Button>
          <Button
            variant="secondary"
            disabled={isImproving}
            onClick={() => setShowImprove(false)}
          >
            Cancel
          </Button>
          {isImproving && (
            <span style={{ fontWeight: 'bold', marginLeft: '10px' }}>
              Improving...
            </span>
          )}
          {improveError && (
            <span
              style={{ fontWeight: 'bold', marginLeft: '10px', color: 'red' }}
            >
              Error: {improveError}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
