import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Add isSystemPromptDirty state
content = content.replace(
"""  const [systemPrompt, setSystemPrompt] = useState(core.systemPrompt);""",
"""  const [systemPrompt, setSystemPrompt] = useState(core.systemPrompt);
  const [isSystemPromptDirty, setIsSystemPromptDirty] = useState(false);"""
)

# Modify handleSystemPromptChange
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
    setIsSystemPromptDirty(true);
  };"""

content = content.replace(old_handler, new_handler)

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
