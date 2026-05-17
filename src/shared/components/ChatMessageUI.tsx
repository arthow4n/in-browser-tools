import React, { useState } from 'react';
import { ChatMessage } from '../llm-core.js';
import { ChatCore } from '../../llm-chat/core.js';
import { Input } from './Input.js';
import { TextArea } from './TextArea.js';
import { Button } from './Button.js';
import { ToolCallMessageUI } from './ToolCallMessageUI.js';
import { Wand2, Edit2, RefreshCw, Trash2, ArrowDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageUIProps {
  msg: ChatMessage & { id?: string };
  core: any; // We can type this to ChatCore if we expose a shared interface that provides streamChatCompletionWithTools
  onUpdate: () => void;
  onRegenerate?: (msgId: string) => void;
  isStreaming?: boolean;
}

export const ChatMessageUI: React.FC<ChatMessageUIProps> = ({
  msg,
  core,
  onUpdate,
  onRegenerate,
  isStreaming,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);

  const [showImprove, setShowImprove] = useState(false);
  const [improveInstructions, setImproveInstructions] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [improveError, setImproveError] = useState('');

  let displayContent = msg.content;
  const renderMarkdown = core?.providerPrefs?.renderMarkdown ?? true;

  // Determine if this is a tool result that should be hidden
  let hideDetails = false;
  let toolCallName = 'Tool Result';
  if (msg.role === 'tool' && core?.history && msg.tool_call_id) {
    const originMsg = core.history.find((m: any) =>
      m.tool_calls?.some((tc: any) => tc.id === msg.tool_call_id),
    );
    if (originMsg) {
      const tc = originMsg.tool_calls.find(
        (t: any) => t.id === msg.tool_call_id,
      );
      if (tc) {
        toolCallName = `Tool Result: ${tc.function.name}`;
        try {
          const args = JSON.parse(tc.function.arguments);
          hideDetails = args.hide_details === true;
        } catch (e) {
          // Ignore
        }
      }
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
          id: crypto.randomUUID(),
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
      ) : hideDetails ? (
        <details
          style={{
            marginTop: '10px',
            padding: '5px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#f9f9f9',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            {toolCallName}
          </summary>
          <div style={{ marginTop: '10px' }}>
            {renderMarkdown ? (
              <div className="content markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="content" style={{ whiteSpace: 'pre-wrap' }}>
                {displayContent}
              </div>
            )}
          </div>
        </details>
      ) : renderMarkdown ? (
        <div className="content markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="content" style={{ whiteSpace: 'pre-wrap' }}>
          {displayContent}
        </div>
      )}

      {msg.tool_calls && msg.tool_calls.length > 0 && (
        <div className="tool-calls" style={{ marginTop: '10px' }}>
          {msg.tool_calls.map((tc: any, idx: number) => (
            <ToolCallMessageUI key={tc.id || idx} toolCall={tc} />
          ))}
        </div>
      )}

      <div
        className="message-controls"
        style={{ marginTop: '10px', display: 'flex', gap: '5px' }}
      >
        <button
          onClick={() => setShowImprove(!showImprove)}
          title="Improve"
          style={{
            background: 'transparent',
            padding: '4px',
            color: 'inherit',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Wand2 size={16} />
        </button>
        <button
          onClick={handleEdit}
          title={isEditing ? 'Save' : 'Edit'}
          style={{
            background: 'transparent',
            padding: '4px',
            color: 'inherit',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Edit2 size={16} />
        </button>
        {onRegenerate && msg.id && (
          <button
            onClick={() => onRegenerate(msg.id!)}
            title="Regenerate"
            style={{
              background: 'transparent',
              padding: '4px',
              color: 'inherit',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={16} />
          </button>
        )}
        <button
          onClick={handleDelete}
          title="Delete"
          style={{
            background: 'transparent',
            padding: '4px',
            color: 'inherit',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Trash2 size={16} />
        </button>
        <button
          onClick={handleDeleteBelow}
          title="Delete Below"
          style={{
            background: 'transparent',
            padding: '4px',
            color: 'inherit',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowDown size={16} />
        </button>
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
