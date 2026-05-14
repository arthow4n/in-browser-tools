import { ChatCore, ChatMessage } from '../llm-chat/core.js';
import { StreamChunk } from '../shared/llm-core.js';
import { getStorage, setStorage } from '../shared/storage.js';

export class TextAdventureCore extends ChatCore {
  public characterName: string = '';
  public characterDescription: string = '';
  public scenarioRequest: string = '';
  public outputLanguage: string = 'Same as the user input language';

  constructor() {
    super();
    this.toolsEnabled = true;

    // Explicitly call loadChatState here again because super() calls the parent's loadChatState
    // which won't initialize characterName and characterDescription yet.
    this.loadChatState();
    this.registerTool({
      name: 'write_action',
      description:
        "Write as a character or the narrator to perform an action or dialogue. You MUST use this tool to communicate anything to the user or write the story. Your regular text response is hidden. You MUST NOT interleave multiple characters or narration in a single tool call. Make a SEPARATE tool call for each character's speech/action and for each piece of narration.",
      parameters: {
        type: 'object',
        properties: {
          character: {
            type: 'string',
            description: "The name of the character, or 'Narrator'.",
          },
          message: {
            type: 'string',
            description:
              'The action they perform, the dialogue they say, or the narration.',
          },
        },
        required: ['character', 'message'],
      },
      execute: () => {
        // This is a UI-driven tool, execution is handled at the index.ts level.
        return { success: true };
      },
    });

    this.registerTool({
      name: 'wait_for_user_input',
      description:
        "Wait for the user's character to take their turn. You MUST use this as your final tool call each turn after you are done writing the narrator and NPC actions. The result of this tool call will be the user's action or dialogue.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: () => {
        return { success: true };
      },
    });
  }

  override loadChatState() {
    const defaultPrompt = `You are an expert text adventure game master and writer. You must drive the story forward autonomously, acting as the narrator and all non-player characters.

CRITICAL INSTRUCTIONS FOR YOUR OUTPUT:
1. You MUST FIRST think out loud about how to progress the story, what characters should do, and how to keep the player immersed. Write this as plain text. (This will be hidden from the player and serves as your internal plan).
2. After your plain text thoughts, you MUST perform MULTIPLE \`write_action\` tool calls to write the story and dialogue for the narrator and various characters.
3. You MUST make a SEPARATE \`write_action\` tool call for EACH character's dialogue/action and EACH piece of narration. Do NOT combine multiple characters or narration into a single tool call.
4. You MUST NOT act or speak for the user's character. Wait for the user to specify their own actions.
5. As your FINAL action for the turn, you MUST call the \`wait_for_user_input\` tool to receive the user's action or dialogue in response to your progression.

EXAMPLE GOOD RESPONSE:
(Plain text)
I need to introduce the dark wizard and set a spooky atmosphere. I will first have the Narrator describe the room, then the Dark Wizard will speak. Then I'll wait for the user.

(Tool calls)
- Call \`write_action\` with character: "Narrator", message: "You step into a dimly lit room, the air thick with the smell of sulfur. Shadows dance on the walls."
- Call \`write_action\` with character: "Dark Wizard", message: "Ah, I have been expecting you, foolish mortal."
- Call \`write_action\` with character: "Narrator", message: "The wizard raises his staff, glowing with an eerie green light."
- Call \`wait_for_user_input\` with empty arguments.

EXAMPLE BAD RESPONSE:
(Plain text)
I will narrate and have the wizard speak.
(Tool call)
- Call \`write_action\` with character: "Narrator", message: "You step into the room. The Dark Wizard says 'I have been expecting you.'" (THIS IS BAD! DO NOT COMBINE!)
- Call \`write_action\` with character: "User", message: "I draw my sword!" (THIS IS BAD! DO NOT ACT FOR THE USER!)

Your responses MUST be substantial, detailed progressions (at least 3-4 paragraphs) that unfold the narrative organically. Do not wait for the player to initiate every single micro-action. Instead, advance the plot, describe the environment with rich, vibrant sensory details, and deeply convey character emotions. At the end of your lengthy progression, present the player with an engaging hook, a cliffhanger, or a meaningful choice to respond to, and then call \`wait_for_user_input\`.`;

    const oldDefaultPrompt5 = `You are an expert text adventure game master and writer. You must drive the story forward autonomously, acting as the narrator and all non-player characters.

CRITICAL INSTRUCTIONS FOR YOUR OUTPUT:
1. You MUST FIRST think out loud about how to progress the story, what characters should do, and how to keep the player immersed. Write this as plain text. (This will be hidden from the player and serves as your internal plan).
2. After your plain text thoughts, you MUST use the \`speak\` tool to actually output the story and dialogue to the player.
3. You MUST make a SEPARATE \`speak\` tool call for EACH character's dialogue and EACH piece of narration. Do NOT combine multiple characters or narration into a single tool call.

EXAMPLE GOOD RESPONSE:
(Plain text)
I need to introduce the dark wizard and set a spooky atmosphere. I will first have the Narrator describe the room, then the Dark Wizard will speak.

(Tool calls)
- Call \`speak\` with character: "Narrator", message: "You step into a dimly lit room, the air thick with the smell of sulfur. Shadows dance on the walls."
- Call \`speak\` with character: "Dark Wizard", message: "Ah, I have been expecting you, foolish mortal."
- Call \`speak\` with character: "Narrator", message: "The wizard raises his staff, glowing with an eerie green light."

EXAMPLE BAD RESPONSE:
(Plain text)
I will narrate and have the wizard speak.
(Tool call)
- Call \`speak\` with character: "Narrator", message: "You step into the room. The Dark Wizard says 'I have been expecting you.'" (THIS IS BAD! DO NOT COMBINE!)

Your responses MUST be substantial, detailed progressions (at least 3-4 paragraphs) that unfold the narrative organically. Do not wait for the player to initiate every single micro-action. Instead, advance the plot, describe the environment with rich, vibrant sensory details, and deeply convey character emotions. At the end of your lengthy progression, present the player with an engaging hook, a cliffhanger, or a meaningful choice to respond to.`;

    const oldDefaultPrompt4 =
      "You are an expert text adventure game master and writer. You must drive the story forward autonomously, acting as the narrator and all non-player characters. Your responses MUST be substantial, detailed progressions (at least 3-4 paragraphs) that unfold the narrative organically. Do not wait for the player to initiate every single micro-action. Instead, advance the plot, describe the environment with rich, vibrant sensory details, and deeply convey character emotions. At the end of your lengthy progression, present the player with an engaging hook, a cliffhanger, or a meaningful choice to respond to. Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to dramatically progress the story, introduce new elements, and keep the user fully immersed. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the `speak` tool to narrate the lengthy story progression or have characters speak to the user. Crucially, you MUST NOT interleave different characters' dialogue or narration in a single `speak` tool call. If the narrator speaks, then a character speaks, then the narrator speaks again, this MUST be three separate tool calls.";

    const oldDefaultPrompt2 =
      'You are a text adventure writer agent. You must drive the story forward and act as the narrator and any characters involved in the story. Keep the story engaging, vibrant, and immersive. Make sure to describe the environment, the sensory details, and the character emotions in a way that makes the user feel they are truly in the scenario. Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to progress the story and keep the user engaged. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the `speak` tool to narrate the story or have characters speak to the user.';

    const oldDefaultPrompt1 =
      'You are a text adventure writer agent. You must drive the story forward and act as the narrator and any characters involved in the story. Keep the story engaging. Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to progress the story and keep the user engaged. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the `speak` tool to narrate the story or have characters speak to the user.';
    const oldDefaultPrompt3 =
      'You are an expert text adventure game master and writer. You must drive the story forward autonomously, acting as the narrator and all non-player characters. Your responses MUST be substantial, detailed progressions (at least 3-4 paragraphs) that unfold the narrative organically. Do not wait for the player to initiate every single micro-action. Instead, advance the plot, describe the environment with rich, vibrant sensory details, and deeply convey character emotions. At the end of your lengthy progression, present the player with an engaging hook, a cliffhanger, or a meaningful choice to respond to. Before making a tool call to write as a character or the narrator, you must CONSTANTLY think about how to dramatically progress the story, introduce new elements, and keep the user fully immersed. Write these thoughts out loud in plain text. Your plain text thoughts will be hidden from the user, serving as your internal plan. Then, you MUST use the `speak` tool to narrate the lengthy story progression or have characters speak to the user.';

    const savedPrompt = getStorage('text-adventure-systemPrompt');
    if (
      !savedPrompt ||
      savedPrompt === oldDefaultPrompt1 ||
      savedPrompt === oldDefaultPrompt2 ||
      savedPrompt === oldDefaultPrompt3 ||
      savedPrompt === oldDefaultPrompt4 ||
      savedPrompt === oldDefaultPrompt5
    ) {
      this.systemPrompt = defaultPrompt;
    } else {
      this.systemPrompt = savedPrompt;
    }

    try {
      this.history = JSON.parse(getStorage('text-adventure-history') || '[]');
    } catch {
      this.history = [];
    }

    this.characterName = getStorage('text-adventure-characterName') || '';
    this.characterDescription =
      getStorage('text-adventure-characterDescription') || '';
    this.scenarioRequest = getStorage('text-adventure-scenarioRequest') || '';
    this.outputLanguage =
      getStorage('text-adventure-outputLanguage') ||
      'Same as the user input language';
  }

  override saveChatState() {
    setStorage('text-adventure-systemPrompt', this.systemPrompt);
    setStorage('text-adventure-history', JSON.stringify(this.history));
    setStorage('text-adventure-characterName', this.characterName);
    setStorage(
      'text-adventure-characterDescription',
      this.characterDescription,
    );
    setStorage('text-adventure-scenarioRequest', this.scenarioRequest);
    setStorage('text-adventure-outputLanguage', this.outputLanguage);
  }

  public async *generateNextAction(
    guidance: string,
  ): AsyncGenerator<string, void, unknown> {
    const plainTextHistory: ChatMessage[] = this.history
      .map((msg) => {
        let content = msg.content || '';
        if (
          msg.role === 'assistant' &&
          msg.tool_calls &&
          msg.tool_calls.length > 0
        ) {
          for (const tc of msg.tool_calls) {
            if (
              tc.function.name === 'speak' ||
              tc.function.name === 'write_action'
            ) {
              try {
                const args = JSON.parse(tc.function.arguments);
                content += `\n[${args.character}]: ${args.message}`;
              } catch {
                // ignore invalid JSON
              }
            }
          }
        }

        let role = msg.role;
        // Tool results for wait_for_user_input contain the actual user input
        if (msg.role === 'tool') {
          if (msg.content === '{"success":true}') {
            role = 'system';
          } else {
            role = 'user';
          }
        }

        return {
          id: msg.id,
          role: role,
          content: content.trim(),
        };
      })
      .filter((m) => m.content);

    const messages: ChatMessage[] = [
      {
        id: 'sys-next-action',
        role: 'system',
        content: `You are an assistant helping the player decide what to say or do next in their text adventure.
Analyze the story history. Provide a brief, single action or dialogue for the player character to take next.
Do NOT narrate the outcome or speak for other characters. Output ONLY the plain text that should go into the user's input box. You must NOT use JSON or tool formats.
${this.outputLanguage ? `[OOC - Output Language]: You must output the action/dialogue in the following language: ${this.outputLanguage}. Note: "the user" here refers to the human playing the game, not your "user" role in this chat thread.` : ''}`,
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

  override async *streamChatCompletion(
    newMessages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
    const injectedMessages = [...newMessages];
    if (this.characterDescription) {
      injectedMessages.unshift({
        id: Date.now().toString() + '-sys-injected-char',
        role: 'system',
        content: `[OOC - Character Update]: The user is playing as ${this.characterName || 'an unknown character'}. Description: ${this.characterDescription}`,
      });
    }
    if (this.outputLanguage) {
      injectedMessages.unshift({
        id: Date.now().toString() + '-sys-injected-lang',
        role: 'system',
        content: `[OOC - Output Language]: You must use the following language for all your outputs, responses, narrations, and character dialogues: ${this.outputLanguage}. Note: "the user" here refers to the human playing the game, not your "user" role in this chat thread.`,
      });
    }
    yield* super.streamChatCompletion(injectedMessages);
  }

  override async *streamChatCompletionWithTools(
    newMessages: ChatMessage[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const injectedMessages = [...newMessages];
    if (this.characterDescription) {
      injectedMessages.unshift({
        id: Date.now().toString() + '-sys-injected-char',
        role: 'system',
        content: `[OOC - Character Update]: The user is playing as ${this.characterName || 'an unknown character'}. Description: ${this.characterDescription}`,
      });
    }
    if (this.outputLanguage) {
      injectedMessages.unshift({
        id: Date.now().toString() + '-sys-injected-lang',
        role: 'system',
        content: `[OOC - Output Language]: You must use the following language for all your outputs, responses, narrations, and character dialogues: ${this.outputLanguage}. Note: "the user" here refers to the human playing the game, not your "user" role in this chat thread.`,
      });
    }
    yield* super.streamChatCompletionWithTools(injectedMessages);
  }

  public async *generateOOCResponse(
    question: string,
  ): AsyncGenerator<string, void, unknown> {
    const plainTextHistory: ChatMessage[] = this.history
      .map((msg) => {
        let content = msg.content || '';
        if (
          msg.role === 'assistant' &&
          msg.tool_calls &&
          msg.tool_calls.length > 0
        ) {
          for (const tc of msg.tool_calls) {
            if (
              tc.function.name === 'speak' ||
              tc.function.name === 'write_action'
            ) {
              try {
                const args = JSON.parse(tc.function.arguments);
                content += `\n[${args.character}]: ${args.message}`;
              } catch {
                // ignore invalid JSON
              }
            }
          }
        }

        let role = msg.role;
        if (msg.role === 'tool') {
          if (msg.content === '{"success":true}') {
            role = 'system';
          } else {
            role = 'user';
          }
        }

        return {
          id: msg.id,
          role: role,
          content: content.trim(),
        };
      })
      .filter((m) => m.content);

    const messages: ChatMessage[] = [
      {
        id: 'sys-ooc',
        role: 'system',
        content: `You are the Game Master of this text adventure. The user is asking you an out-of-character (OOC) question about the current game state, their options, or the world. Answer directly and helpfully in plain text. Do not use tool calls. Do not advance the story.
${this.outputLanguage ? `[OOC - Output Language]: You must output your answer in the following language: ${this.outputLanguage}. Note: "the user" here refers to the human playing the game, not your "user" role in this chat thread.` : ''}`,
      },
      ...plainTextHistory,
      {
        id: 'user-ooc',
        role: 'user',
        content: question,
      },
    ];

    const originalToolsEnabled = this.toolsEnabled;
    this.toolsEnabled = false;

    try {
      yield* this.streamChatCompletion(messages);
    } finally {
      this.toolsEnabled = originalToolsEnabled;
    }
  }

  public async *generateScenarioIdeas(params: {
    guidance: string;
    previousIdeas: string[];
  }): AsyncGenerator<StreamChunk, void, unknown> {
    const messages: ChatMessage[] = [
      {
        id: 'sys-scenario-gen',
        role: 'system',
        content: `You are a creative assistant helping a player brainstorm an initial scenario for a text adventure. You MUST use the \`setup_scenarios\` tool to output EXACTLY 3 different, unique scenario ideas. Do not output normal text.${
          this.outputLanguage
            ? '\\n[OOC - Output Language]: You must use the following language for all your outputs and tool calls: ' +
              this.outputLanguage +
              '. Note: "the user" here refers to the human playing the game, not your "user" role in this chat thread.'
            : ''
        }`,
      },
    ];

    let userContent =
      'Please generate 3 different scenario ideas for a text adventure.';
    if (params.guidance) {
      userContent += `\n\nGuidance: ${params.guidance}`;
    }
    if (params.previousIdeas && params.previousIdeas.length > 0) {
      userContent += `\n\nHere are some ideas you previously generated. You MUST generate completely new and different ideas:\n- ${params.previousIdeas.join('\n- ')}`;
    }

    messages.push({
      id: 'user-scenario-gen',
      role: 'user',
      content: userContent,
    });

    const scenarioTool = {
      name: 'setup_scenarios',
      description: 'Set up 3 different scenario ideas.',
      parameters: {
        type: 'object',
        properties: {
          ideas: {
            type: 'array',
            items: {
              type: 'string',
              description: 'A scenario idea.',
            },
            minItems: 3,
            maxItems: 3,
            description: 'Exactly 3 different scenario ideas.',
          },
        },
        required: ['ideas'],
      },
    };

    yield* this.streamCompletionWithTools(messages, [scenarioTool]);
  }

  public async *generateCharacter(params: {
    scenarioRequest: string;
    guidance: string;
  }): AsyncGenerator<StreamChunk, void, unknown> {
    const messages: ChatMessage[] = [
      {
        id: 'sys-char-gen',
        role: 'system',
        content: `You are a creative assistant helping a player set up a character for a text adventure. You MUST use the \`setup_character\` tool to output the character details. Do not output normal text.
${this.outputLanguage ? `[OOC - Output Language]: You must use the following language for all your outputs and tool calls: ${this.outputLanguage}. Note: "the user" here refers to the human playing the game, not your "user" role in this chat thread.` : ''}`,
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
