import React, { useState, useEffect, useRef } from 'react';
import {
  PageLayout,
  Panel,
  Button,
  Input,
  TextArea,
  LlmSettings,
  ChatMessageUI,
  SystemPromptManager,
} from '../shared/components/index.js';
import { ChatCore, ChatMessage, BUILT_IN_PROMPTS } from './core.js';
import { getStorage, setStorage } from '../shared/storage.js';
import { askQuestionTool } from '../shared/tools/ask-question.js';
import { randomTool } from '../shared/tools/random.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';
import { useChatGenerator } from '../shared/hooks/useChatGenerator.js';

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

    setHistory([...core.history]);

    setStorage('llm-chat-activeThreadId', activeThreadId);
  }, [activeThreadId]);

  const [history, setHistory] = useState<ChatMessage[]>([]);

  const [promptIntention, setPromptIntention] = useState('');
  const [promptHowToImprove, setPromptHowToImprove] = useState('');
  const [promptEvaluationFocus, setPromptEvaluationFocus] = useState('');

  const [userInput, setUserInput] = useState('');
  const [insertRole, setInsertRole] = useState<'user' | 'assistant' | 'system'>(
    'user',
  );

  const {
    isLoading: isImproving,
    statusText: improveStatusText,
    isError: improveIsError,
    runAction: runImproveAction,
  } = useAsyncAction();

  const triggerUpdate = () => {
    setHistory([...core.history]);
  };

  const {
    isSending,
    streamingMsg,
    chatStatusText,
    chatIsError,
    triggerGeneration,
    abortGeneration,
  } = useChatGenerator(core, triggerUpdate);

  useEffect(() => {
    core.registerTool(askQuestionTool);
    core.registerTool(randomTool);
    core.loadChatState();
    setHistory([...core.history]);
  }, []);

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
      core.systemPrompt = improved;
      core.saveChatState();
      // To trigger a re-render in SystemPromptManager, we might need a signal,
      // but modifying core directly will update it if we trigger a re-render in App.
      // Easiest is to force a re-render here.
      setPromptIntention(promptIntention); // No-op to trigger re-render if needed
    });
  };

  const handleClearHistory = () => {
    if (confirm('Clear entire chat history?')) {
      core.history = [];
      core.saveChatState();
      setHistory([]);
    }
  };

  const handleReanswer = async (toolCallId: string) => {
    const msgIdx = core.history.findIndex(
      (m: any) =>
        m.role === 'assistant' &&
        m.tool_calls &&
        m.tool_calls.some((tc: any) => tc.id === toolCallId),
    );
    if (msgIdx !== -1) {
      const assistantMsg = core.history[msgIdx];
      const toolCall = assistantMsg.tool_calls!.find((tc: any) => tc.id === toolCallId);

      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(toolCall!.function.arguments);
      } catch (e) {
        // ignore
      }

      const w = window as any;
      if (!w.pendingAskQuestions) {
        w.pendingAskQuestions = {};
      }

      w.pendingAskQuestions[toolCallId] = {
        questions: parsedArgs.questions || [],
        resolve: async (answers: any[]) => {
          const toolResultIdx = core.history.findIndex(
            (m: any) => m.role === 'tool' && m.tool_call_id === toolCallId
          );

          if (toolResultIdx !== -1) {
            core.history = core.history.slice(0, toolResultIdx);
          } else {
            // Fallback, should not happen normally if the tool result exists
            const nextIdx = msgIdx + 1;
            core.history = core.history.slice(0, nextIdx);
          }

          const toolMsg: ChatMessage = {
            id: 'msg_tool_' + crypto.randomUUID(),
            role: 'tool',
            content: JSON.stringify(answers),
            tool_call_id: toolCallId,
          };

          core.history.push(toolMsg);
          core.saveChatState();
          setHistory([...core.history]);
          await triggerGeneration();
        },
      };

      window.dispatchEvent(
        new CustomEvent('askQuestionUpdate', {
          detail: { toolCallId },
        })
      );
    }
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
      alert('API Key and Model are required.');
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

    const currentSavedThreads = JSON.parse(
      getStorage('llm-chat-threads') || '[]',
    );
    if (!currentSavedThreads.find((t: any) => t.id === activeThreadId)) {
      const activeThread = threads.find((t) => t.id === activeThreadId);
      if (activeThread) {
        setStorage(
          'llm-chat-threads',
          JSON.stringify([...currentSavedThreads, activeThread]),
        );
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
                {
                  id: newThreadId,
                  name: `Session ${new Date().toLocaleString()}`,
                },
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

      <SystemPromptManager core={core} builtInPrompts={BUILT_IN_PROMPTS}>
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
      </SystemPromptManager>

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
              onRegenerate={handleRegenerate}
              key={msg.id}
              msg={msg}
              core={core}
              onUpdate={triggerUpdate}
              disabled={isSending}
              onReanswer={handleReanswer}
            />
          ))}
          {streamingMsg && (
            <ChatMessageUI
              onRegenerate={handleRegenerate}
              msg={streamingMsg}
              core={core}
              onUpdate={triggerUpdate}
              isStreaming={true}
              disabled={isSending}
              onReanswer={handleReanswer}
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
          {isSending && (
            <Button
              variant="danger"
              onClick={() => abortGeneration()}
              id="cancel-btn"
            >
              Cancel
            </Button>
          )}
          <select
            id="insert-role-select"
            value={insertRole}
            onChange={(e) =>
              setInsertRole(e.target.value as 'user' | 'assistant' | 'system')
            }
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
            style={{ color: chatIsError ? 'red' : 'green' }}
          >
            {chatStatusText}
          </span>
        </div>
      </Panel>
    </PageLayout>
  );
};
