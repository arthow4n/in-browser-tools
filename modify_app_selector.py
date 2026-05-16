import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

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
    if (!id) return;
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
    core.systemPrompt = systemPrompt; // Save current text
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
      core.systemPrompt = systemPrompt;
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
      setIsSystemPromptDirty(false);
    }
  };"""

content = content.replace(old_handle_update, new_handle_update)


with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
