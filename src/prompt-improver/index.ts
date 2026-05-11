import {
  PromptImproverCore,
  PromptImproverConfig,
  IterationResult,
} from '../shared/prompt-improver-core.js';
import { setupLLMSettings } from '../shared/llm-settings.js';
import { LLMCore } from '../shared/llm-core.js';
import { UndoRedoManager } from '../shared/undo-redo.js';
import { getRequiredElement } from '../shared/dom-utils.js';
import { runWithUIState } from '../shared/ui-utils.js';
import { getStorage, setStorage } from '../shared/storage.js';

const els = {
  llmSettingsContainer: getRequiredElement(
    'llm-settings-container',
    HTMLDivElement,
  ),
  originalPrompt: getRequiredElement('original-prompt', HTMLTextAreaElement),
  intention: getRequiredElement('intention', HTMLTextAreaElement),
  howToImprove: getRequiredElement('how-to-improve', HTMLTextAreaElement),
  evaluationFocus: getRequiredElement('evaluation-focus', HTMLTextAreaElement),
  maxRounds: getRequiredElement('max-rounds', HTMLInputElement),
  branchFactor: getRequiredElement('branch-factor', HTMLInputElement),
  promptType: getRequiredElement('prompt-type', HTMLSelectElement),
  startBtn: getRequiredElement('start-btn', HTMLButtonElement),
  undoBtn: getRequiredElement('undo-btn', HTMLButtonElement),
  redoBtn: getRequiredElement('redo-btn', HTMLButtonElement),
  statusText: getRequiredElement('status-text', HTMLSpanElement),
  logArea: getRequiredElement('log-area', HTMLDivElement),
  resultsPanel: getRequiredElement('results-panel', HTMLDivElement),
  resultsTableBody: getRequiredElement(
    'results-table-body',
    HTMLTableSectionElement,
  ),
  apiCallsEst: getRequiredElement('api-calls-est', HTMLSpanElement),
  wordsEst: getRequiredElement('words-est', HTMLSpanElement),
  progressText: getRequiredElement('progress-text', HTMLSpanElement),
};

const llmCore = new LLMCore();
interface PromptState {
  originalPrompt: string;
  intention: string;
  howToImprove: string;
  evaluationFocus: string;
  maxRounds: string;
  branchFactor: string;
  promptType: string;
}

let undoManager: UndoRedoManager<PromptState>;

function updateUndoRedoButtons() {
  if (undoManager) {
    els.undoBtn.disabled = !undoManager.canUndo;
    els.redoBtn.disabled = !undoManager.canRedo;
  }
}

function getStateFromUI(): PromptState {
  return {
    originalPrompt: els.originalPrompt.value,
    intention: els.intention.value,
    howToImprove: els.howToImprove.value,
    evaluationFocus: els.evaluationFocus.value,
    maxRounds: els.maxRounds.value,
    branchFactor: els.branchFactor.value,
    promptType: els.promptType.value,
  };
}

function updateEstimation() {
  const maxRounds = parseInt(els.maxRounds.value, 10) || 1;
  const branchFactor = parseInt(els.branchFactor.value, 10) || 1;
  const apiCalls = 1 + maxRounds * (1 + branchFactor * 2);
  els.apiCallsEst.textContent = apiCalls.toString();

  // Very rough words estimation just to give users an idea
  const baseWords = (els.originalPrompt.value.split(' ').length + els.intention.value.split(' ').length + els.howToImprove.value.split(' ').length);
  const roughWordsEst = 500 + (maxRounds * (baseWords * branchFactor * 5));
  els.wordsEst.textContent = `~${roughWordsEst}`;
}

function applyStateToUI(state: PromptState) {
  if (!state) return;
  els.originalPrompt.value = state.originalPrompt;
  els.intention.value = state.intention;
  els.howToImprove.value = state.howToImprove;
  els.evaluationFocus.value = state.evaluationFocus;
  els.maxRounds.value = state.maxRounds;
  els.branchFactor.value = state.branchFactor || '3';
  els.promptType.value = state.promptType;
  updateUndoRedoButtons();
  updateEstimation();
}

