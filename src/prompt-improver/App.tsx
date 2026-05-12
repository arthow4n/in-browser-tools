import React, { useState, useEffect, useCallback } from 'react';
import { PageLayout, Panel, Button, Input, TextArea, LlmSettings } from '../shared/components/index.js';
import { PromptImproverCore, PromptImproverConfig, IterationResult } from '../shared/prompt-improver-core.js';
import { LLMCore } from '../shared/llm-core.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';
import { useUndoRedo } from '../shared/hooks/useUndoRedo.js';
import { getStorage, setStorage } from '../shared/storage.js';

interface PromptState {
  originalPrompt: string;
  intention: string;
  howToImprove: string;
  evaluationFocus: string;
  maxRounds: string;
  branchFactor: string;
  promptType: string;
}

const llmCore = new LLMCore();

export const App: React.FC = () => {
  const loadInitialState = (): PromptState => {
    return {
      originalPrompt: getStorage('prompt-improver-originalPrompt') || '',
      intention: getStorage('prompt-improver-intention') || 'Used for Gemini Deep Research',
      howToImprove: getStorage('prompt-improver-howToImprove') || 'Ensure the LLM is considerate and fills in details the original vague prompt might not have thought about.',
      evaluationFocus: getStorage('prompt-improver-evaluationFocus') || '',
      maxRounds: getStorage('prompt-improver-maxRounds') || '3',
      branchFactor: getStorage('prompt-improver-branchFactor') || '3',
      promptType: getStorage('prompt-improver-promptType') || 'system',
    };
  };

  const { state, set, undo, redo, canUndo, canRedo } = useUndoRedo<PromptState>(loadInitialState(), (a, b) => JSON.stringify(a) === JSON.stringify(b));

  const [logs, setLogs] = useState<{ type: string; message: string; data?: any }[]>([]);
  const [results, setResults] = useState<IterationResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [apiCallsEst, setApiCallsEst] = useState(0);
  const [wordsEst, setWordsEst] = useState(0);

  const { isLoading, statusText, isError, runAction } = useAsyncAction();

  useEffect(() => {
    setStorage('prompt-improver-originalPrompt', state.originalPrompt);
    setStorage('prompt-improver-intention', state.intention);
    setStorage('prompt-improver-howToImprove', state.howToImprove);
    setStorage('prompt-improver-evaluationFocus', state.evaluationFocus);
    setStorage('prompt-improver-maxRounds', state.maxRounds);
    setStorage('prompt-improver-branchFactor', state.branchFactor);
    setStorage('prompt-improver-promptType', state.promptType);

    const maxRounds = parseInt(state.maxRounds, 10) || 1;
    const branchFactor = parseInt(state.branchFactor, 10) || 1;
    setApiCallsEst(1 + maxRounds * (1 + branchFactor * 2));

    const baseWords = state.originalPrompt.split(' ').length + state.intention.split(' ').length + state.howToImprove.split(' ').length;
    setWordsEst(500 + (maxRounds * (baseWords * branchFactor * 5)));
  }, [state]);

  const updateState = (key: keyof PromptState, value: string) => {
    set({ ...state, [key]: value });
  };

  const handleStart = async () => {
    if (!llmCore.apiKey || !llmCore.model || !state.originalPrompt) {
      alert('Please fill out API Key, Model, and Original Prompt.');
      return;
    }

    const config: PromptImproverConfig = {
      originalPrompt: state.originalPrompt,
      intention: state.intention,
      howToImprove: state.howToImprove,
      evaluationFocus: state.evaluationFocus,
      maxLoopRound: parseInt(state.maxRounds, 10) || 1,
      branchFactor: parseInt(state.branchFactor, 10) || 1,
      promptType: state.promptType as 'system' | 'user',
    };

    setLogs([]);
    setResults([]);
    setProgress(0);

    await runAction('Running...', async () => {
      const core = new PromptImproverCore(config, llmCore);
      const generator = core.run();
      let finalResults: IterationResult[] = [];

      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          if (value) finalResults = value as IterationResult[];
          break;
        }

        const event = value;

        if (event.type === 'cost_estimation') {
          setApiCallsEst(event.data.apiCalls);
        } else if (event.type === 'progress') {
          const { completed, total, words } = event.data;
          setProgress(Math.round((completed / total) * 100));
          setWordsEst(words);
        } else {
          setLogs(prev => [...prev, { type: event.type, message: event.message, data: event.data }]);
        }
      }

      if (finalResults && finalResults.length > 0) {
        setResults(finalResults.sort((a, b) => b.score - a.score));
      }
    }, 'Complete');
  };

  return (
    <PageLayout>
      <div className="header">
        <h1>Prompt Improver</h1>
      </div>

      <LlmSettings core={llmCore} />

      <Panel title="Configuration">
        <div style={{ marginBottom: '10px' }}>
          <Button onClick={undo} disabled={!canUndo}>Undo</Button>
          <Button onClick={redo} disabled={!canRedo}>Redo</Button>
        </div>

        <div className="input-group">
          <label>Prompt Type:</label>
          <select value={state.promptType} onChange={(e) => updateState('promptType', e.target.value)}>
            <option value="system">System Prompt</option>
            <option value="user">User Prompt</option>
          </select>
        </div>

        <TextArea
          label="Original Prompt:"
          rows={6}
          value={state.originalPrompt}
          onChange={(e) => updateState('originalPrompt', e.target.value)}
        />
        <TextArea
          label="Intention (Optional):"
          rows={3}
          value={state.intention}
          onChange={(e) => updateState('intention', e.target.value)}
        />
        <TextArea
          label="How to improve (Optional):"
          rows={3}
          value={state.howToImprove}
          onChange={(e) => updateState('howToImprove', e.target.value)}
        />
        <TextArea
          label="Evaluation Focus (Optional):"
          rows={3}
          value={state.evaluationFocus}
          onChange={(e) => updateState('evaluationFocus', e.target.value)}
        />

        <div className="input-group">
          <label>Max Loops:</label>
          <input type="number" min="1" max="10" value={state.maxRounds} onChange={(e) => updateState('maxRounds', e.target.value)} />
        </div>
        <div className="input-group">
          <label>Branch Factor (Best of N per loop):</label>
          <input type="number" min="1" max="5" value={state.branchFactor} onChange={(e) => updateState('branchFactor', e.target.value)} />
        </div>

        <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
          <strong>Estimations:</strong><br />
          API Calls: <span id="api-calls-est">{apiCallsEst}</span><br />
          Token Usage roughly correlates to words: <span id="words-est">~{wordsEst}</span> total words processed across all calls.
        </div>

        <div style={{ marginTop: '20px' }}>
          <Button onClick={handleStart} loading={isLoading} id="start-btn">Start Prompt Improver</Button>
          <span id="status-text" className="status" style={{ color: isError ? 'red' : 'green', marginLeft: '10px' }}>
            {statusText} {progress > 0 && isLoading ? `(${progress}%)` : ''}
          </span>
        </div>
      </Panel>

      <Panel title="Logs">
        <div id="log-area" style={{ height: '300px', overflowY: 'auto', backgroundColor: '#1e1e1e', color: '#fff', padding: '10px', fontFamily: "Consolas, 'Courier New', monospace", fontSize: '0.9em', borderRadius: '4px' }}>
          {logs.map((log, i) => (
            <div key={i} className={`log-entry ${log.type}`}>
              [{new Date().toLocaleTimeString()}] {log.message}
              {log.data && <div>{typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}</div>}
            </div>
          ))}
        </div>
      </Panel>

      {results.length > 0 && (
        <Panel title="Results (Ranked by Score)">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2' }}>Rank</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2' }}>Round</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2' }}>Branch</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2' }}>Score (0-100)</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2', width: '50%' }}>Prompt</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2' }}>Evaluation Feedback</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>#{idx + 1}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{res.round}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{res.branch}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{res.score}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: "Consolas, 'Courier New', monospace" }}>{res.prompt}</div>
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '8px', whiteSpace: 'pre-wrap' }}>{res.feedback} {res.stop ? '\n[STOP SIGNALED]' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </PageLayout>
  );
};
