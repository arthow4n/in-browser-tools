import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

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

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