function loadState() {
  els.originalPrompt.value =
    getStorage('prompt-improver-originalPrompt') || '';
  els.intention.value =
    getStorage('prompt-improver-intention') ||
    'Used for Gemini Deep Research';
  els.howToImprove.value =
    getStorage('prompt-improver-howToImprove') ||
    'Ensure the LLM is considerate and fills in details the original vague prompt might not have thought about.';
  els.evaluationFocus.value =
    getStorage('prompt-improver-evaluationFocus') || '';
  els.maxRounds.value =
    getStorage('prompt-improver-maxRounds') || '3';
  els.branchFactor.value =
    getStorage('prompt-improver-branchFactor') || '3';
  els.promptType.value =
    getStorage('prompt-improver-promptType') || 'system';

  undoManager = new UndoRedoManager(
    getStateFromUI(),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  updateUndoRedoButtons();
  updateEstimation();
}

function saveState() {
  setStorage(
    'prompt-improver-originalPrompt',
    els.originalPrompt.value,
  );
  setStorage('prompt-improver-intention', els.intention.value);
  setStorage('prompt-improver-howToImprove', els.howToImprove.value);
  setStorage(
    'prompt-improver-evaluationFocus',
    els.evaluationFocus.value,
  );
  setStorage('prompt-improver-maxRounds', els.maxRounds.value);
  setStorage('prompt-improver-branchFactor', els.branchFactor.value);
  setStorage('prompt-improver-promptType', els.promptType.value);

  if (undoManager) {
    undoManager.save(getStateFromUI());
    updateUndoRedoButtons();
  }
  updateEstimation();
}

els.originalPrompt.addEventListener('input', saveState);
els.intention.addEventListener('input', saveState);
els.howToImprove.addEventListener('input', saveState);
els.evaluationFocus.addEventListener('input', saveState);
els.maxRounds.addEventListener('input', saveState);
els.branchFactor.addEventListener('input', saveState);
els.promptType.addEventListener('change', saveState);

loadState();

setupLLMSettings(els.llmSettingsContainer, llmCore);

els.undoBtn.addEventListener('click', () => {
  const state = undoManager.undo();
  if (state) {
    applyStateToUI(state);
    // save to localStorage without adding to undo history
    setStorage(
      'prompt-improver-originalPrompt',
      state.originalPrompt,
    );
    setStorage('prompt-improver-intention', state.intention);
    setStorage('prompt-improver-howToImprove', state.howToImprove);
    setStorage(
      'prompt-improver-evaluationFocus',
      state.evaluationFocus,
    );
    setStorage('prompt-improver-maxRounds', state.maxRounds);
    setStorage('prompt-improver-branchFactor', state.branchFactor);
    setStorage('prompt-improver-promptType', state.promptType);
  }
});

els.redoBtn.addEventListener('click', () => {
  const state = undoManager.redo();
  if (state) {
    applyStateToUI(state);
    // save to localStorage without adding to undo history
    setStorage(
      'prompt-improver-originalPrompt',
      state.originalPrompt,
    );
    setStorage('prompt-improver-intention', state.intention);
    setStorage('prompt-improver-howToImprove', state.howToImprove);
    setStorage(
      'prompt-improver-evaluationFocus',
      state.evaluationFocus,
    );
    setStorage('prompt-improver-maxRounds', state.maxRounds);
    setStorage('prompt-improver-branchFactor', state.branchFactor);
    setStorage('prompt-improver-promptType', state.promptType);
  }
});

function appendLog(type: string, message: string, data?: any) {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;

  let content = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (data) {
    content +=
      '\n' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }

  entry.textContent = content;
  els.logArea.appendChild(entry);
  els.logArea.scrollTop = els.logArea.scrollHeight;
}

els.startBtn.addEventListener('click', async () => {
  if (!llmCore.apiKey || !llmCore.model || !els.originalPrompt.value) {
    els.statusText.textContent =
      'Please fill out API Key, Model, and Original Prompt.';
    els.statusText.style.color = 'red';
    return;
  }

  const config: PromptImproverConfig = {
    originalPrompt: els.originalPrompt.value,
    intention: els.intention.value,
    howToImprove: els.howToImprove.value,
    evaluationFocus: els.evaluationFocus.value,
    maxLoopRound: parseInt(els.maxRounds.value, 10) || 1,
    branchFactor: parseInt(els.branchFactor.value, 10) || 1,
    promptType: els.promptType.value as 'system' | 'user',
  };

  els.logArea.innerHTML = '';
  els.resultsPanel.style.display = 'none';
  els.resultsTableBody.innerHTML = '';
  els.progressText.textContent = '0%';

  await runWithUIState(
    els.startBtn,
    els.statusText,
    'Running...',
    async () => {
      const core = new PromptImproverCore(config, llmCore);

      try {
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
             els.apiCallsEst.textContent = event.data.apiCalls.toString();
          } else if (event.type === 'progress') {
             const { completed, total, words } = event.data;
             const pct = Math.round((completed / total) * 100);
             els.progressText.textContent = `${pct}%`;
             els.wordsEst.textContent = words.toString();
          } else {
             appendLog(event.type, event.message, event.data);
          }
        }

        if (finalResults && finalResults.length > 0) {
          renderResults(finalResults);
        }
      } catch (e: any) {
        appendLog('info', 'Fatal Error: ' + e.message);
        throw e;
      }
    },
    'Complete',
  );
});

function renderResults(results: IterationResult[]) {
  els.resultsPanel.style.display = 'block';

  // Sort by score descending
  const sorted = [...results].sort((a, b) => b.score - a.score);

  sorted.forEach((res, index) => {
    const tr = document.createElement('tr');

    const tdRank = document.createElement('td');
    tdRank.textContent = `#${index + 1}`;
    tr.appendChild(tdRank);

    const tdRound = document.createElement('td');
    tdRound.textContent = res.round.toString();
    tr.appendChild(tdRound);

    const tdBranch = document.createElement('td');
    tdBranch.textContent = res.branch.toString();
    tr.appendChild(tdBranch);

    const tdScore = document.createElement('td');
    tdScore.textContent = res.score.toString();
    tr.appendChild(tdScore);

    const tdPrompt = document.createElement('td');
    const promptDiv = document.createElement('div');
    promptDiv.className = 'ranking-prompt';
    promptDiv.textContent = res.prompt;
    tdPrompt.appendChild(promptDiv);
    tr.appendChild(tdPrompt);

    const tdFeedback = document.createElement('td');
    tdFeedback.textContent =
      res.feedback + (res.stop ? '\n[STOP SIGNALED]' : '');
    tr.appendChild(tdFeedback);

    els.resultsTableBody.appendChild(tr);
  });
}
