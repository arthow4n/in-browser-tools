import {
  PromptImproverCore,
  PromptImproverConfig,
  IterationResult,
} from './core.js';

const els = {
  apiKey: document.getElementById('api-key') as HTMLInputElement,
  model: document.getElementById('model') as HTMLInputElement,
  fetchModelsBtn: document.getElementById('fetch-models') as HTMLButtonElement,
  modelSelect: document.getElementById('model-select') as HTMLSelectElement,
  originalPrompt: document.getElementById(
    'original-prompt',
  ) as HTMLTextAreaElement,
  intention: document.getElementById('intention') as HTMLTextAreaElement,
  howToImprove: document.getElementById(
    'how-to-improve',
  ) as HTMLTextAreaElement,
  maxRounds: document.getElementById('max-rounds') as HTMLInputElement,
  promptType: document.getElementById('prompt-type') as HTMLSelectElement,
  startBtn: document.getElementById('start-btn') as HTMLButtonElement,
  statusText: document.getElementById('status-text') as HTMLSpanElement,
  logArea: document.getElementById('log-area') as HTMLDivElement,
  resultsPanel: document.getElementById('results-panel') as HTMLDivElement,
  resultsTableBody: document.querySelector(
    '#results-table tbody',
  ) as HTMLTableSectionElement,
};

// Ensure all required elements exist
for (const [key, el] of Object.entries(els)) {
  if (!el) throw new Error(`Missing required element: ${key}`);
}

function loadState() {
  els.apiKey.value = localStorage.getItem('prompt-improver-apiKey') || '';
  els.model.value =
    localStorage.getItem('prompt-improver-model') || 'google/gemini-2.5-flash';
  els.originalPrompt.value =
    localStorage.getItem('prompt-improver-originalPrompt') || '';
  els.intention.value =
    localStorage.getItem('prompt-improver-intention') ||
    'Used for Gemini Deep Research';
  els.howToImprove.value =
    localStorage.getItem('prompt-improver-howToImprove') ||
    'Ensure the LLM is considerate and fills in details the original vague prompt might not have thought about.';
  els.maxRounds.value =
    localStorage.getItem('prompt-improver-maxRounds') || '3';
  els.promptType.value =
    localStorage.getItem('prompt-improver-promptType') || 'system';
}

function saveState() {
  localStorage.setItem('prompt-improver-apiKey', els.apiKey.value);
  localStorage.setItem('prompt-improver-model', els.model.value);
  localStorage.setItem(
    'prompt-improver-originalPrompt',
    els.originalPrompt.value,
  );
  localStorage.setItem('prompt-improver-intention', els.intention.value);
  localStorage.setItem('prompt-improver-howToImprove', els.howToImprove.value);
  localStorage.setItem('prompt-improver-maxRounds', els.maxRounds.value);
  localStorage.setItem('prompt-improver-promptType', els.promptType.value);
}

els.apiKey.addEventListener('input', saveState);
els.model.addEventListener('input', saveState);
els.originalPrompt.addEventListener('input', saveState);
els.intention.addEventListener('input', saveState);
els.howToImprove.addEventListener('input', saveState);
els.maxRounds.addEventListener('input', saveState);
els.promptType.addEventListener('change', saveState);

loadState();

els.fetchModelsBtn.addEventListener('click', async () => {
  const apiKey = els.apiKey.value;
  if (!apiKey) {
    alert('Please enter an API Key first.');
    return;
  }

  try {
    els.fetchModelsBtn.disabled = true;
    els.fetchModelsBtn.textContent = 'Fetching...';

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) throw new Error('Failed to fetch models');

    const data = await res.json();
    els.modelSelect.innerHTML = '';

    data.data.forEach((m: any) => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = m.name;
      els.modelSelect.appendChild(option);
    });

    els.modelSelect.style.display = 'block';
    els.model.style.display = 'none';

    els.modelSelect.value = els.model.value;
    els.modelSelect.addEventListener('change', () => {
      els.model.value = els.modelSelect.value;
      saveState();
    });
  } catch (e: any) {
    alert('Error fetching models: ' + e.message);
  } finally {
    els.fetchModelsBtn.disabled = false;
    els.fetchModelsBtn.textContent = 'Fetch Models';
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
  if (!els.apiKey.value || !els.model.value || !els.originalPrompt.value) {
    alert('Please fill out API Key, Model, and Original Prompt.');
    return;
  }

  const config: PromptImproverConfig = {
    apiKey: els.apiKey.value,
    model: els.model.value,
    originalPrompt: els.originalPrompt.value,
    intention: els.intention.value,
    howToImprove: els.howToImprove.value,
    maxLoopRound: parseInt(els.maxRounds.value, 10),
    promptType: els.promptType.value as 'system' | 'user',
  };

  els.startBtn.disabled = true;
  els.statusText.textContent = 'Running...';
  els.statusText.style.color = '#0066cc';
  els.logArea.innerHTML = '';
  els.resultsPanel.style.display = 'none';
  els.resultsTableBody.innerHTML = '';

  const core = new PromptImproverCore(config);

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
      appendLog(event.type, event.message, event.data);
    }

    els.statusText.textContent = 'Complete';
    els.statusText.style.color = 'green';

    if (finalResults && finalResults.length > 0) {
      renderResults(finalResults);
    }
  } catch (e: any) {
    els.statusText.textContent = 'Error';
    els.statusText.style.color = 'red';
    appendLog('info', 'Fatal Error: ' + e.message);
    console.error(e);
  } finally {
    els.startBtn.disabled = false;
  }
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
