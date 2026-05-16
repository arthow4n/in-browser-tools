import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Fix types in App.tsx
old_type = "  const [savedPrompts, setSavedPrompts] = useState<\n    { id: string; name: string; content: string }[]\n  >([]);"
new_type = "  const [savedPrompts, setSavedPrompts] = useState<\n    { id: string; name: string; content: string; toolsEnabled?: boolean; disabledTools?: string[] }[]\n  >([]);"
content = content.replace(old_type, new_type)

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
