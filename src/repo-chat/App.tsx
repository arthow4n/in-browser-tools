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
import { SystemPromptManager } from '../shared/components/SystemPromptManager.js';

import { askQuestionTool } from '../shared/tools/ask-question.js';

import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';
import { useChatGenerator } from '../shared/hooks/useChatGenerator.js';

import '../shared/components/styles.css';

// Initialize core once
const core = new RepoChatCore();
core.registerTool(askQuestionTool);
core.loadChatState(); // load states explicitly here as well

export const App: React.FC = () => {
  const [history, setHistory] = useState<ChatMessage[]>([...core.history]);
  const [userInput, setUserInput] = useState<string>('');

  const [repoUrl, setRepoUrl] = useState<string>(
    'https://github.com/arthow4n/in-browser-tools.git',
  );
  const [clonedWordCount, setClonedWordCount] = useState<number>(
    core.clonedWordCount,
  );

  // Sync core state to local React state occasionally
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
    // When mounted, handle dynamic changes
    setHistory([...core.history]);
    setClonedWordCount(core.clonedWordCount);
  }, []);

  const {
    runAction,
    isLoading: isCloning,
    statusText: cloneStatusText,
    isError: cloneIsError,
  } = useAsyncAction();
  const cloneAction = () =>
    runAction(
      'Cloning...',
      async () => {
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
        setClonedWordCount(core.clonedWordCount);
        return 'Cloned and seeded successfully.';
      },
      'Cloned and seeded successfully.',
    );

  const handleRestartChat = () => {
    core.restartChat();
    setHistory([...core.history]);
  };

  const handleClearAll = () => {
    if (window.confirm('Clear entire chat history?')) {
      core.clearAll();
      setHistory([...core.history]);
      setClonedWordCount(core.clonedWordCount);
      // reset prompt to default planner
      const defaultPlanner = BUILT_IN_PROMPTS[0];
      core.selectedPromptId = defaultPlanner.id;
      core.systemPrompt = defaultPlanner.content;
      core.toolsEnabled = defaultPlanner.toolsEnabled;
      core.disabledTools = new Set(defaultPlanner.disabledTools);
      core.saveChatState();
    }
  };

  const handleSend = async () => {
    if (!userInput.trim()) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: userInput.trim(),
    };

    core.history.push(userMsg);
    core.saveChatState();
    setUserInput('');
    setHistory([...core.history]);

    await triggerGeneration();
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
            // Fallback
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
            <span>
              Repository cloned. Approximately{' '}
              <strong>{clonedWordCount}</strong> words are currently appended to
              the system prompt.
            </span>
          ) : (
            <span>Nothing is cloned yet.</span>
          )}
        </div>
      </Panel>

      <SystemPromptManager core={core} builtInPrompts={BUILT_IN_PROMPTS} />

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
              disabled={isSending}
              onReanswer={handleReanswer}
              onRegenerate={handleRegenerate}
            />
          ))}
          {streamingMsg && (
            <ChatMessageUI
              msg={streamingMsg}
              core={core}
              onUpdate={triggerUpdate}
              isStreaming={true}
              disabled={isSending}
              onReanswer={handleReanswer}
              onRegenerate={handleRegenerate}
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
          {isSending && (
            <Button
              variant="danger"
              onClick={() => abortGeneration()}
              id="cancel-btn"
            >
              Cancel
            </Button>
          )}
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
