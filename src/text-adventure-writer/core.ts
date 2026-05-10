import { ChatCore, ChatMessage } from '../llm-chat/core.js';
import { StreamChunk } from '../shared/llm-core.js';

export class TextAdventureCore extends ChatCore {
  public characterName: string = '';
  public characterDescription: string = '';
  public scenarioRequest: string = '';

  constructor() {
    super();
    this.toolsEnabled = true;

    // Explicitly call loadChatState here again because super() calls the parent's loadChatState
    // which won't initialize characterName and characterDescription yet.
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
    const defaultPrompt =
      'You are a text adventure writer agent. You must drive the story forward and act as the narrator and any characters involved in the story. Keep the story engaging, vibrant, and immersive. Make sure to describe the environment, the sensory details, and the character emotions in a way that makes the user feel they are truly in the scenario. Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to progress the story and keep the user engaged. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the `speak` tool to narrate the story or have characters speak to the user.';

    const oldDefaultPrompt = 'You are a text adventure writer agent. You must drive the story forward and act as the narrator and any characters involved in the story. Keep the story engaging. Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to progress the story and keep the user engaged. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the `speak` tool to narrate the story or have characters speak to the user.';

    const savedPrompt = localStorage.getItem('text-adventure-systemPrompt');
    if (!savedPrompt || savedPrompt === oldDefaultPrompt) {
      this.systemPrompt = defaultPrompt;
    } else {
      this.systemPrompt = savedPrompt;
    }

    try {
      this.history = JSON.parse(
        localStorage.getItem('text-adventure-history') || '[]',
      );
    } catch {
      this.history = [];
    }

    this.characterName =
      localStorage.getItem('text-adventure-characterName') || '';
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
    localStorage.setItem('text-adventure-characterName', this.characterName);
    localStorage.setItem(
      'text-adventure-characterDescription',
      this.characterDescription,
    );
    localStorage.setItem(
      'text-adventure-scenarioRequest',
      this.scenarioRequest,
    );
  }

  public async *generateNextAction(
    guidance: string,
  ): AsyncGenerator<string, void, unknown> {
    const plainTextHistory: ChatMessage[] = this.history.map((msg) => {
      let content = msg.content || '';
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'speak') {
            try {
              const args = JSON.parse(tc.function.arguments);
              content += `\n[${args.character}]: ${args.message}`;
            } catch {
              // ignore invalid JSON
            }
          }
        }
      }
      return {
        id: msg.id,
        role: msg.role === 'tool' ? 'system' : msg.role, // Tools don't make sense in plain text, just treat as system or strip
        content: content.trim(),
      };
    }).filter(m => m.content);

    const messages: ChatMessage[] = [
      {
        id: 'sys-next-action',
        role: 'system',
        content: `You are an assistant helping the player decide what to say or do next in their text adventure.
Analyze the story history. Provide a brief, single action or dialogue for the player character to take next.
Do NOT narrate the outcome or speak for other characters. Output ONLY the plain text that should go into the user's input box. You must NOT use JSON or tool formats.`,
      },
      ...plainTextHistory,
    ];

    let userPrompt = 'Based on the story so far, what should I do next?';
    if (guidance) {
      userPrompt += `\n\nGuidance: ${guidance}`;
    }

    messages.push({
      id: 'user-next-action',
      role: 'user',
      content: userPrompt,
    });

    // Temporarily disable tools so the LLM responds in plain text
    const originalToolsEnabled = this.toolsEnabled;
    this.toolsEnabled = false;

    try {
      yield* this.streamChatCompletion(messages);
    } finally {
      this.toolsEnabled = originalToolsEnabled;
    }
  }

  public async *generateCharacter(params: {
    scenarioRequest: string;
    guidance: string;
  }): AsyncGenerator<StreamChunk, void, unknown> {
    const messages: ChatMessage[] = [
      {
        id: 'sys-char-gen',
        role: 'system',
        content:
          'You are a creative assistant helping a player set up a character for a text adventure. Output the character details using the provided tool.',
      },
      {
        id: 'user-char-gen',
        role: 'user',
        content: `Initial Scenario Request: ${params.scenarioRequest}\n\nAdditional Guidance: ${params.guidance}`,
      },
    ];

    const characterTool = {
      name: 'setup_character',
      description: 'Set up the character name and description.',
      parameters: {
        type: 'object',
        properties: {
          characterName: {
            type: 'string',
            description: 'The name of the character.',
          },
          characterDescription: {
            type: 'string',
            description:
              "A brief description of the character's appearance, background, and personality.",
          },
        },
        required: ['characterName', 'characterDescription'],
      },
    };

    yield* this.streamCompletionWithTools(messages, [characterTool]);
  }
}
