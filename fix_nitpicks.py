import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Fix 1: Thread Switching Leak
# Add setIsSystemPromptDirty(false); to the activeThreadId useEffect
old_use_effect = """  // Update Core when Active Thread Changes
  useEffect(() => {
    if (!activeThreadId) return;
    core.storagePrefix = `llm-chat-thread-${activeThreadId}-`;
    core.loadChatState();

    setSystemPrompt(core.systemPrompt);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));

    setStorage('llm-chat-activeThreadId', activeThreadId);
  }, [activeThreadId]);"""

new_use_effect = """  // Update Core when Active Thread Changes
  useEffect(() => {
    if (!activeThreadId) return;
    core.storagePrefix = `llm-chat-thread-${activeThreadId}-`;
    core.loadChatState();

    setSystemPrompt(core.systemPrompt);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));
    setIsSystemPromptDirty(false); // Reset dirty state on thread switch

    setStorage('llm-chat-activeThreadId', activeThreadId);
  }, [activeThreadId]);"""
content = content.replace(old_use_effect, new_use_effect)


# Fix 2: Hide Update/Delete for built-in prompts
# In handlePromptSelect, it sets selectedPromptId to `id`. But for built-ins, we can either clear selectedPromptId
# or we can check if it starts with 'builtin-' when rendering. Let's check in render:
#           {selectedPromptId && (
# Update to: {selectedPromptId && !selectedPromptId.startsWith('builtin-') && (
old_render_buttons = """          {selectedPromptId && (
            <Button onClick={handleUpdatePrompt} id="update-prompt-btn">
              Save
            </Button>
          )}
          <Button onClick={handleSavePrompt} id="save-prompt-btn">
            Save As New...
          </Button>
          {selectedPromptId && (
            <Button
              variant="danger"
              onClick={handleDeletePrompt}
              id="delete-prompt-btn"
            >
              Delete
            </Button>
          )}"""

new_render_buttons = """          {selectedPromptId && !selectedPromptId.startsWith('builtin-') && (
            <Button onClick={handleUpdatePrompt} id="update-prompt-btn">
              Save
            </Button>
          )}
          <Button onClick={handleSavePrompt} id="save-prompt-btn">
            Save As New...
          </Button>
          {selectedPromptId && !selectedPromptId.startsWith('builtin-') && (
            <Button
              variant="danger"
              onClick={handleDeletePrompt}
              id="delete-prompt-btn"
            >
              Delete
            </Button>
          )}"""
content = content.replace(old_render_buttons, new_render_buttons)


# Fix 3: Tool toggle should trigger dirty state
old_tool_toggle1 = """  const handleToolEnableToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setToolsEnabled(checked);
    core.toolsEnabled = checked;
    core.saveChatState();
  };"""

new_tool_toggle1 = """  const handleToolEnableToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setToolsEnabled(checked);
    core.toolsEnabled = checked;
    core.saveChatState();
    setIsSystemPromptDirty(true);
  };"""
content = content.replace(old_tool_toggle1, new_tool_toggle1)

old_tool_toggle2 = """  const handleToolToggle = (toolName: string, enabled: boolean) => {
    core.setToolEnabled(toolName, enabled);
    core.saveChatState();
    setDisabledTools(new Set(core.disabledTools));
  };"""

new_tool_toggle2 = """  const handleToolToggle = (toolName: string, enabled: boolean) => {
    core.setToolEnabled(toolName, enabled);
    core.saveChatState();
    setDisabledTools(new Set(core.disabledTools));
    setIsSystemPromptDirty(true);
  };"""
content = content.replace(old_tool_toggle2, new_tool_toggle2)

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
