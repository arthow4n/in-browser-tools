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
import { ChatCore, ChatMessage, BUILT_IN_PROMPTS } from './core.js';
import { getStorage, setStorage } from '../shared/storage.js';
import { askQuestionTool } from '../shared/tools/ask-question.js';
import { responseGroundingTool } from '../shared/tools/response-grounding.js';
import { randomTool } from '../shared/tools/random.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

export const App: React.FC = () => {
  const [threads, setThreads] = useState<{ id: string; name: string }[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');

  const coreRef = useRef(new ChatCore('llm-chat-'));
  const core = coreRef.current;

  // Initialize Threads
  useEffect(() => {
    let savedThreads: { id: string; name: string }[] = [];
    try {
      savedThreads = JSON.parse(getStorage('llm-chat-threads') || '[]');
    } catch {
      // ignore
    }

    const startThreadId = crypto.randomUUID();
    const sessionName = `Session ${new Date().toLocaleString()}`;

    if (savedThreads.length === 0) {
      savedThreads = [{ id: startThreadId, name: sessionName }];
      setStorage('llm-chat-activeThreadId', startThreadId);
    } else {
      // ALWAYS default to opening a new thread on load
      const isNewStart = savedThreads.every((t) => t.id !== startThreadId);
      if (isNewStart) {
        savedThreads = [
          ...savedThreads,
          { id: startThreadId, name: sessionName },
        ];
      }
    }

    setThreads(savedThreads);
    setActiveThreadId(startThreadId);
  }, []);

  // Update Core when Active Thread Changes
  useEffect(() => {
    if (!activeThreadId) return;
    core.storagePrefix = `llm-chat-thread-${activeThreadId}-`;
    core.loadChatState();

    setSystemPrompt(core.systemPrompt);
    setSelectedPromptId(core.selectedPromptId);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));

    setStorage('llm-chat-activeThreadId', activeThreadId);
  }, [activeThreadId]);

  const [systemPrompt, setSystemPrompt] = useState(core.systemPrompt);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<
    { id: string; name: string; content: string; toolsEnabled?: boolean; disabledTools?: string[] }[]
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
  const [insertRole, setInsertRole] = useState<'user' | 'assistant' | 'system'>('user');
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


    core.registerTool(askQuestionTool);
    core.registerTool(responseGroundingTool);
    core.registerTool(randomTool);
    core.loadChatState();
    setSystemPrompt(core.systemPrompt);
    setSelectedPromptId(core.selectedPromptId);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));
  }, []);

  const hasChanges = (() => {
    if (!selectedPromptId) return false;
    const builtin = BUILT_IN_PROMPTS.find(p => p.id === selectedPromptId);
    if (builtin) {
      return builtin.content !== systemPrompt || builtin.toolsEnabled !== toolsEnabled || JSON.stringify(builtin.disabledTools.sort()) !== JSON.stringify(Array.from(disabledTools).sort());
    }
    const custom = savedPrompts.find(p => p.id === selectedPromptId);
    if (custom) {
      const customToolsEnabled = custom.toolsEnabled ?? false;
      const customDisabledTools = custom.disabledTools ?? [];
      return custom.content !== systemPrompt || customToolsEnabled !== toolsEnabled || JSON.stringify(customDisabledTools.sort()) !== JSON.stringify(Array.from(disabledTools).sort());
    }
    return false;
  })();

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
    const id = crypto.randomUUID();
    core.savedPrompts.push({
      id,
      name,
      content: core.systemPrompt,
      toolsEnabled: core.toolsEnabled,
      disabledTools: Array.from(core.disabledTools)
    });
    core.selectedPromptId = id;
    core.saveChatState();
    setSavedPrompts([...core.savedPrompts]);
    setSelectedPromptId(id);
  };

  const handleUpdatePrompt = () => {
    if (!selectedPromptId) return;
    const sp = core.savedPrompts.find((p) => p.id === selectedPromptId);
    if (sp) {
      sp.content = core.systemPrompt;
      sp.toolsEnabled = core.toolsEnabled;
      sp.disabledTools = Array.from(core.disabledTools);
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
    }
  };

  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    core.selectedPromptId = id;

    if (!id) {
      core.saveChatState();
      return;
    }

    const builtin = BUILT_IN_PROMPTS.find((p) => p.id === id);
    if (builtin) {
      setSystemPrompt(builtin.content);
      core.systemPrompt = builtin.content;
      setToolsEnabled(builtin.toolsEnabled);
      core.toolsEnabled = builtin.toolsEnabled;
      setDisabledTools(new Set(builtin.disabledTools));
      core.disabledTools = new Set(builtin.disabledTools);
      core.saveChatState();
      return;
    }

    const custom = core.savedPrompts.find((p) => p.id === id);
    if (custom) {
      setSystemPrompt(custom.content);
      core.systemPrompt = custom.content;
      const customToolsEnabled = custom.toolsEnabled ?? false;
      const customDisabledTools = custom.disabledTools ?? [];
      setToolsEnabled(customToolsEnabled);
      core.toolsEnabled = customToolsEnabled;
      setDisabledTools(new Set(customDisabledTools));
      core.disabledTools = new Set(customDisabledTools);
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

  const triggerGeneration = async (currentAssistantMsg?: ChatMessage) => {
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
                const result = await tool.execute(args, { toolCallId: tc.id });
                resultStr =
                  typeof result === 'string' ? result : JSON.stringify(result);
              } catch (e: any) {
                resultStr = `Error executing tool: ${e.message}`;
              }
            }

            const toolMsg: ChatMessage = {
              id: crypto.randomUUID(),
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



    const initialMsg = currentAssistantMsg || {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };
    await doStream(initialMsg);
  };

  const handleRegenerate = async (msgId: string) => {
    const idx = core.history.findIndex((m: any) => m.id === msgId);
    if (idx !== -1) {
      core.history = core.history.slice(0, idx);
      core.saveChatState();
      setHistory([...core.history]);
      await triggerGeneration();
    }
  };

  const handleAddToHistory = () => {
    const text = userInput.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: insertRole,
      content: text,
    };
    core.history.push(userMsg);
    core.saveChatState();
    setHistory([...core.history]);
    setUserInput('');
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
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      };
      core.history.push(userMsg);
      core.saveChatState();
      setHistory([...core.history]);
      setUserInput('');
    }

    const currentSavedThreads = JSON.parse(getStorage('llm-chat-threads') || '[]');
    if (!currentSavedThreads.find((t: any) => t.id === activeThreadId)) {
      const activeThread = threads.find(t => t.id === activeThreadId);
      if (activeThread) {
        setStorage('llm-chat-threads', JSON.stringify([...currentSavedThreads, activeThread]));
      }
    }

    await triggerGeneration();
  };

  return (
    <PageLayout>
      <div className="header">
        <h1>LLM Chat</h1>
      </div>

      <Panel title="Thread Management">
        <div className="flex-row">
          <select
            id="thread-select"
            value={activeThreadId}
            onChange={(e) => setActiveThreadId(e.target.value)}
            style={{ flexGrow: 1, marginRight: '10px', padding: '5px' }}
          >
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button
            id="new-thread-btn"
            onClick={() => {
              const newThreadId = crypto.randomUUID();
              const newThreads = [
                ...threads,
                { id: newThreadId, name: `Session ${new Date().toLocaleString()}` },
              ];
              setThreads(newThreads);
              setActiveThreadId(newThreadId);
            }}
          >
            New Thread
          </Button>
          <Button
            id="rename-thread-btn"
            onClick={() => {
              const currentName =
                threads.find((t) => t.id === activeThreadId)?.name || '';
              const newName = prompt('Enter new thread name:', currentName);
              if (newName && newName.trim()) {
                const newThreads = threads.map((t) =>
                  t.id === activeThreadId ? { ...t, name: newName.trim() } : t,
                );
                setThreads(newThreads);
                setStorage('llm-chat-threads', JSON.stringify(newThreads));
              }
            }}
          >
            Rename
          </Button>
          <Button
            id="delete-thread-btn"
            variant="danger"
            disabled={threads.length <= 1}
            onClick={() => {
              if (confirm('Are you sure you want to delete this thread?')) {
                const newThreads = threads.filter(
                  (t) => t.id !== activeThreadId,
                );
                setThreads(newThreads);
                setStorage('llm-chat-threads', JSON.stringify(newThreads));
                setActiveThreadId(newThreads[0].id);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Panel>

      <LlmSettings core={core} />



      <Panel title="System Prompt">
        <div className="flex-row" style={{ marginBottom: '10px' }}>
          <select
            id="saved-prompts-select"
            value={selectedPromptId}
            onChange={handlePromptSelect}
            style={{ minWidth: '200px' }}
          >
            <option value="">-- No Prompt Selected --</option>
            <optgroup label="--- Built-in ---">
              {BUILT_IN_PROMPTS.map((bp) => (
                <option key={bp.id} value={bp.id}>
                  {bp.name}
                </option>
              ))}
            </optgroup>
            {savedPrompts.length > 0 && (
              <optgroup label="--- Custom ---">
                {savedPrompts.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {selectedPromptId && hasChanges && (
            <span style={{ color: '#d97706', marginLeft: '10px', fontWeight: 'bold' }}>
              ⚠️ Unsaved changes (Click Save to persist changes to this prompt slot)
            </span>
          )}
        </div>

        <TextArea
          id="system-prompt"
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          rows={4}
        />

        <div className="flex-row" style={{ marginTop: '10px', marginBottom: '10px' }}>
          <Input
            type="checkbox"
            id="enable-tools-checkbox"
            label="Enable Tools"
            checked={toolsEnabled}
            onChange={handleToolEnableToggle}
            containerStyle={{ marginRight: '15px' }}
          />
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
              <Input
                key={tool.name}
                type="checkbox"
                label={`${tool.name}: ${tool.description}`}
                checked={!disabledTools.has(tool.name)}
                onChange={(e) => handleToolToggle(tool.name, e.target.checked)}
                style={{
                  fontWeight: 'normal',
                  fontSize: '0.9em',
                }}
              />
            ))}
          </div>
        )}

        <div className="flex-row" style={{ marginTop: '10px' }}>
          {selectedPromptId && !BUILT_IN_PROMPTS.find(p => p.id === selectedPromptId) && (
            <Button onClick={handleUpdatePrompt} id="update-prompt-btn">
              Save
            </Button>
          )}
          <Button onClick={handleSavePrompt} id="save-prompt-btn">
            Save As New...
          </Button>
          {selectedPromptId && !BUILT_IN_PROMPTS.find(p => p.id === selectedPromptId) && (
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
            <ChatMessageUI onRegenerate={handleRegenerate}
              key={msg.id}
              msg={msg}
              core={core}
              onUpdate={triggerUpdate}
            />
          ))}
          {streamingMsg && (
            <ChatMessageUI onRegenerate={handleRegenerate}
              msg={streamingMsg}
              core={core}
              onUpdate={triggerUpdate}
              isStreaming={true}
            />
          )}
        </div>

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
          <select
            id="insert-role-select"
            value={insertRole}
            onChange={(e) => setInsertRole(e.target.value as 'user' | 'assistant' | 'system')}
            style={{ marginRight: '10px', marginLeft: '10px', padding: '5px' }}
          >
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
            <option value="system">System</option>
          </select>
          <Button onClick={handleAddToHistory} id="add-history-btn">
            Add to History
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
