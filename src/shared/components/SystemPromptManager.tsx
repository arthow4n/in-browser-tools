import React, { useState, useEffect } from 'react';
import { Panel } from './Panel.js';
import { TextArea } from './TextArea.js';
import { Input } from './Input.js';
import { Button } from './Button.js';
import { ChatCore, SavedPrompt } from '../../llm-chat/core.js';

interface BuiltInPrompt {
  id: string;
  name: string;
  content: string;
  toolsEnabled: boolean;
  disabledTools: string[];
}

interface SystemPromptManagerProps {
  core: ChatCore;
  builtInPrompts: BuiltInPrompt[];
  children?: React.ReactNode;
}

export const SystemPromptManager: React.FC<SystemPromptManagerProps> = ({
  core,
  builtInPrompts,
  children,
}) => {
  const [systemPrompt, setSystemPrompt] = useState(core.systemPrompt);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(core.selectedPromptId);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([...core.savedPrompts]);
  const [toolsEnabled, setToolsEnabled] = useState(core.toolsEnabled);
  const [disabledTools, setDisabledTools] = useState<Set<string>>(new Set(core.disabledTools));

  useEffect(() => {
    setSystemPrompt(core.systemPrompt);
    setSelectedPromptId(core.selectedPromptId);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));
  }, [core, core.systemPrompt, core.selectedPromptId, core.savedPrompts, core.toolsEnabled, core.disabledTools]);

  const hasChanges = (() => {
    if (!selectedPromptId) return false;
    const builtin = builtInPrompts.find((p) => p.id === selectedPromptId);
    if (builtin) {
      return (
        builtin.content !== systemPrompt ||
        builtin.toolsEnabled !== toolsEnabled ||
        JSON.stringify(builtin.disabledTools.sort()) !==
          JSON.stringify(Array.from(disabledTools).sort())
      );
    }
    const custom = savedPrompts.find((p) => p.id === selectedPromptId);
    if (custom) {
      const customToolsEnabled = custom.toolsEnabled ?? false;
      const customDisabledTools = custom.disabledTools ?? [];
      return (
        custom.content !== systemPrompt ||
        customToolsEnabled !== toolsEnabled ||
        JSON.stringify(customDisabledTools.sort()) !==
          JSON.stringify(Array.from(disabledTools).sort())
      );
    }
    return false;
  })();

  const handleSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSystemPrompt(e.target.value);
    core.systemPrompt = e.target.value;
    core.saveChatState();
  };

  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    core.selectedPromptId = id;

    if (!id) {
      core.saveChatState();
      return;
    }

    const builtin = builtInPrompts.find((p) => p.id === id);
    if (builtin) {
      setSystemPrompt(builtin.content);
      core.systemPrompt = builtin.content;
      setToolsEnabled(builtin.toolsEnabled);
      core.toolsEnabled = builtin.toolsEnabled;
      setDisabledTools(new Set(builtin.disabledTools));
      core.disabledTools = new Set(builtin.disabledTools);
      core.saveChatState();
      return;
    }

    const custom = core.savedPrompts.find((p) => p.id === id);
    if (custom) {
      setSystemPrompt(custom.content);
      core.systemPrompt = custom.content;
      const customToolsEnabled = custom.toolsEnabled ?? false;
      const customDisabledTools = custom.disabledTools ?? [];
      setToolsEnabled(customToolsEnabled);
      core.toolsEnabled = customToolsEnabled;
      setDisabledTools(new Set(customDisabledTools));
      core.disabledTools = new Set(customDisabledTools);
      core.saveChatState();
    }
  };

  const handleSavePrompt = () => {
    const name = prompt('Enter a name for this system prompt:');
    if (!name) return;
    const id = crypto.randomUUID();
    core.savedPrompts.push({
      id,
      name,
      content: core.systemPrompt,
      toolsEnabled: core.toolsEnabled,
      disabledTools: Array.from(core.disabledTools),
    });
    core.selectedPromptId = id;
    core.saveChatState();
    setSavedPrompts([...core.savedPrompts]);
    setSelectedPromptId(id);
  };

  const handleUpdatePrompt = () => {
    if (!selectedPromptId) return;
    const sp = core.savedPrompts.find((p) => p.id === selectedPromptId);
    if (sp) {
      sp.content = core.systemPrompt;
      sp.toolsEnabled = core.toolsEnabled;
      sp.disabledTools = Array.from(core.disabledTools);
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
    }
  };

  const handleDeletePrompt = () => {
    if (!selectedPromptId) return;
    if (confirm('Delete this saved prompt?')) {
      core.savedPrompts = core.savedPrompts.filter((p) => p.id !== selectedPromptId);
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
      setSelectedPromptId('');
    }
  };

  const handleToolEnableToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setToolsEnabled(checked);
    core.toolsEnabled = checked;
    core.saveChatState();
  };

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    core.setToolEnabled(toolName, enabled);
    core.saveChatState();
    setDisabledTools(new Set(core.disabledTools));
  };

  return (
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
            {builtInPrompts.map((bp) => (
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
          <span
            style={{
              color: '#d97706',
              marginLeft: '10px',
              fontWeight: 'bold',
            }}
          >
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
        {selectedPromptId && !builtInPrompts.find((p) => p.id === selectedPromptId) && (
          <Button onClick={handleUpdatePrompt} id="update-prompt-btn">
            Save
          </Button>
        )}
        <Button onClick={handleSavePrompt} id="save-prompt-btn">
          Save As New...
        </Button>
        {selectedPromptId && !builtInPrompts.find((p) => p.id === selectedPromptId) && (
          <Button variant="danger" onClick={handleDeletePrompt} id="delete-prompt-btn">
            Delete
          </Button>
        )}
      </div>

      {children}
    </Panel>
  );
};
