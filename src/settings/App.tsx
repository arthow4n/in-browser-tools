import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PageLayout,
  Button,
  Input,
  TextArea,
} from '../shared/components/index.js'; // Note we will create this index later or import individually
import { LLMCore } from '../shared/llm-core.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';
import { clearAllSettings, clearToolSettings } from '../shared/storage.js';
import '../shared/components/styles.css';

const core = new LLMCore();

export const App: React.FC = () => {
  const [activePresetId, setActivePresetId] = useState(core.activePresetId);
  const [apiKey, setApiKey] = useState(core.apiKey);
  const [model, setModel] = useState(core.model);
  const [reasoningEffort, setReasoningEffort] = useState(
    core.providerPrefs.reasoningEffort || '',
  );
  const [order, setOrder] = useState(core.providerPrefs.order.join(', '));
  const [dataCollection, setDataCollection] = useState(
    core.providerPrefs.dataCollection,
  );
  const [allowFallbacks, setAllowFallbacks] = useState(
    core.providerPrefs.allowFallbacks,
  );
  const [streamResponses, setStreamResponses] = useState(
    core.providerPrefs.streamResponses ?? true,
  );
  const [renderMarkdown, setRenderMarkdown] = useState(
    core.providerPrefs.renderMarkdown ?? true,
  );
  const [zdr, setZdr] = useState(core.providerPrefs.zdr);
  const [rateLimitRetries, setRateLimitRetries] = useState(
    core.providerPrefs.rateLimitRetries ?? 1,
  );
  const [rateLimitWaitSeconds, setRateLimitWaitSeconds] = useState(
    core.providerPrefs.rateLimitWaitSeconds ?? 3,
  );
  const [appendedPrompts, setAppendedPrompts] = useState(
    [...core.appendedSystemPrompts],
  );
  const [availableModels, setAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const { isLoading, statusText, isError, runAction } = useAsyncAction();

  // Sync state variables when preset changes
  useEffect(() => {
    setApiKey(core.apiKey);
    setModel(core.model);
    setReasoningEffort(core.providerPrefs.reasoningEffort || '');
    setOrder(core.providerPrefs.order.join(', '));
    setDataCollection(core.providerPrefs.dataCollection);
    setAllowFallbacks(core.providerPrefs.allowFallbacks);
    setStreamResponses(core.providerPrefs.streamResponses ?? true);
    setRenderMarkdown(core.providerPrefs.renderMarkdown ?? true);
    setZdr(core.providerPrefs.zdr);
    setRateLimitRetries(core.providerPrefs.rateLimitRetries ?? 1);
    setRateLimitWaitSeconds(core.providerPrefs.rateLimitWaitSeconds ?? 3);
  }, [activePresetId]);

  // Update core and save state when inputs change
  useEffect(() => {
    if (core.activePresetId !== activePresetId) return; // Prevent saving old data while switching
    core.apiKey = apiKey;
    core.model = model;

    // We must re-assign the entire object or mutating properties directly might not trigger save logic properly if relying on setters
    const currentPrefs = core.providerPrefs;
    core.providerPrefs = {
      ...currentPrefs,
      reasoningEffort: reasoningEffort as
        | ''
        | 'xhigh'
        | 'high'
        | 'medium'
        | 'low'
        | 'minimal'
        | 'none',
      order: order
        ? order
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      dataCollection: dataCollection as 'allow' | 'deny',
      allowFallbacks,
      streamResponses,
      renderMarkdown,
      zdr,
      rateLimitRetries,
      rateLimitWaitSeconds,
    };
    core.appendedSystemPrompts = appendedPrompts;
    core.saveState();
  }, [
    apiKey,
    model,
    reasoningEffort,
    order,
    dataCollection,
    allowFallbacks,
    streamResponses,
    renderMarkdown,
    zdr,
    rateLimitRetries,
    rateLimitWaitSeconds,
    appendedPrompts,
  ]);

  const handleCreatePreset = () => {
    const name = prompt('Enter a name for the new preset:');
    if (name) {
      const newPreset = core.addPreset(name);
      setActivePresetId(newPreset.id);
    }
  };

  const handleRenamePreset = () => {
    const currentName =
      core.presets.find((p) => p.id === activePresetId)?.name || '';
    const newName = prompt('Enter a new name for this preset:', currentName);
    if (newName && newName !== currentName) {
      core.renamePreset(activePresetId, newName);
      // Force re-render to update the dropdown name
      setActivePresetId('');
      setTimeout(() => setActivePresetId(core.activePresetId), 0);
    }
  };

  const handleDeletePreset = () => {
    if (core.presets.length <= 1) {
      setResetStatus('Cannot delete the last preset.');
      setTimeout(() => setResetStatus(''), 3000);
      return;
    }
    if (confirm('Are you sure you want to delete this preset?')) {
      core.deletePreset(activePresetId);
      setActivePresetId(core.activePresetId);
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    core.switchPreset(id);
    setActivePresetId(id);
  };

  const fetchModels = async () => {
    await runAction(
      'Fetching...',
      async () => {
        if (!apiKey) {
          throw new Error('Please enter an OpenRouter API Key first.');
        }
        const models = await core.fetchModels();
        setAvailableModels(models);
        setShowDropdown(true);
      },
      'Fetched models successfully.',
    );
  };

  const filteredModels = useMemo(() => {
    const filterText = model.toLowerCase();
    return availableModels.filter(
      (m) =>
        m.id.toLowerCase().includes(filterText) ||
        m.name.toLowerCase().includes(filterText),
    );
  }, [model, availableModels]);

  const handleResetToolSettings = () => {
    clearToolSettings();
    setResetStatus('Tool settings reset (OpenRouter settings preserved).');
    setTimeout(() => setResetStatus(''), 3000);
  };

  const handleResetAllSettings = () => {
    clearAllSettings();
    core.loadState();
    setApiKey(core.apiKey);
    setModel(core.model);
    setReasoningEffort(core.providerPrefs.reasoningEffort || '');
    setOrder(core.providerPrefs.order.join(', '));
    setDataCollection(core.providerPrefs.dataCollection);
    setAllowFallbacks(core.providerPrefs.allowFallbacks);
    setStreamResponses(core.providerPrefs.streamResponses ?? true);
    setRenderMarkdown(core.providerPrefs.renderMarkdown ?? true);
    setZdr(core.providerPrefs.zdr);
    setRateLimitRetries(core.providerPrefs.rateLimitRetries ?? 1);
    setRateLimitWaitSeconds(core.providerPrefs.rateLimitWaitSeconds ?? 3);
    setAppendedPrompts([...core.appendedSystemPrompts]);
    setResetStatus('All settings reset to defaults.');
    setTimeout(() => setResetStatus(''), 3000);
  };

  const handleAddAppendedPrompt = () => {
    setAppendedPrompts([
      ...appendedPrompts,
      { id: crypto.randomUUID(), text: '', enabled: true },
    ]);
  };

  const handleUpdateAppendedPrompt = (
    id: string,
    updates: Partial<{ text: string; enabled: boolean }>,
  ) => {
    setAppendedPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  };

  const handleDeleteAppendedPrompt = (id: string) => {
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      setAppendedPrompts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <PageLayout>
      <div className="header">
        <h1>Settings</h1>
      </div>

      <div id="llm-settings-container">
        <h2>OpenRouter API</h2>

        <div
          style={{
            marginBottom: '20px',
            padding: '15px',
            background: '#f5f5f5',
            borderRadius: '4px',
            border: '1px solid #ddd',
          }}
        >
          <label
            htmlFor="preset-select"
            style={{
              fontWeight: 'bold',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Active Preset:
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              id="preset-select"
              value={activePresetId}
              onChange={handlePresetChange}
              style={{
                flexGrow: 1,
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            >
              {core.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button
              onClick={handleCreatePreset}
              style={{ padding: '8px 12px' }}
            >
              New
            </Button>
            <Button
              onClick={handleRenamePreset}
              style={{ padding: '8px 12px' }}
            >
              Rename
            </Button>
            <Button
              variant="danger"
              onClick={handleDeletePreset}
              disabled={core.presets.length <= 1}
              style={{ padding: '8px 12px' }}
            >
              Delete
            </Button>
          </div>
        </div>

        <Input
          label="API Key:"
          type="password"
          placeholder="sk-or-v1-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          id="shared-api-key"
        />

        <div
          className="flex-row"
          style={{ alignItems: 'flex-end', position: 'relative' }}
        >
          <div style={{ flexGrow: 1 }} className="custom-dropdown-container">
            <Input
              label="Model:"
              type="text"
              id="shared-model-input"
              autoComplete="off"
              placeholder="Select or type model ID..."
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            {showDropdown && filteredModels.length > 0 && (
              <ul
                id="shared-models-list"
                className="custom-dropdown-list"
                style={{
                  display: 'block',
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'white',
                  border: '1px solid #ccc',
                  zIndex: 1000,
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                }}
              >
                {filteredModels.map((m) => (
                  <li
                    key={m.id}
                    style={{ padding: '8px', cursor: 'pointer' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setModel(m.id);
                      setShowDropdown(false);
                    }}
                  >
                    {m.name} ({m.id})
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            onClick={fetchModels}
            loading={isLoading}
            id="shared-fetch-models-btn"
            style={{ marginBottom: '15px' }}
          >
            Fetch Models
          </Button>
        </div>
        <span
          id="shared-status-text"
          className="status"
          style={{ color: isError ? 'red' : 'green' }}
        >
          {statusText}
        </span>

        <h2>OpenRouter Provider Routing</h2>

        <label htmlFor="provider-reasoning-effort">
          Reasoning Effort (if supported by model):
        </label>
        <select
          id="provider-reasoning-effort"
          value={reasoningEffort}
          onChange={(e) => setReasoningEffort(e.target.value)}
        >
          <option value="">Default</option>
          <option value="xhigh">XHigh</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="minimal">Minimal</option>
          <option value="none">None</option>
        </select>

        <Input
          label="Preferred Provider (order):"
          type="text"
          placeholder="e.g. deepinfra, anthropic"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          id="provider-order"
        />
        <small
          style={{ color: '#666', display: 'block', marginBottom: '10px' }}
        >
          Comma separated provider slugs.
        </small>

        <label htmlFor="provider-data-collection">Data Collection:</label>
        <select
          id="provider-data-collection"
          value={dataCollection}
          onChange={(e) =>
            setDataCollection(e.target.value as 'allow' | 'deny')
          }
        >
          <option value="deny">Deny</option>
          <option value="allow">Allow</option>
        </select>

        <Input
          type="checkbox"
          id="provider-allow-fallbacks"
          label="Allow Fallbacks"
          checked={allowFallbacks}
          onChange={(e) => setAllowFallbacks(e.target.checked)}
          containerStyle={{ display: 'block', marginTop: '15px' }}
        />

        <Input
          type="checkbox"
          id="provider-render-markdown"
          label="Render Markdown in Chat"
          checked={renderMarkdown}
          onChange={(e) => setRenderMarkdown(e.target.checked)}
          containerStyle={{ display: 'block', marginTop: '15px' }}
        />

        <Input
          type="checkbox"
          id="provider-stream-responses"
          label="Stream Responses"
          checked={streamResponses}
          onChange={(e) => setStreamResponses(e.target.checked)}
          containerStyle={{ display: 'block', marginTop: '15px' }}
        />

        <Input
          type="checkbox"
          id="provider-zdr"
          label="Zero Data Retention (ZDR)"
          checked={zdr}
          onChange={(e) => setZdr(e.target.checked)}
          containerStyle={{ display: 'block', marginTop: '15px' }}
        />

        <div style={{ marginTop: '15px' }}>
          <Input
            label="Rate Limit Retries (429):"
            type="number"
            id="provider-rate-limit-retries"
            min={0}
            value={rateLimitRetries}
            onChange={(e) => setRateLimitRetries(parseInt(e.target.value) || 0)}
          />
          <small
            style={{ color: '#666', display: 'block', marginBottom: '10px' }}
          >
            Max times to retry when encountering a 429 rate limit (0 to
            disable).
          </small>

          <Input
            label="Rate Limit Wait (seconds):"
            type="number"
            id="provider-rate-limit-wait-seconds"
            min={1}
            value={rateLimitWaitSeconds}
            onChange={(e) =>
              setRateLimitWaitSeconds(parseInt(e.target.value) || 1)
            }
          />
          <small
            style={{ color: '#666', display: 'block', marginBottom: '10px' }}
          >
            Seconds to wait before retrying a 429 rate limit.
          </small>
        </div>
      </div>

      <hr
        style={{
          marginTop: '30px',
          marginBottom: '20px',
          border: 0,
          borderTop: '1px solid #ccc',
        }}
      />

      <h2>Global System Prompts</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>
        These prompts will be automatically appended to the main system prompt
        in any LLM feature if toggled on.
      </p>

      {appendedPrompts.map((p) => (
        <div
          key={p.id}
          style={{
            marginBottom: '15px',
            padding: '15px',
            background: '#f5f5f5',
            borderRadius: '4px',
            border: '1px solid #ddd',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <Input
              type="checkbox"
              label="Enabled"
              checked={p.enabled}
              onChange={(e) =>
                handleUpdateAppendedPrompt(p.id, { enabled: e.target.checked })
              }
              id={`appended-enabled-${p.id}`}
            />
            <Button
              variant="danger"
              onClick={() => handleDeleteAppendedPrompt(p.id)}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Delete
            </Button>
          </div>
          <TextArea
            label="Prompt Text:"
            value={p.text}
            onChange={(e) =>
              handleUpdateAppendedPrompt(p.id, { text: e.target.value })
            }
            rows={4}
            id={`appended-text-${p.id}`}
          />
        </div>
      ))}

      <Button onClick={handleAddAppendedPrompt} style={{ marginTop: '10px' }}>
        Add Prompt
      </Button>

      <hr
        style={{
          marginTop: '30px',
          marginBottom: '20px',
          border: 0,
          borderTop: '1px solid #ccc',
        }}
      />

      <h2>Data Management</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Manage stored data across all tools in this browser.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Button
          variant="danger"
          onClick={handleResetToolSettings}
          id="reset-tool-settings-btn"
        >
          Reset All Tools Settings (Keep OpenRouter)
        </Button>
        <Button
          variant="danger"
          onClick={handleResetAllSettings}
          id="reset-all-settings-btn"
        >
          Reset ALL Settings (Including OpenRouter)
        </Button>
      </div>
      <span
        id="reset-status"
        className="status"
        style={{ display: 'block', marginTop: '10px', color: 'green' }}
      >
        {resetStatus}
      </span>
    </PageLayout>
  );
};
