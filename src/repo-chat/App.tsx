import React, { useState, useEffect, useRef } from 'react';
import { RepoChatCore, BUILT_IN_PROMPTS } from './core.js';
import { ChatMessage, SavedPrompt } from '../llm-chat/core.js';
import { getStorage, setStorage } from '../shared/storage.js';

import { PageLayout } from '../shared/components/PageLayout.js';
import { Panel } from '../shared/components/Panel.js';
import { Button } from '../shared/components/Button.js';
import { Input } from '../shared/components/Input.js';
import { TextArea } from '../shared/components/TextArea.js';
import { LlmSettings } from '../shared/components/LlmSettings.js';
import { ChatMessageUI } from '../shared/components/ChatMessageUI.js';

import { askQuestionTool } from '../shared/tools/ask-question.js';

import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

import '../shared/components/styles.css';

// Initialize core once
const core = new RepoChatCore();
core.registerTool(askQuestionTool);
core.loadChatState(); // load states explicitly here as well

export const App: React.FC = () => {
  const [history, setHistory] = useState<ChatMessage[]>([...core.history]);
  const [systemPrompt, setSystemPrompt] = useState<string>(core.systemPrompt);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(
    core.selectedPromptId,
  );
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([
    ...core.savedPrompts,
  ]);
  const [toolsEnabled, setToolsEnabled] = useState<boolean>(core.toolsEnabled);
  const [disabledTools, setDisabledTools] = useState<Set<string>>(
    new Set(core.disabledTools),
  );
  const [userInput, setUserInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [streamingMsg, setStreamingMsg] = useState<ChatMessage | null>(null);

  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/arthow4n/in-browser-tools.git');
  const [clonedWordCount, setClonedWordCount] = useState<number>(core.clonedWordCount);

  // Sync core state to local React state occasionally
  const triggerUpdate = () => {
    setHistory([...core.history]);
  };

  useEffect(() => {
    // When mounted, handle dynamic changes
    setHistory([...core.history]);
    setSystemPrompt(core.systemPrompt);
    setSelectedPromptId(core.selectedPromptId);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));
    setClonedWordCount(core.clonedWordCount);
  }, []);

  const hasChanges = (() => {
    if (!selectedPromptId) return false;
    const builtIn = BUILT_IN_PROMPTS.find((p) => p.id === selectedPromptId);
    if (builtIn) {
      if (
        builtIn.content !== systemPrompt ||
        builtIn.toolsEnabled !== toolsEnabled
      )
        return true;
      const bDisabled = builtIn.disabledTools || [];
      if (bDisabled.length !== disabledTools.size) return true;
      for (const t of bDisabled) {
        if (!disabledTools.has(t)) return true;
      }
      return false;
    }
    const saved = savedPrompts.find((p) => p.id === selectedPromptId);
    if (saved) {
      if (saved.content !== systemPrompt) return true;
      if (
        saved.toolsEnabled !== undefined &&
        saved.toolsEnabled !== toolsEnabled
      )
        return true;
      const sDisabled = saved.disabledTools || [];
      if (sDisabled.length !== disabledTools.size) return true;
      for (const t of sDisabled) {
        if (!disabledTools.has(t)) return true;
      }
      return false;
    }
    return false;
  })();

  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    core.selectedPromptId = id;

    if (id) {
      const builtIn = BUILT_IN_PROMPTS.find((p) => p.id === id);
      if (builtIn) {
        setSystemPrompt(builtIn.content);
        core.systemPrompt = builtIn.content;
        setToolsEnabled(builtIn.toolsEnabled);
        core.toolsEnabled = builtIn.toolsEnabled;
        const newDisabled = new Set(builtIn.disabledTools);
        setDisabledTools(newDisabled);
        core.disabledTools = newDisabled;
      } else {
        const saved = savedPrompts.find((p) => p.id === id);
        if (saved) {
          setSystemPrompt(saved.content);
          core.systemPrompt = saved.content;
          if (saved.toolsEnabled !== undefined) {
            setToolsEnabled(saved.toolsEnabled);
            core.toolsEnabled = saved.toolsEnabled;
          }
          if (saved.disabledTools) {
            const newDisabled = new Set(saved.disabledTools);
            setDisabledTools(newDisabled);
            core.disabledTools = newDisabled;
          }
        }
      }
    }
    core.saveChatState();
  };

  const handleSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setSystemPrompt(e.target.value);
    core.systemPrompt = e.target.value;
    core.saveChatState();
  };

  const handleToolEnableToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setToolsEnabled(checked);
    core.toolsEnabled = checked;
    core.saveChatState();
  };

  const handleToolToggle = (name: string, checked: boolean) => {
    if (checked) {
      disabledTools.delete(name);
    } else {
      disabledTools.add(name);
    }
    const newSet = new Set(disabledTools);
    setDisabledTools(newSet);
    core.disabledTools = newSet;
    core.saveChatState();
  };

  const handleSavePrompt = () => {
    const name = prompt('Enter a name for this prompt:');
    if (name) {
      const id = 'saved-' + Date.now();
      const newPrompt: SavedPrompt = {
        id,
        name,
        content: systemPrompt,
        toolsEnabled,
        disabledTools: Array.from(disabledTools),
      };
      const newPrompts = [...savedPrompts, newPrompt];
      setSavedPrompts(newPrompts);
      core.savedPrompts = newPrompts;
      setSelectedPromptId(id);
      core.selectedPromptId = id;
      core.saveChatState();
    }
  };

  const handleUpdatePrompt = () => {
    if (!selectedPromptId) return;
    const newPrompts = savedPrompts.map((p) => {
      if (p.id === selectedPromptId) {
        return {
          ...p,
          content: systemPrompt,
          toolsEnabled,
          disabledTools: Array.from(disabledTools),
        };
      }
      return p;
    });
    setSavedPrompts(newPrompts);
    core.savedPrompts = newPrompts;
    core.saveChatState();
  };

  const handleDeletePrompt = () => {
    if (!selectedPromptId || BUILT_IN_PROMPTS.find(p => p.id === selectedPromptId)) return;
    if (confirm('Are you sure you want to delete this saved prompt?')) {
      const newPrompts = savedPrompts.filter((p) => p.id !== selectedPromptId);
      setSavedPrompts(newPrompts);
      core.savedPrompts = newPrompts;
      setSelectedPromptId('');
      core.selectedPromptId = '';
      core.saveChatState();
    }
  };

  const { runAction, isLoading: isCloning, statusText: cloneStatusText, isError: cloneIsError } = useAsyncAction();
  const cloneAction = () => runAction('Cloning...', async () => {
    if (!repoUrl) throw new Error('Please enter a repository URL');
    // Using a manual status callback directly for fine-grained updates is tricky with useAsyncAction,
    // so we'll just let cloneRepo run, it might not update the UI string during run but will finish.
    // We can rewrite to have cloneRepo use a callback that sets state.
    await core.cloneRepo(repoUrl, (msg) => {
       // Ideally we'd set status here but it's hard to hook into useAsyncAction midway.
       // Let's just run it.
    });
    await core.seedChatHistory();
    core.saveChatState();
    setHistory([...core.history]);
    setSystemPrompt(core.systemPrompt);
    setClonedWordCount(core.clonedWordCount);
    return 'Cloned and seeded successfully.';
  }, 'Cloned and seeded successfully.');

  const handleRestartChat = () => {
    core.restartChat();
    setHistory([...core.history]);
  };

  const handleClearAll = () => {
    if (window.confirm('Clear entire chat history?')) {
      core.clearAll();
      setHistory([...core.history]);
      setSystemPrompt(core.systemPrompt);
      setClonedWordCount(core.clonedWordCount);
      // reset prompt to default planner
      const defaultPlanner = BUILT_IN_PROMPTS[0];
      setSelectedPromptId(defaultPlanner.id);
      setSystemPrompt(defaultPlanner.content);
      setToolsEnabled(defaultPlanner.toolsEnabled);
      setDisabledTools(new Set(defaultPlanner.disabledTools));
      core.selectedPromptId = defaultPlanner.id;
      core.systemPrompt = defaultPlanner.content;
      core.toolsEnabled = defaultPlanner.toolsEnabled;
      core.disabledTools = new Set(defaultPlanner.disabledTools);
      core.saveChatState();
    }
  };


  const { runAction: runChatAction, isLoading: isChatLoading, statusText: chatStatusText, isError: chatIsError } = useAsyncAction();
  const handleSend = () => runChatAction('Generating...', async () => {
    if (!userInput.trim()) return;

    setIsSending(true);

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: userInput.trim(),
    };

    core.history.push(userMsg);
    core.saveChatState();
    setUserInput('');
    setHistory([...core.history]);

    const doStream = async (assistantMsg: ChatMessage) => {
      setStreamingMsg(assistantMsg);

      const generator = core.streamChatCompletionWithTools([]);

      for await (const chunk of generator) {
        if (chunk.type === 'text' && chunk.text) {
          assistantMsg.content += chunk.text;
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
        }
        setStreamingMsg({ ...assistantMsg }); // force re-render
      }

      setStreamingMsg(null);

      if (
        assistantMsg.content ||
        (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0)
      ) {
        core.history.push(assistantMsg);
      }
      core.saveChatState();
      setHistory([...core.history]);

      if (
        assistantMsg.tool_calls &&
        assistantMsg.tool_calls.length > 0
      ) {
        for (const tc of assistantMsg.tool_calls) {
          const tool = core.tools.find((t) => t.name === tc.function.name);
          let resultStr = '';
          if (!tool) {
            resultStr = `Error: Tool ${tc.function.name} not found.`;
          } else {
            try {
              const args = JSON.parse(tc.function.arguments);
              const result = await tool.execute(args, { toolCallId: tc.id, threadId: core.storagePrefix });
              resultStr =
                typeof result === 'string' ? result : JSON.stringify(result);
            } catch (e: any) {
              resultStr = `Error executing tool: ${e.message}`;
            }
          }

          const toolMsg: ChatMessage = {
            id: 'msg_tool_' + crypto.randomUUID(),
            role: 'tool',
            content: resultStr,
            tool_call_id: tc.id,
          };
          core.history.push(toolMsg);
          core.saveChatState();
          setHistory([...core.history]);
        }

        const nextAssistantMsg: ChatMessage = {
          id: 'msg_' + Date.now(),
          role: 'assistant',
          content: '',
        };
        await doStream(nextAssistantMsg);
      } else {
        setIsSending(false);
      }
    };

    const initialAssistantMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: '',
    };
    await doStream(initialAssistantMsg);
  });

  return (
    <PageLayout>
      <div className="header">
        <h1>Repo Chat</h1>
        <a href="./">← Back to Tools</a>
      </div>

      <LlmSettings core={core} />

      <Panel title="Repository">
        <Input
            label="GitHub Repo URL:"
            type="text"
            id="repo-url"
            placeholder="https://github.com/user/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
        />
        <div className="flex-row" style={{ marginTop: '10px' }}>
          <Button onClick={cloneAction} loading={isCloning} id="clone-btn">
            Clone Repository
          </Button>
          <span
              id="clone-status"
              className="status"
              style={{ color: cloneIsError ? 'red' : 'green' }}
          >
              {cloneStatusText}
          </span>
        </div>
        <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#555' }}>
          {clonedWordCount > 0 ? (
            <span>Repository cloned. Approximately <strong>{clonedWordCount}</strong> words are currently appended to the system prompt.</span>
          ) : (
            <span>Nothing is cloned yet.</span>
          )}
        </div>
      </Panel>

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
      </Panel>

      <Panel title="Chat History">
        <div className="flex-row mb-2">
            <Button id="restart-chat-btn" onClick={handleRestartChat}>
              Restart Chat
            </Button>
            <Button id="clear-all-btn" variant="danger" onClick={handleClearAll}>
              Clear All
            </Button>
        </div>
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

        <TextArea
          id="chat-input"
          placeholder="Type your message here..."
          rows={3}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />

        <div className="flex-row" style={{ marginTop: '10px' }}>
          <Button onClick={handleSend} disabled={isSending} id="send-btn">
            Send
          </Button>
          <span
            id="chat-status"
            className="status"
            style={{ color: chatIsError ? 'red' : 'green' }}
          >
            {chatStatusText}
          </span>
        </div>
      </Panel>
    </PageLayout>
  );
};
