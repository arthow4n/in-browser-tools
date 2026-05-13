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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = {
      scenarioRequest: core.scenarioRequest,
      characterName: core.characterName,
      characterDescription: core.characterDescription,
      history: core.history,
      systemPrompt: core.systemPrompt,
      outputLanguage: core.outputLanguage,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adventure-${core.characterName || 'export'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [saveName, setSaveName] = useState('');
  const [savedAdventures, setSavedAdventures] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('in-browser-tools:text-adventure-savedAdventures');
      if (saved) {
        setSavedAdventures(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load saved adventures list', e);
    }
  }, []);

  const handleSaveToBrowser = () => {
    if (!saveName.trim()) {
      setFormError('Please enter a name for your save.');
      return;
    }
    const data = {
      scenarioRequest: core.scenarioRequest,
      characterName: core.characterName,
      characterDescription: core.characterDescription,
      history: core.history,
      systemPrompt: core.systemPrompt,
      outputLanguage: core.outputLanguage,
      savedAt: new Date().toISOString(),
    };

    const newSaved = { ...savedAdventures, [saveName.trim()]: data };
    setSavedAdventures(newSaved);
    localStorage.setItem('in-browser-tools:text-adventure-savedAdventures', JSON.stringify(newSaved));
    setSaveName('');
    setFormError('');
  };

  const handleLoadFromBrowser = (name: string) => {
    const data = savedAdventures[name];
    if (!data) return;

    if (data.scenarioRequest !== undefined) {
      core.scenarioRequest = data.scenarioRequest;
      setScenarioRequest(data.scenarioRequest);
    }
    if (data.characterName !== undefined) {
      core.characterName = data.characterName;
      setCharacterName(data.characterName);
    }
    if (data.characterDescription !== undefined) {
      core.characterDescription = data.characterDescription;
      setCharacterDescription(data.characterDescription);
    }
    if (data.history !== undefined) {
      core.history = data.history;
      triggerUpdate();
    }
    if (data.systemPrompt !== undefined) {
      core.systemPrompt = data.systemPrompt;
    }
    if (data.outputLanguage !== undefined) {
      core.outputLanguage = data.outputLanguage;
    }
    core.saveChatState();
    setFormError('');
  };

  const handleDeleteFromBrowser = (name: string) => {
    const newSaved = { ...savedAdventures };
    delete newSaved[name];
    setSavedAdventures(newSaved);
    localStorage.setItem('in-browser-tools:text-adventure-savedAdventures', JSON.stringify(newSaved));
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.scenarioRequest !== undefined) {
          core.scenarioRequest = data.scenarioRequest;
          setScenarioRequest(data.scenarioRequest);
        }
        if (data.characterName !== undefined) {
          core.characterName = data.characterName;
          setCharacterName(data.characterName);
        }
        if (data.characterDescription !== undefined) {
          core.characterDescription = data.characterDescription;
          setCharacterDescription(data.characterDescription);
        }
        if (data.history !== undefined) {
          core.history = data.history;
          triggerUpdate();
        }
        if (data.systemPrompt !== undefined) {
          core.systemPrompt = data.systemPrompt;
        }
        if (data.outputLanguage !== undefined) {
          core.outputLanguage = data.outputLanguage;
        }
        core.saveChatState();
        setFormError('');
      } catch (err) {
        console.error('Failed to parse adventure JSON', err);
        setFormError('Failed to parse imported adventure file.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

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

    const content = '[OOC]: Please rewrite and significantly elaborate on your last response. Make it much more vibrant, detailed, and immersive. Describe the environment, sensory details, and character emotions more deeply, and significantly expand the narrative length by adding more events or richer environmental exposition.';

    // Find the last assistant message
    let unresolvedWaitToolId: string | null = null;
    for (let i = core.history.length - 1; i >= 0; i--) {
      const msg = core.history[i];
      if (msg.role === 'assistant' && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'wait_for_user_input') {
            const hasResult = core.history.some(m => m.role === 'tool' && m.tool_call_id === tc.id);
            if (!hasResult) {
              unresolvedWaitToolId = tc.id;
            }
          }
        }
        break; // Found the last assistant message, don't look further back
      }
    }

    if (unresolvedWaitToolId) {
      core.history.push({
        id: Date.now().toString() + '-tool-' + unresolvedWaitToolId,
        role: 'tool',
        content: content,
        tool_call_id: unresolvedWaitToolId,
      });
    } else {
      core.history.push({
        id: Date.now().toString(),
        role: 'user',
        content: content,
      });
    }

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

    const finalContent = `[${core.characterName}]: ${userText || '*Waits silently*'}`;

    let unresolvedWaitToolId: string | null = null;
    for (let i = core.history.length - 1; i >= 0; i--) {
      const msg = core.history[i];
      if (msg.role === 'assistant' && msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'wait_for_user_input') {
            const hasResult = core.history.some(m => m.role === 'tool' && m.tool_call_id === tc.id);
            if (!hasResult) {
              unresolvedWaitToolId = tc.id;
            }
          }
        }
        break; // Found the last assistant message, don't look further back
      }
    }

    if (unresolvedWaitToolId) {
      core.history.push({
        id: Date.now().toString() + '-tool-' + unresolvedWaitToolId,
        role: 'tool',
        content: finalContent,
        tool_call_id: unresolvedWaitToolId,
      });
    } else {
      core.history.push({
        id: Date.now().toString(),
        role: 'user',
        content: finalContent,
      });
    }

    if (directionText) {
      core.history.push({
        id: Date.now().toString() + '-sys',
        role: 'system',
        content: `[OOC - Story Direction]: ${directionText}`,
      });
    }

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
          if (tc.function.name !== 'wait_for_user_input') {
            core.history.push({
              id: Date.now().toString() + '-tool-' + tc.id,
              role: 'tool',
              content: JSON.stringify({ success: true }),
              tool_call_id: tc.id,
            });
          }
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
      const elements: React.ReactElement[] = [];

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        hasToolCalls = true;
        msg.tool_calls.forEach((tc: any, i: number) => {
          if (tc.function.name === 'speak' || tc.function.name === 'write_action') {
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

      <Panel title="Adventure Management">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Save Name"
              type="text"
              placeholder="e.g. Cyberpunk City Save 1"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveToBrowser}>Save</Button>
        </div>

        {Object.keys(savedAdventures).length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Load / Delete Save</label>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid #ccc', borderRadius: '4px' }}>
              {Object.entries(savedAdventures).map(([name, data]) => (
                <li key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                  <div>
                    <strong>{name}</strong>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>Saved: {new Date(data.savedAt).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <Button onClick={() => handleLoadFromBrowser(name)}>Load</Button>
                    <Button variant="danger" onClick={() => handleDeleteFromBrowser(name)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px', display: 'flex', gap: '10px' }}>
          <Button onClick={handleExport}>Export JSON</Button>
          <Button onClick={() => fileInputRef.current?.click()}>Import JSON</Button>
          <Input
            type="file"
            accept=".json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </Panel>

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
          <Input
            type="checkbox"
            label="Show Advanced OOC Chat History"
            checked={showAdvanced}
            onChange={(e) => setShowAdvanced(e.target.checked)}
          />
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
