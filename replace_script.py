import re

with open('src/llm-chat/App.tsx', 'r') as f:
    content = f.read()

# Add BUILT_IN_PROMPTS import
content = content.replace("import { ChatCore, ChatMessage } from './core.js';", "import { ChatCore, ChatMessage, BUILT_IN_PROMPTS } from './core.js';")

with open('src/llm-chat/App.tsx', 'w') as f:
    f.write(content)
