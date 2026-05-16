import re

with open('src/repo-chat/App.tsx', 'r') as f:
    content = f.read()

# Add a memoized combined system prompt for the chat core when streaming.
# Or wait, the problem is `core.systemPrompt` retains the cloned text AND the base prompt,
# and when switching, it overwrites it.

# The code reviewer says: "the base system prompt and the cloned repository context must be maintained as separate variables and only combined dynamically right before being sent to the LLM."
