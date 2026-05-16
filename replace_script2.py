import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Update useEffect for activeThreadId
old_use_effect = """
  // Update Core when Active Thread Changes
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
  }, [activeThreadId]);
"""
new_use_effect = """
  // Update Core when Active Thread Changes
  useEffect(() => {
    if (!activeThreadId) return;
    core.storagePrefix = `llm-chat-thread-${activeThreadId}-`;
    core.loadChatState();

    setSystemPrompt(core.systemPrompt);
    setSelectedPromptId(core.selectedPromptId);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));

    setStorage('llm-chat-activeThreadId', activeThreadId);
  }, [activeThreadId]);
"""
content = content.replace(old_use_effect.strip(), new_use_effect.strip())

# Update initial load useEffect
old_use_effect_init = """
    core.registerTool(askQuestionTool);
    core.loadChatState();
    setSystemPrompt(core.systemPrompt);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));
  }, []);
"""
new_use_effect_init = """
    core.registerTool(askQuestionTool);
    core.loadChatState();
    setSystemPrompt(core.systemPrompt);
    setSelectedPromptId(core.selectedPromptId);
    setHistory([...core.history]);
    setSavedPrompts([...core.savedPrompts]);
    setToolsEnabled(core.toolsEnabled);
    setDisabledTools(new Set(core.disabledTools));
  }, []);
"""
content = content.replace(old_use_effect_init.strip(), new_use_effect_init.strip())


with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
