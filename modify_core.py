import re

with open('src/llm-chat/core.ts', 'r') as f:
    content = f.read()

# Add to interface SavedPrompt
content = content.replace(
"""export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
}""",
"""export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
  toolsEnabled?: boolean;
  disabledTools?: string[];
}"""
)

# Add builtInPrompts
built_in_prompts = """  public builtInPrompts: SavedPrompt[] = [
    {
      id: 'builtin-assistant',
      name: 'Assistant',
      content: 'You are a helpful assistant.',
      toolsEnabled: false,
      disabledTools: []
    },
    {
      id: 'builtin-brainpicker',
      name: 'Brain-picker',
      content: 'You are a Brain-Picker. Your goal is NOT to answer questions or provide solutions directly. Instead, aggressively use the ask_question tool to make the user elaborate, think out loud, and flesh out their vague ideas. Always provide diverse options when invoking ask_question rather than leaving free input all the time. Help the user clarify their own thoughts.',
      toolsEnabled: true,
      disabledTools: []
    }
  ];"""

content = content.replace(
"""  public tools: AgentTool[] = [];""",
"""  public tools: AgentTool[] = [];
""" + built_in_prompts
)

with open('src/llm-chat/core.ts', 'w') as f:
    f.write(content)
