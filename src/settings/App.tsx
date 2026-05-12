import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageLayout, Button, Input, TextArea } from '../shared/components/index.js'; // Note we will create this index later or import individually
import { LLMCore } from '../shared/llm-core.js';
import { useAsyncAction } from '../shared/hooks/useAsyncAction.js';
import { clearAllSettings, clearToolSettings } from '../shared/storage.js';
import '../shared/components/styles.css';

const core = new LLMCore();

export const App: React.FC = () => {
  const [apiKey, setApiKey] = useState(core.apiKey);
  const [model, setModel] = useState(core.model);
  const [reasoningEffort, setReasoningEffort] = useState(core.providerPrefs.reasoningEffort || '');
  const [order, setOrder] = useState(core.providerPrefs.order.join(', '));
  const [dataCollection, setDataCollection] = useState(core.providerPrefs.dataCollection);
  const [allowFallbacks, setAllowFallbacks] = useState(core.providerPrefs.allowFallbacks);
  const [zdr, setZdr] = useState(core.providerPrefs.zdr);
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const { isLoading, statusText, isError, runAction } = useAsyncAction();

  useEffect(() => {
    core.apiKey = apiKey;
    core.model = model;
    core.providerPrefs.reasoningEffort = reasoningEffort as '' | 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';
    core.providerPrefs.order = order ? order.split(',').map(s => s.trim()).filter(Boolean) : [];
    core.providerPrefs.dataCollection = dataCollection as 'allow' | 'deny';
    core.providerPrefs.allowFallbacks = allowFallbacks;
    core.providerPrefs.zdr = zdr;
    core.saveState();
  }, [apiKey, model, reasoningEffort, order, dataCollection, allowFallbacks, zdr]);

  const fetchModels = async () => {
    if (!apiKey) {
      alert('Please enter an OpenRouter API Key first.');
      return;
    }
    await runAction('Fetching...', async () => {
      const models = await core.fetchModels();
      setAvailableModels(models);
      setShowDropdown(true);
    }, 'Fetched models successfully.');
  };

  const filteredModels = useMemo(() => {
    const filterText = model.toLowerCase();
    return availableModels.filter(m => m.id.toLowerCase().includes(filterText) || m.name.toLowerCase().includes(filterText));
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
    setZdr(core.providerPrefs.zdr);
    setResetStatus('All settings reset to defaults.');
    setTimeout(() => setResetStatus(''), 3000);
  };

  return (
    <PageLayout>
      <div className="header">
        <h1>Settings</h1>
      </div>

      <div id="llm-settings-container">
        <h2>OpenRouter API</h2>

        <Input
          label="API Key:"
          type="password"
          placeholder="sk-or-v1-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          id="shared-api-key"
        />

        <div className="flex-row" style={{ alignItems: 'flex-end', position: 'relative' }}>
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
              <ul id="shared-models-list" className="custom-dropdown-list" style={{ display: 'block', position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '200px', overflowY: 'auto', background: 'white', border: '1px solid #ccc', zIndex: 1000, margin: 0, padding: 0, listStyle: 'none' }}>
                {filteredModels.map(m => (
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
          <Button onClick={fetchModels} loading={isLoading} id="shared-fetch-models-btn" style={{ marginBottom: '15px' }}>Fetch Models</Button>
        </div>
        <span id="shared-status-text" className="status" style={{ color: isError ? 'red' : 'green' }}>{statusText}</span>

        <h2>OpenRouter Provider Routing</h2>

        <label htmlFor="provider-reasoning-effort">Reasoning Effort (if supported by model):</label>
        <select id="provider-reasoning-effort" value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value)}>
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
        <small style={{ color: '#666', display: 'block', marginBottom: '10px' }}>Comma separated provider slugs.</small>

        <label htmlFor="provider-data-collection">Data Collection:</label>
        <select id="provider-data-collection" value={dataCollection} onChange={(e) => setDataCollection(e.target.value)}>
          <option value="deny">Deny</option>
          <option value="allow">Allow</option>
        </select>

        <label className="checkbox-label" style={{ display: 'block', marginTop: '15px' }}>
          <input type="checkbox" id="provider-allow-fallbacks" checked={allowFallbacks} onChange={(e) => setAllowFallbacks(e.target.checked)} />
          Allow Fallbacks
        </label>

        <label className="checkbox-label" style={{ display: 'block', marginTop: '15px' }}>
          <input type="checkbox" id="provider-zdr" checked={zdr} onChange={(e) => setZdr(e.target.checked)} />
          Zero Data Retention (ZDR)
        </label>
      </div>

      <hr style={{ marginTop: '30px', marginBottom: '20px', border: 0, borderTop: '1px solid #ccc' }} />

      <h2>Data Management</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>Manage stored data across all tools in this browser.</p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Button variant="danger" onClick={handleResetToolSettings} id="reset-tool-settings-btn">Reset All Tools Settings (Keep OpenRouter)</Button>
        <Button variant="danger" onClick={handleResetAllSettings} id="reset-all-settings-btn">Reset ALL Settings (Including OpenRouter)</Button>
      </div>
      <span id="reset-status" className="status" style={{ display: 'block', marginTop: '10px', color: 'green' }}>{resetStatus}</span>

    </PageLayout>
  );
};
