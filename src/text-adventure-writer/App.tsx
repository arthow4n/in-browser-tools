import React, { useState, useEffect, useRef } from 'react';
import {
  PageLayout,
  Panel,
  Button,
  Input,
  TextArea,
  LlmSettings,
} from '../shared/components/index.js';
import { TextAdventureCore } from './core.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';

export const App: React.FC = () => {
  const coreRef = useRef(new TextAdventureCore());
  const core = coreRef.current;

  const [scenarioRequest, setScenarioRequest] = useState(core.scenarioRequest);
  const [characterName, setCharacterName] = useState(core.characterName);
  const [characterDescription, setCharacterDescription] = useState(
    core.characterDescription,
  );

  const [history, setHistory] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState('');

  const [userInput, setUserInput] = useState('');
  const [storyDirection, setStoryDirection] = useState('');

  const [charGuidance, setCharGuidance] = useState('');
  const [introGuidance, setIntroGuidance] = useState('');
  const [actionGuidance, setActionGuidance] = useState('');

  const [streamingMsg, setStreamingMsg] = useState<any | null>(null);

  const {
    isLoading: isGeneratingChar,
    statusText: charStatus,
    isError: charIsError,
    runAction: runCharAction,
  } = useAsyncAction();
  const {
    isLoading: isGeneratingAction,
    statusText: actionStatus,
    isError: actionIsError,
    runAction: runActionAction,
  } = useAsyncAction();
  const {
    isLoading: isGeneratingResponse,
    statusText: responseStatus,
    isError: responseIsError,
    runAction: runResponseAction,
  } = useAsyncAction();

  useEffect(() => {
    setHistory([...core.history]);
  }, []);

  const triggerUpdate = () => {
    setHistory([...core.history]);
  };

  const handleScenarioChange = (val: string) => {
    setScenarioRequest(val);
    core.scenarioRequest = val;
    core.saveChatState();
  };

  const handleNameChange = (val: string) => {
    setCharacterName(val);
    core.characterName = val;
    core.saveChatState();
  };

  const handleDescChange = (val: string) => {
    setCharacterDescription(val);
    core.characterDescription = val;
    core.saveChatState();
  };

  const handleGenerateCharacter = async () => {
    await runCharAction(
      'Generating character...',
      async () => {
        if (!scenarioRequest.trim()) {
          throw new Error('Please enter a scenario request first.');
        }
        const generator = core.generateCharacter({
          scenarioRequest: scenarioRequest.trim(),
          guidance: charGuidance.trim(),
        });
        let toolArgs = '';
        for await (const chunk of generator) {
          if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolArgs = chunk.toolCall.arguments;
          }
        }
        if (toolArgs) {
          const parsed = JSON.parse(toolArgs);
          if (parsed.characterName) {
            setCharacterName(parsed.characterName);
            core.characterName = parsed.characterName;
          }
          if (parsed.characterDescription) {
            setCharacterDescription(parsed.characterDescription);
            core.characterDescription = parsed.characterDescription;
          }
          core.saveChatState();
        }
      },
      'Character generated.',
    );
  };

  const handleGenerateIntro = async () => {
    if (!scenarioRequest.trim()) {
      setFormError('Please enter a scenario request first.');
      return;
    }
    setFormError('');
    core.history = [];
    let introPrompt = `[OOC - Initial Scenario]: The user requested the following scenario to begin: ${scenarioRequest.trim()}`;
    if (introGuidance.trim()) {
      introPrompt += `\n\n[OOC - Guidance for Intro]: ${introGuidance.trim()}`;
    }
    core.history.push({
      id: Date.now().toString(),
      role: 'user',
      content: introPrompt,
    });
    core.saveChatState();
    triggerUpdate();
    await generateResponse();
  };

  const handleElaborate = async () => {
    if (core.history.length === 0) {
      setFormError('No history to elaborate on.');
      return;
    }
    setFormError('');
    core.history.push({
      id: Date.now().toString(),
      role: 'user',
      content:
        '[OOC]: Please rewrite and significantly elaborate on your last response. Make it much more vibrant, detailed, and immersive. Describe the environment, sensory details, and character emotions more deeply, and significantly expand the narrative length by adding more events or richer environmental exposition.',
    });
    core.saveChatState();
    triggerUpdate();
    await generateResponse();
  };

  const handleGenerateAction = async () => {
    await runActionAction(
      'Generating next action...',
      async () => {
        const generator = core.generateNextAction(actionGuidance.trim());
        let fullText = '';
        for await (const chunk of generator) {
          fullText += chunk;
          setUserInput(fullText);
        }
      },
      'Action suggested.',
    );
  };

  const handleSend = async () => {
    const userText = userInput.trim();
    const directionText = storyDirection.trim();
    if (!userText && !directionText) return;
    if (!core.characterName) {
      setFormError('Please enter your character name.');
      return;
    }
    setFormError('');

    if (directionText) {
      core.history.push({
        id: Date.now().toString() + '-sys',
        role: 'system',
        content: `[OOC - Story Direction]: ${directionText}`,
      });
    }
    const finalContent = `[${core.characterName}]: ${userText || '*Waits silently*'}`;
    core.history.push({
      id: Date.now().toString(),
      role: 'user',
      content: finalContent,
    });
    core.saveChatState();
    triggerUpdate();
    setUserInput('');
    setStoryDirection('');

    await generateResponse();
  };

  const generateResponse = async () => {
    await runResponseAction('Generating...', async () => {
      const assistantMessage: any = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        tool_calls: [],
      };
      setStreamingMsg(assistantMessage);

      const generator = core.streamChatCompletionWithTools([]);
      for await (const chunk of generator) {
        if (chunk.type === 'text' && chunk.text) {
          assistantMessage.content += chunk.text;
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          let tc = assistantMessage.tool_calls.find(
            (t: any) => t.id === chunk.toolCall!.id,
          );
          if (!tc) {
            tc = {
              id: chunk.toolCall.id,
              type: 'function',
              function: {
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              },
            };
            assistantMessage.tool_calls.push(tc);
          } else {
            tc.function.arguments = chunk.toolCall.arguments;
          }
        }
        setStreamingMsg({ ...assistantMessage });
      }

      core.history.push(assistantMessage);
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        for (const tc of assistantMessage.tool_calls) {
          core.history.push({
            id: Date.now().toString() + '-tool-' + tc.id,
            role: 'tool',
            content: JSON.stringify({ success: true }),
            tool_call_id: tc.id,
          });
        }
      }
      core.saveChatState();
      triggerUpdate();
      setStreamingMsg(null);
    });
  };

  const renderMessageContent = (msg: any, isStream = false) => {
    if (msg.role === 'user') {
      return <div className="message user">{msg.content}</div>;
    } else if (msg.role === 'assistant') {
      let hasToolCalls = false;
      const elements: JSX.Element[] = [];

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        msg.tool_calls.forEach((tc: any, i: number) => {
          if (tc.function.name === 'speak') {
            hasToolCalls = true;
            try {
              const args = JSON.parse(tc.function.arguments);
              const isNarrator = args.character?.toLowerCase() === 'narrator';
              elements.push(
                <div
                  key={i}
                  className={`message ${isNarrator ? 'narrator' : 'character'} ${isStream ? 'streaming' : ''}`}
                >
                  <span className="character-name">
                    {args.character || '...'}
                  </span>
                  {args.message || '...'}
                </div>,
              );
            } catch (e) {
              // still streaming JSON
            }
          }
        });
      }

      if (!hasToolCalls && msg.content && msg.content.trim()) {
        elements.push(
          <div
            key="fallback"
            className={`message narrator ${isStream ? 'streaming' : ''}`}
          >
            <span className="character-name">Narrator</span>
            {msg.content}
          </div>,
        );
      }

      return <>{elements}</>;
    }
    return null;
  };

  return (
    <PageLayout>
      <div className="header">
        <h1>Text Adventure Writer</h1>
      </div>

      <LlmSettings core={core} />

      <Panel title="Scenario & Character Setup">
        <TextArea
          label="1. Describe the scenario or world:"
          placeholder="e.g. A cyberpunk city where..."
          rows={3}
          value={scenarioRequest}
          onChange={(e) => handleScenarioChange(e.target.value)}
        />

        <div style={{ marginTop: '10px' }}>
          <Input
            type="text"
            placeholder="Optional Guidance (e.g. Needs to be a hacker)"
            value={charGuidance}
            onChange={(e) => setCharGuidance(e.target.value)}
          />
          <Button onClick={handleGenerateCharacter} loading={isGeneratingChar}>
            2. Auto-Generate Character
          </Button>
          <span
            className="status"
            style={{ color: charIsError ? 'red' : 'green', marginLeft: '10px' }}
          >
            {charStatus}
          </span>
        </div>

        <Input
          label="Character Name:"
          type="text"
          value={characterName}
          onChange={(e) => handleNameChange(e.target.value)}
        />
        <TextArea
          label="Character Description:"
          rows={2}
          value={characterDescription}
          onChange={(e) => handleDescChange(e.target.value)}
        />

        <div style={{ marginTop: '10px' }}>
          <Input
            type="text"
            placeholder="Optional Guidance (e.g. Start with an explosion)"
            value={introGuidance}
            onChange={(e) => setIntroGuidance(e.target.value)}
          />
          <Button onClick={handleGenerateIntro} loading={isGeneratingResponse}>
            3. Generate / Restart Intro
          </Button>
          {formError && (
            <span className="status" style={{ color: 'red', marginLeft: '10px' }}>
              {formError}
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Story">
        <div style={{ marginBottom: '10px' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
            />
            Show Advanced OOC Chat History
          </label>
        </div>

        {showAdvanced && (
          <div
            style={{
              border: '1px solid #ccc',
              padding: '10px',
              height: '300px',
              overflowY: 'auto',
              marginBottom: '15px',
              borderRadius: '4px',
              background: '#fafafa',
              fontFamily: "Consolas, 'Courier New', monospace",
              fontSize: '0.9em',
            }}
          >
            {history.map((msg, i) => (
              <div key={i} style={{ marginBottom: '5px' }}>
                <strong>{msg.role}: </strong>
                {msg.role === 'assistant' && msg.tool_calls
                  ? JSON.stringify(msg.tool_calls)
                  : msg.content}
              </div>
            ))}
            {streamingMsg && (
              <div style={{ marginBottom: '5px' }}>
                <strong>assistant: </strong>
                {streamingMsg.tool_calls
                  ? JSON.stringify(streamingMsg.tool_calls)
                  : streamingMsg.content}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            border: '1px solid #ccc',
            padding: '10px',
            height: '400px',
            overflowY: 'auto',
            marginBottom: '15px',
            borderRadius: '4px',
            background: '#fafafa',
          }}
        >
          {history.map((msg, i) => (
            <React.Fragment key={i}>{renderMessageContent(msg)}</React.Fragment>
          ))}
          {streamingMsg && renderMessageContent(streamingMsg, true)}
        </div>

        <TextArea
          label={`Your Action (${characterName || 'Player'}):`}
          rows={3}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
        <div style={{ marginTop: '10px' }}>
          <Input
            type="text"
            placeholder="Optional Guidance (e.g. Say something witty)"
            value={actionGuidance}
            onChange={(e) => setActionGuidance(e.target.value)}
          />
          <Button onClick={handleGenerateAction} loading={isGeneratingAction}>
            Suggest Action
          </Button>
          <span
            className="status"
            style={{
              color: actionIsError ? 'red' : 'green',
              marginLeft: '10px',
            }}
          >
            {actionStatus}
          </span>
        </div>

        <TextArea
          label="Story Direction (OOC / GM Guidance):"
          rows={2}
          value={storyDirection}
          onChange={(e) => setStoryDirection(e.target.value)}
        />

        <div style={{ marginTop: '10px' }}>
          <Button
            onClick={handleSend}
            loading={isGeneratingResponse}
            id="send-continue-btn"
          >
            Send & Continue
          </Button>
          <Button
            variant="secondary"
            onClick={handleElaborate}
            loading={isGeneratingResponse}
          >
            Elaborate Last Response
          </Button>
          <span
            className="status"
            style={{
              color: responseIsError ? 'red' : 'green',
              marginLeft: '10px',
            }}
          >
            {responseStatus}
          </span>
          {formError && (
            <span className="status" style={{ color: 'red', marginLeft: '10px' }}>
              {formError}
            </span>
          )}
        </div>
      </Panel>
    </PageLayout>
  );
};
