import { ChatCore, ChatMessage } from '../llm-chat/core.js';

export class TextAdventureCore extends ChatCore {
  public characterDescription: string = '';
  public scenarioRequest: string = '';

  constructor() {
    super();
    this.toolsEnabled = true;

    // Explicitly call loadChatState here again because super() calls the parent's loadChatState
    // which won't initialize characterDescription and scenarioRequest yet.
    this.loadChatState();
    this.registerTool({
      name: 'speak',
      description:
        'Speak as a character or the narrator. You MUST use this tool to communicate anything to the user. Your regular text response is hidden.',
      parameters: {
        type: 'object',
        properties: {
          character: {
            type: 'string',
            description: "The name of the character speaking, or 'Narrator'.",
          },
          message: {
            type: 'string',
            description: 'The message they say or the narration.',
          },
        },
        required: ['character', 'message'],
      },
      execute: () => {
        // This is a UI-driven tool, execution is handled at the index.ts level.
        return { success: true };
      },
    });
  }

  override loadChatState() {
    this.systemPrompt =
      localStorage.getItem('text-adventure-systemPrompt') ||
      'You are a text adventure writer agent. You act as the narrator and any characters involved in the story. Keep the story engaging. Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to progress the story and keep the user engaged. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the `speak` tool to narrate the story or have characters speak to the user.';

    try {
      this.history = JSON.parse(
        localStorage.getItem('text-adventure-history') || '[]',
      );
    } catch {
      this.history = [];
    }

    this.characterDescription =
      localStorage.getItem('text-adventure-characterDescription') || '';
    this.scenarioRequest =
      localStorage.getItem('text-adventure-scenarioRequest') || '';
  }

  override saveChatState() {
    localStorage.setItem('text-adventure-systemPrompt', this.systemPrompt);
    localStorage.setItem(
      'text-adventure-history',
      JSON.stringify(this.history),
    );
    localStorage.setItem(
      'text-adventure-characterDescription',
      this.characterDescription,
    );
    localStorage.setItem(
      'text-adventure-scenarioRequest',
      this.scenarioRequest,
    );
  }

  public getDynamicSystemPrompt(): string {
    return `You are a text adventure writer agent. You must drive the story forward and act as the narrator and any characters involved in the story. Keep the story engaging.

Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to progress the story and keep the user engaged. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the \`speak\` tool to narrate the story or have characters speak to the user.

[OOC - Initial Scenario]:
${this.scenarioRequest}

[OOC - Player Character]:
${this.characterDescription}`;
  }
}
