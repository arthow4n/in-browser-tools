import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Add isSystemPromptDirty state
content = content.replace(
"""  const [systemPrompt, setSystemPrompt] = useState(core.systemPrompt);""",
"""  const [systemPrompt, setSystemPrompt] = useState(core.systemPrompt);
  const [isSystemPromptDirty, setIsSystemPromptDirty] = useState(false);"""
)

# Modify the TextArea to show unsaved changes
old_textarea = """      <Panel title="System Prompt">
        <TextArea
          id="system-prompt"
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          rows={4}
        />"""

new_textarea = """      <Panel title="System Prompt">
        <TextArea
          id="system-prompt"
          label={isSystemPromptDirty ? "System Prompt (Unsaved Changes)" : "System Prompt"}
          value={systemPrompt}
          onChange={handleSystemPromptChange}
          rows={4}
        />"""

content = content.replace(old_textarea, new_textarea)


# Modify handleSystemPromptChange
# The prompt says: "When the user is editing system prompt, don't save it immediately to the same system prompt slot, instead just indicate the change and that the user must manually click save to save the system prompt."
# The original code ONLY saved it to the active thread (core.systemPrompt).
# Wait, "system prompt slot" implies the selected prompt from the dropdown. The original code didn't save to the dropdown slot either (it required clicking Update).
# However, if the user means the thread's active prompt SHOULDN'T auto-save, we'll keep `core.systemPrompt` update but maybe we need to click save?
# Wait! "When the user is editing system prompt, don't save it immediately to the same system prompt slot"
# If we just change `handleSystemPromptChange` to only `setSystemPrompt` and `setIsSystemPromptDirty`, how do we ever save to the thread?
# Oh! We have a `handleUpdatePrompt` which saves to `core.savedPrompts`. If we don't save to `core.systemPrompt`, the thread doesn't know about it.
# Let's keep `core.systemPrompt = e.target.value` and `core.saveChatState()` in `handleSystemPromptChange`, so the thread persists it. The "unsaved changes" might just mean relative to the selected saved prompt!
# Let's read the prompt again: "When the user is editing system prompt, don't save it immediately to the same system prompt slot, instead just indicate the change and that the user must manually click save to save the system prompt. This applies to both built-in and custom system prompts."
# Ah! "slot" means the built-in/custom prompt. So we just need to track if `systemPrompt` differs from the currently selected prompt.
old_handler = """  const handleSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setSystemPrompt(e.target.value);
    core.systemPrompt = e.target.value;
    core.saveChatState();
  };"""

new_handler = """  const handleSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setSystemPrompt(e.target.value);
    core.systemPrompt = e.target.value;
    core.saveChatState();
    setIsSystemPromptDirty(true);
  };"""

content = content.replace(old_handler, new_handler)

# Modify prompt selector UI
old_select = """          <select
            id="saved-prompts-select"
            value={selectedPromptId}
            onChange={handlePromptSelect}
          >
            <option value="">-- Load Saved Prompt --</option>
            {savedPrompts.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>"""

new_select = """          <select
            id="saved-prompts-select"
            value={selectedPromptId}
            onChange={handlePromptSelect}
          >
            <option value="">-- Load Saved Prompt --</option>
            <optgroup label="--- Built-in ---">
              {core.builtInPrompts.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="--- Custom ---">
              {savedPrompts.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </optgroup>
          </select>"""

content = content.replace(old_select, new_select)


# Modify handlePromptSelect
old_handle_select = """  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    if (!id) return;
    const sp = core.savedPrompts.find((p) => p.id === id);
    if (sp) {
      setSystemPrompt(sp.content);
      core.systemPrompt = sp.content;
      core.saveChatState();
    }
  };"""

new_handle_select = """  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    if (!id) {
      setIsSystemPromptDirty(false);
      return;
    }
    const sp = core.builtInPrompts.find((p) => p.id === id) || core.savedPrompts.find((p) => p.id === id);
    if (sp) {
      setSystemPrompt(sp.content);
      setIsSystemPromptDirty(false);
      core.systemPrompt = sp.content;

      if (sp.toolsEnabled !== undefined) {
        setToolsEnabled(sp.toolsEnabled);
        core.toolsEnabled = sp.toolsEnabled;
      }
      if (sp.disabledTools !== undefined) {
        setDisabledTools(new Set(sp.disabledTools));
        core.disabledTools = new Set(sp.disabledTools);
      }

      core.saveChatState();
    }
  };"""

content = content.replace(old_handle_select, new_handle_select)


# Modify handleSavePrompt
old_handle_save = """  const handleSavePrompt = () => {
    const name = prompt('Enter a name for this system prompt:');
    if (!name) return;
    const id = Date.now().toString();
    core.savedPrompts.push({ id, name, content: core.systemPrompt });
    core.saveChatState();
    setSavedPrompts([...core.savedPrompts]);
    setSelectedPromptId(id);
  };"""

new_handle_save = """  const handleSavePrompt = () => {
    const name = prompt('Enter a name for this system prompt:');
    if (!name) return;
    const id = Date.now().toString();
    core.savedPrompts.push({ id, name, content: systemPrompt, toolsEnabled, disabledTools: Array.from(disabledTools) });
    core.saveChatState();
    setSavedPrompts([...core.savedPrompts]);
    setSelectedPromptId(id);
    setIsSystemPromptDirty(false);
  };"""

content = content.replace(old_handle_save, new_handle_save)


# Modify handleUpdatePrompt
old_handle_update = """  const handleUpdatePrompt = () => {
    if (!selectedPromptId) return;
    const sp = core.savedPrompts.find((p) => p.id === selectedPromptId);
    if (sp) {
      sp.content = core.systemPrompt;
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
    }
  };"""

new_handle_update = """  const handleUpdatePrompt = () => {
    if (!selectedPromptId) return;
    const sp = core.savedPrompts.find((p) => p.id === selectedPromptId);
    if (sp) {
      sp.content = systemPrompt;
      sp.toolsEnabled = toolsEnabled;
      sp.disabledTools = Array.from(disabledTools);
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
      setIsSystemPromptDirty(false);
    }
  };"""

content = content.replace(old_handle_update, new_handle_update)


# Move tools UI
tools_ui = """        <div className="flex-row">
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
        )}"""

content = content.replace(tools_ui, "")

prompt_improver_end = """            </span>
          </div>
        </details>"""

insert_index = content.find(prompt_improver_end)
if insert_index != -1:
    insert_point = insert_index + len(prompt_improver_end)
    content = content[:insert_point] + "\n\n" + tools_ui + content[insert_point:]

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
