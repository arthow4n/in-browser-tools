import React, { useState, useEffect, useRef } from 'react';
import {
  PageLayout,
  Panel,
  Button,
  Input,
  TextArea,
  LlmSettings,
  ChatMessageUI,
} from '../shared/components/index.js';
import { ChatCore, ChatMessage } from './core.js';
import { browserAlertTool } from './tools/browser-alert.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

export const App: React.FC = () => {
  const coreRef = useRef(new ChatCore());
  const core = coreRef.current;

  const [systemPrompt, setSystemPrompt] = useState(core.systemPrompt);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<
    { id: string; name: string; content: string }[]
  >([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [toolsEnabled, setToolsEnabled] = useState(core.toolsEnabled);
  const [disabledTools, setDisabledTools] = useState<Set<string>>(
    new Set(core.disabledTools),
  );

  const [promptIntention, setPromptIntention] = useState('');
  const [promptHowToImprove, setPromptHowToImprove] = useState('');
  const [promptEvaluationFocus, setPromptEvaluationFocus] = useState('');

  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatStatus, setChatStatus] = useState({ text: '', isError: false });

  const {
    isLoading: isImproving,
    statusText: improveStatusText,
    isError: improveIsError,
    runAction: runImproveAction,
  } = useAsyncAction();

  // Streaming assistant message state
  const [streamingMsg, setStreamingMsg] = useState<ChatMessage | null>(null);

  useEffect(() => {
    core.registerTool(browserAlertTool);
    core.loadChatState();
    setSystemPrompt(core.systemPrompt);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));
  }, []);

  const handleSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setSystemPrompt(e.target.value);
    core.systemPrompt = e.target.value;
    core.saveChatState();
  };

  const handleImprovePrompt = async () => {
    await runImproveAction('Improving...', async () => {
      if (!core.apiKey || !core.model) {
        throw new Error('API Key and Model are required to improve prompt.');
      }
      const improved = await core.improveSystemPrompt(
        promptIntention,
        promptHowToImprove,
        promptEvaluationFocus,
      );
      setSystemPrompt(improved);
      core.systemPrompt = improved;
      core.saveChatState();
    });
  };

  const handleSavePrompt = () => {
    const name = prompt('Enter a name for this system prompt:');
    if (!name) return;
    const id = Date.now().toString();
    core.savedPrompts.push({ id, name, content: core.systemPrompt });
    core.saveChatState();
    setSavedPrompts([...core.savedPrompts]);
    setSelectedPromptId(id);
  };

  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    if (!id) return;
    const sp = core.savedPrompts.find((p) => p.id === id);
    if (sp) {
      setSystemPrompt(sp.content);
      core.systemPrompt = sp.content;
      core.saveChatState();
    }
  };

  const handleDeletePrompt = () => {
    if (!selectedPromptId) return;
    if (confirm('Delete this saved prompt?')) {
      core.savedPrompts = core.savedPrompts.filter(
        (p) => p.id !== selectedPromptId,
      );
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
      setSelectedPromptId('');
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear entire chat history?')) {
      core.history = [];
      core.saveChatState();
      setHistory([]);
    }
  };

  const handleToolEnableToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setToolsEnabled(checked);
    core.toolsEnabled = checked;
    core.saveChatState();
  };

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    core.setToolEnabled(toolName, enabled);
    core.saveChatState();
    setDisabledTools(new Set(core.disabledTools));
  };

  const triggerUpdate = () => {
    setHistory([...core.history]);
  };

  const handleSend = async () => {
    const text = userInput.trim();
    if (!text && core.history.length === 0) return;

    if (!core.apiKey || !core.model) {
      setChatStatus({ text: 'API Key and Model are required.', isError: true });
      return;
    }

    if (text) {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
      };
      core.history.push(userMsg);
      core.saveChatState();
      setHistory([...core.history]);
      setUserInput('');
    }

    setIsSending(true);
    setChatStatus({ text: '', isError: false });

    const doStream = async (currentAssistantMsg: ChatMessage) => {
      setStreamingMsg(currentAssistantMsg);

      try {
        const generator = core.streamChatCompletionWithTools([]);
        for await (const chunk of generator) {
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
          setStreamingMsg({ ...currentAssistantMsg }); // Force re-render
        }
      } catch (e: any) {
        setChatStatus({ text: `Chat Error: ${e.message}`, isError: true });
        currentAssistantMsg.content += `\n[Error: ${e.message}]`;
        setStreamingMsg({ ...currentAssistantMsg });
      } finally {
        setStreamingMsg(null);
        if (
          currentAssistantMsg.content ||
          (currentAssistantMsg.tool_calls &&
            currentAssistantMsg.tool_calls.length > 0)
        ) {
          core.history.push(currentAssistantMsg);
        }
        core.saveChatState();
        setHistory([...core.history]);

        if (
          currentAssistantMsg.tool_calls &&
          currentAssistantMsg.tool_calls.length > 0
        ) {
          for (const tc of currentAssistantMsg.tool_calls) {
            const tool = core.tools.find((t) => t.name === tc.function.name);
            let resultStr = '';
            if (!tool) {
              resultStr = `Error: Tool ${tc.function.name} not found.`;
            } else {
              try {
                const args = JSON.parse(tc.function.arguments);
                const result = await tool.execute(args);
                resultStr =
                  typeof result === 'string' ? result : JSON.stringify(result);
              } catch (e: any) {
                resultStr = `Error executing tool: ${e.message}`;
              }
            }

            const toolMsg: ChatMessage = {
              id: Date.now().toString() + Math.random().toString(),
              role: 'tool',
              content: resultStr,
              tool_call_id: tc.id,
            };
            core.history.push(toolMsg);
            core.saveChatState();
            setHistory([...core.history]);
          }

          const nextAssistantMsg: ChatMessage = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: '',
          };
          await doStream(nextAssistantMsg);
        } else {
          setIsSending(false);
        }
      }
    };

    const initialAssistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };
    await doStream(initialAssistantMsg);
  };

  return (
    <PageLayout>
      <div className="header">
        <h1>LLM Chat</h1>
      </div>

      <LlmSettings core={core} />

      <Panel title="System Prompt">
        <TextArea
          id="system-prompt"
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          rows={4}
        />

        <div className="flex-row" style={{ marginTop: '10px' }}>
          <select
            id="saved-prompts-select"
            value={selectedPromptId}
            onChange={handlePromptSelect}
          >
            <option value="">-- Load Saved Prompt --</option>
            {savedPrompts.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
          <Button onClick={handleSavePrompt} id="save-prompt-btn">
            Save Current As...
          </Button>
          {selectedPromptId && (
            <Button
              variant="danger"
              onClick={handleDeletePrompt}
              id="delete-prompt-btn"
            >
              Delete
            </Button>
          )}
        </div>

        <details
          style={{
            marginTop: '10px',
            background: '#f9f9f9',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Prompt Improver (Auto-generate better prompt)
          </summary>
          <div style={{ marginTop: '10px' }}>
            <Input
              label="Intention (Optional):"
              type="text"
              placeholder="What is the goal of this prompt?"
              value={promptIntention}
              onChange={(e) => setPromptIntention(e.target.value)}
            />
            <Input
              label="How to improve (Optional):"
              type="text"
              placeholder="e.g. Make it more professional"
              value={promptHowToImprove}
              onChange={(e) => setPromptHowToImprove(e.target.value)}
            />
            <Input
              label="Evaluation Focus (Optional):"
              type="text"
              placeholder="What to verify?"
              value={promptEvaluationFocus}
              onChange={(e) => setPromptEvaluationFocus(e.target.value)}
            />
            <Button
              onClick={handleImprovePrompt}
              loading={isImproving}
              id="improve-prompt-btn"
            >
              Improve System Prompt
            </Button>
            <span
              id="improve-prompt-status"
              className="status"
              style={{ color: improveIsError ? 'red' : 'green' }}
            >
              {improveStatusText}
            </span>
          </div>
        </details>
      </Panel>

      <Panel title="Chat History">
        <div
          id="history-container"
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            marginBottom: '15px',
            border: '1px solid #ccc',
            padding: '10px',
            borderRadius: '4px',
            background: '#fafafa',
          }}
        >
          {history.map((msg) => (
            <ChatMessageUI
              key={msg.id}
              msg={msg}
              core={core}
              onUpdate={triggerUpdate}
            />
          ))}
          {streamingMsg && (
            <ChatMessageUI
              msg={streamingMsg}
              core={core}
              onUpdate={triggerUpdate}
              isStreaming={true}
            />
          )}
        </div>

        <div className="flex-row">
          <label className="checkbox-label" style={{ marginRight: '15px' }}>
            <input
              type="checkbox"
              id="enable-tools-checkbox"
              checked={toolsEnabled}
              onChange={handleToolEnableToggle}
            />
            Enable Tools
          </label>
        </div>

        {toolsEnabled && (
          <div
            id="tool-list-container"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              padding: '10px',
              background: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '10px',
            }}
          >
            {core.tools.map((tool) => (
              <label
                key={tool.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 'normal',
                  fontSize: '0.9em',
                }}
              >
                <input
                  type="checkbox"
                  checked={!disabledTools.has(tool.name)}
                  onChange={(e) =>
                    handleToolToggle(tool.name, e.target.checked)
                  }
                />
                {tool.name}: {tool.description}
              </label>
            ))}
          </div>
        )}

        <TextArea
          id="user-input"
          placeholder="Type your message here..."
          rows={3}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />

        <div className="flex-row" style={{ marginTop: '10px' }}>
          <Button onClick={handleSend} disabled={isSending} id="send-btn">
            Send
          </Button>
          <Button
            variant="danger"
            onClick={handleClearHistory}
            id="clear-history-btn"
          >
            Clear History
          </Button>
          <span
            id="chat-status"
            className="status"
            style={{ color: chatStatus.isError ? 'red' : 'green' }}
          >
            {chatStatus.text}
          </span>
        </div>
      </Panel>
    </PageLayout>
  );
};
