import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Modify handle functions
old_funcs = """
  const handleSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setSystemPrompt(e.target.value);
    core.systemPrompt = e.target.value;
    core.saveChatState();
  };

  const handleImprovePrompt = async () => {
    await runImproveAction('Improving...', async () => {
      if (!core.apiKey || !core.model) {
        throw new Error('API Key and Model are required to improve prompt.');
      }
      const improved = await core.improveSystemPrompt(
        promptIntention,
        promptHowToImprove,
        promptEvaluationFocus,
      );
      setSystemPrompt(improved);
      core.systemPrompt = improved;
      core.saveChatState();
    });
  };

  const handleSavePrompt = () => {
    const name = prompt('Enter a name for this system prompt:');
    if (!name) return;
    const id = Date.now().toString();
    core.savedPrompts.push({ id, name, content: core.systemPrompt });
    core.saveChatState();
    setSavedPrompts([...core.savedPrompts]);
    setSelectedPromptId(id);
  };

  const handleUpdatePrompt = () => {
    if (!selectedPromptId) return;
    const sp = core.savedPrompts.find((p) => p.id === selectedPromptId);
    if (sp) {
      sp.content = core.systemPrompt;
      core.saveChatState();
      setSavedPrompts([...core.savedPrompts]);
    }
  };

  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    if (!id) return;
    const sp = core.savedPrompts.find((p) => p.id === id);
    if (sp) {
      setSystemPrompt(sp.content);
      core.systemPrompt = sp.content;
      core.saveChatState();
    }
  };
"""

new_funcs = """
  const hasChanges = (() => {
    if (!selectedPromptId) return false;
    const builtin = BUILT_IN_PROMPTS.find(p => p.id === selectedPromptId);
    if (builtin) {
      return builtin.content !== systemPrompt || builtin.toolsEnabled !== toolsEnabled || JSON.stringify(builtin.disabledTools.sort()) !== JSON.stringify(Array.from(disabledTools).sort());
    }
    const custom = savedPrompts.find(p => p.id === selectedPromptId);
    if (custom) {
      const customToolsEnabled = custom.toolsEnabled ?? false;
      const customDisabledTools = custom.disabledTools ?? [];
      return custom.content !== systemPrompt || customToolsEnabled !== toolsEnabled || JSON.stringify(customDisabledTools.sort()) !== JSON.stringify(Array.from(disabledTools).sort());
    }
    return false;
  })();

  const handleSystemPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setSystemPrompt(e.target.value);
    core.systemPrompt = e.target.value;
    core.saveChatState();
  };

  const handleImprovePrompt = async () => {
    await runImproveAction('Improving...', async () => {
      if (!core.apiKey || !core.model) {
        throw new Error('API Key and Model are required to improve prompt.');
      }
      const improved = await core.improveSystemPrompt(
        promptIntention,
        promptHowToImprove,
        promptEvaluationFocus,
      );
      setSystemPrompt(improved);
      core.systemPrompt = improved;
      core.saveChatState();
    });
  };

  const handleSavePrompt = () => {
    const name = prompt('Enter a name for this system prompt:');
    if (!name) return;
    const id = Date.now().toString();
    core.savedPrompts.push({
      id,
      name,
      content: core.systemPrompt,
      toolsEnabled: core.toolsEnabled,
      disabledTools: Array.from(core.disabledTools)
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

  const handlePromptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPromptId(id);
    core.selectedPromptId = id;

    if (!id) {
      core.saveChatState();
      return;
    }

    const builtin = BUILT_IN_PROMPTS.find((p) => p.id === id);
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
"""

content = content.replace(old_funcs.strip(), new_funcs.strip())

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
