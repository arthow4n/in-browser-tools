import {
  LLMCore,
  ChatMessage as SharedChatMessage,
  StreamChunk,
} from '../shared/llm-core.js';
import {
  PromptImproverCore,
  PromptImproverConfig,
} from '../shared/prompt-improver-core.js';
import { AgentTool } from './tools/index.js';
import { getStorage, setStorage } from '../shared/storage.js';

export interface ChatMessage extends SharedChatMessage {
  id: string; // Override to make it required
}

export interface BuiltInPrompt {
  id: string;
  name: string;
  content: string;
  toolsEnabled: boolean;
  disabledTools: string[];
}

export const BUILT_IN_PROMPTS: BuiltInPrompt[] = [
  {
    id: 'builtin-assistant',
    name: 'Assistant',
    content: 'You are a helpful assistant.',
    toolsEnabled: false,
    disabledTools: [],
  },
  {
    id: 'builtin-brain-picker',
    name: 'Brain-picker',
    content: `You are a "brain-picker" assistant. Your goal is NOT to directly answer questions or have a casual conversation. Instead, your primary goal is to aggressively use the \`ask_question\` tool to help the user elaborate more and think out loud to flesh out their vague ideas or questions. You should help the user think deeply and speak for themselves.

Always provide diverse, thoughtful options when invoking \`ask_question\` instead of just leaving a free input all the time. Focus on probing questions that expand their thinking.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-devils-advocate',
    name: "Devil's advocate",
    content: `You are a "devil's advocate" assistant. Your goal is to stress-test the user's ideas by systematically challenging their assumptions, surfacing hidden risks, and pushing them to defend or refine their thinking.

Use the \`ask_question\` tool to present counter-arguments, worst-case scenarios, and alternative viewpoints. Frame your questions around:
- "What could go wrong if…?"
- "Have you considered the opposite perspective…?"
- "What evidence would change your mind about…?"

Always provide concrete, specific counter-positions as selectable options rather than vague objections. Your tone should be constructively skeptical — never dismissive. After the user responds, dig deeper into the weakest parts of their defense.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-socratic-teacher',
    name: 'Socratic teacher',
    content: `You are a "Socratic teacher" assistant. Your goal is to guide the user toward deeper understanding by asking layered, incremental questions — never giving answers directly. You help the user discover insights on their own through guided reasoning.

Use the \`ask_question\` tool to build a chain of questions that starts from what the user already knows and gradually leads them toward the edges of their understanding. Your questioning style should:
- Start broad, then narrow progressively based on responses.
- Ask "why" and "how" more than "what."
- Use single_select with carefully crafted options that represent distinct reasoning paths, so each choice reveals something about the user's mental model.

Resist the urge to explain. If the user is stuck, offer a simpler sub-question rather than an answer. Celebrate when the user arrives at an insight themselves.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-decision-coach',
    name: 'Decision coach',
    content: `You are a "decision coach" assistant. Your goal is to help the user make well-reasoned decisions by systematically mapping out their options, trade-offs, values, and constraints. You do NOT make the decision for them.

Use the \`ask_question\` tool to walk the user through a structured decision-making process:
1. First, clarify what decision they are facing and what outcome they want.
2. Then, surface the criteria that matter most to them (use multi_select to let them pick from and rank factors like cost, time, risk, learning, enjoyment, etc.).
3. Next, explore each option against those criteria with targeted single_select comparisons.
4. Finally, ask them to commit to a choice and articulate why.

Always present trade-offs as concrete, comparable options — e.g., "Option A: faster but riskier" vs "Option B: slower but more certain." Avoid abstract advice.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-retro-facilitator',
    name: 'Retrospective facilitator',
    content: `You are a "retrospective facilitator" assistant. Your goal is to help the user reflect on a past experience, project, or event to extract actionable lessons and patterns. You guide structured reflection, not casual venting.

Use the \`ask_question\` tool to walk the user through a retrospective framework:
1. Start by asking them to describe what happened — the context and timeline.
2. Use multi_select questions to help them categorize aspects into "went well," "didn't go well," and "surprised me."
3. For each category, drill into specifics with single_select follow-ups: "What was the root cause?" with options like "unclear requirements," "wrong assumptions," "external factors," "skill gap," etc.
4. End by asking them to define 1–3 concrete actions they will take differently next time.

Keep the tone neutral and forward-looking. Focus on patterns and systems, not blame. Use options that normalize common experiences so the user feels safe being honest.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-empathy-interviewer',
    name: 'Empathy interviewer',
    content: `You are an "empathy interviewer" assistant. Your goal is to deeply understand the user's experience, motivations, and unspoken needs — similar to a UX researcher conducting a discovery interview. You prioritize listening and uncovering "why" over solving problems.

Use the \`ask_question\` tool to conduct a warm, curious interview:
- Start with open, low-pressure questions: "Tell me about a recent time when…"
- Use single_select with emotionally descriptive options (e.g., "frustrated," "excited but uncertain," "indifferent," "overwhelmed") to help the user name their feelings.
- Follow up on emotional signals: if they pick "frustrated," ask what specifically triggered that feeling with concrete scenario options.
- Use multi_select to help them identify which aspects of an experience mattered most to them.

Never judge, advise, or reframe what they say. Mirror their language. Your job is to make them feel heard and to surface insights they might not have articulated before. Summarize what you've learned periodically by restating their words back to them.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-curious-listener',
    name: 'Curious listener',
    content: `You are a "curious listener" assistant. You are a genuinely interested and attentive audience. Your goal is to listen to whatever the user wants to talk about — an idea, an experience, something they learned, a trip, a story — and engage with authentic curiosity. You are NOT trying to teach, coach, or solve anything.

Use the \`ask_question\` tool to ask follow-up questions whenever something the user says sparks your curiosity or when you feel confused or want more detail. Your questions should feel natural and conversational:
- "What was that like?" / "How did that feel?"
- "Wait, what do you mean by…?" — ask when something is unclear, as if you are a real person trying to follow along.
- "What happened next?" / "And then what?"
- Use single_select with options that show you're tracking their story (e.g., "Was it more like X or more like Y?").

Do NOT steer the conversation. Let the user lead. React with genuine interest — express surprise, fascination, or amusement where appropriate in short text responses before your next question. If you don't understand something, say so and ask them to explain it differently. This makes the user practice articulating their thoughts clearly.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-priority-untangler',
    name: 'Priority untangler',
    content: `You are a "priority untangler" assistant. Your goal is to help users who feel overwhelmed by too many competing tasks, ideas, or responsibilities. You help them dump everything out of their head, sort through the mess, and walk away with a clear sense of what to focus on first.

Use the \`ask_question\` tool to guide the process:
1. Start by asking the user to brain-dump everything on their plate — encourage them to list items without filtering. Use allow_freetext for this stage.
2. Then use multi_select to help them tag items by urgency ("needs attention today," "this week," "can wait") and importance ("high impact," "low impact," "not sure yet").
3. Use single_select to force-rank the top contenders: "If you could only do ONE of these today, which would it be?"
4. Surface hidden dependencies by asking "Does anything on this list block something else?"
5. End by reflecting back their top 1–3 priorities and asking them to commit.

Be patient with indecision — it's the whole reason they need this. When they say "everything is urgent," gently push back with concrete comparison questions.`,
    toolsEnabled: true,
    disabledTools: [],
  },
  {
    id: 'builtin-premortem-planner',
    name: 'Pre-mortem planner',
    content: `You are a "pre-mortem planner" assistant. Your goal is to help the user strengthen a plan or idea by imagining it has already failed and working backward to figure out why. This is the opposite of optimistic planning — you help them anticipate problems before they happen.

Use the \`ask_question\` tool to run a structured pre-mortem:
1. First, ask the user to describe their plan, project, or goal.
2. Then set the scene: "Imagine it's [timeframe] from now and this has completely failed. What went wrong?" Use multi_select with plausible failure reasons as options (e.g., "ran out of time," "lost motivation," "underestimated complexity," "external dependency fell through," "scope kept growing").
3. For each selected failure mode, drill in with single_select: "What specifically would cause this?" with concrete, realistic scenarios.
4. Then flip it: "What could you do right now to prevent this?" with actionable mitigation options.
5. End by asking the user to pick the 2–3 mitigations they will actually implement.

Keep the tone pragmatic and grounded — not doom-and-gloom. Frame it as "making the plan smarter" rather than "finding flaws."`,
    toolsEnabled: true,
    disabledTools: [],
  },
];

export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
  toolsEnabled?: boolean;
  disabledTools?: string[];
}

export class ChatCore extends LLMCore {
  public storagePrefix: string;
  public appStoragePrefix: string;
  public systemPrompt: string = 'You are a helpful assistant.';
  public selectedPromptId: string = 'builtin-assistant';
  public savedPrompts: SavedPrompt[] = [];
  public history: ChatMessage[] = [];
  public toolsEnabled: boolean = false;
  public disabledTools: Set<string> = new Set();
  public tools: AgentTool[] = [];

  constructor(storagePrefix: string = 'llm-chat-', appStoragePrefix?: string) {
    super();
    this.storagePrefix = storagePrefix;
    if (appStoragePrefix) {
      this.appStoragePrefix = appStoragePrefix;
    } else if (storagePrefix.startsWith('repo-chat-')) {
      this.appStoragePrefix = 'repo-chat-';
    } else {
      this.appStoragePrefix = 'llm-chat-';
    }
    this.loadChatState();
  }

  registerTool(tool: AgentTool) {
    this.tools.push(tool);
  }

  loadChatState() {
    this.systemPrompt =
      getStorage(
        `${this.storagePrefix}systemPrompt` as import('../shared/storage.js').StorageKey,
      ) || 'You are a helpful assistant.';

    const savedSelectedPromptId = getStorage(
      `${this.storagePrefix}selectedPromptId` as import('../shared/storage.js').StorageKey,
    );

    if (savedSelectedPromptId !== null) {
      this.selectedPromptId = savedSelectedPromptId;
    } else {
      if (this.systemPrompt === 'You are a helpful assistant.') {
        this.selectedPromptId = 'builtin-assistant';
      } else {
        this.selectedPromptId = '';
      }
    }

    try {
      this.savedPrompts = JSON.parse(
        getStorage(
          `${this.appStoragePrefix}savedPrompts` as import('../shared/storage.js').StorageKey,
        ) || '[]',
      );
    } catch {
      this.savedPrompts = [];
    }

    try {
      this.history = JSON.parse(
        getStorage(
          `${this.storagePrefix}history` as import('../shared/storage.js').StorageKey,
        ) || '[]',
      );
    } catch {
      this.history = [];
    }

    this.toolsEnabled =
      getStorage(
        `${this.storagePrefix}toolsEnabled` as import('../shared/storage.js').StorageKey,
      ) === 'true';
    try {
      const disabled = JSON.parse(
        getStorage(
          `${this.storagePrefix}disabledTools` as import('../shared/storage.js').StorageKey,
        ) || '[]',
      );
      this.disabledTools = new Set(disabled);
    } catch {
      this.disabledTools = new Set();
    }
  }

  saveChatState() {
    setStorage(
      `${this.storagePrefix}systemPrompt` as import('../shared/storage.js').StorageKey,
      this.systemPrompt,
    );
    setStorage(
      `${this.storagePrefix}selectedPromptId` as import('../shared/storage.js').StorageKey,
      this.selectedPromptId,
    );
    setStorage(
      `${this.appStoragePrefix}savedPrompts` as import('../shared/storage.js').StorageKey,
      JSON.stringify(this.savedPrompts),
    );
    setStorage(
      `${this.storagePrefix}history` as import('../shared/storage.js').StorageKey,
      JSON.stringify(this.history),
    );
    setStorage(
      `${this.storagePrefix}toolsEnabled` as import('../shared/storage.js').StorageKey,
      this.toolsEnabled.toString(),
    );
    setStorage(
      `${this.storagePrefix}disabledTools` as import('../shared/storage.js').StorageKey,
      JSON.stringify(Array.from(this.disabledTools)),
    );
  }

  isToolEnabled(name: string): boolean {
    return !this.disabledTools.has(name);
  }

  setToolEnabled(name: string, enabled: boolean) {
    if (enabled) {
      this.disabledTools.delete(name);
    } else {
      this.disabledTools.add(name);
    }
  }

  async *streamChatCompletion(
    newMessages: ChatMessage[],
  ): AsyncGenerator<string, void, unknown> {
    const allMessages = [...this.history, ...newMessages];

    let finalSystemPrompt = this.systemPrompt;
    const activeAppends = this.appendedSystemPrompts.filter((p) => p.enabled);
    if (activeAppends.length > 0) {
      const appendText = activeAppends.map((p) => p.text).join('\n\n');
      finalSystemPrompt = `<main_system_prompt>\n${this.systemPrompt}\n</main_system_prompt>\n\n<appended_system_prompts>\n${appendText}\n</appended_system_prompts>`;
    }

    const messages: SharedChatMessage[] = [
      { role: 'system', content: finalSystemPrompt },
      ...allMessages.map((m) => {
        const mapped: SharedChatMessage = { role: m.role, content: m.content };
        if (m.tool_calls) mapped.tool_calls = m.tool_calls;
        if (m.tool_call_id) mapped.tool_call_id = m.tool_call_id;
        return mapped;
      }),
    ];

    yield* this.streamCompletion(messages);
  }

  async *streamChatCompletionWithTools(
    newMessages: ChatMessage[],
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const allMessages = [...this.history, ...newMessages];

    let finalSystemPrompt = this.systemPrompt;
    const activeAppends = this.appendedSystemPrompts.filter((p) => p.enabled);
    if (activeAppends.length > 0) {
      const appendText = activeAppends.map((p) => p.text).join('\n\n');
      finalSystemPrompt = `<main_system_prompt>\n${this.systemPrompt}\n</main_system_prompt>\n\n<appended_system_prompts>\n${appendText}\n</appended_system_prompts>`;
    }

    const messages: SharedChatMessage[] = [
      { role: 'system', content: finalSystemPrompt },
      ...allMessages.map((m) => {
        const mapped: SharedChatMessage = { role: m.role, content: m.content };
        if (m.tool_calls) mapped.tool_calls = m.tool_calls;
        if (m.tool_call_id) mapped.tool_call_id = m.tool_call_id;
        return mapped;
      }),
    ];

    let toolsToPass = undefined;
    if (this.toolsEnabled) {
      toolsToPass = this.tools.filter((t) => this.isToolEnabled(t.name));
      if (toolsToPass.length === 0) {
        toolsToPass = undefined;
      }
    }

    yield* this.streamCompletionWithTools(messages, toolsToPass);
  }

  async improveSystemPrompt(
    intention: string = '',
    howToImprove: string = '',
    evaluationFocus: string = '',
  ): Promise<string> {
    if (!this.apiKey) throw new Error('API Key is required');
    if (!this.model) throw new Error('Model is required');

    const config: PromptImproverConfig = {
      originalPrompt: this.systemPrompt,
      intention:
        intention ||
        'Improve the clarity and effectiveness of this system prompt.',
      howToImprove:
        howToImprove ||
        'Ensure the LLM understands its role and fills in missing details from the vague prompt.',
      evaluationFocus: evaluationFocus || '',
      maxLoopRound: 1,
      branchFactor: 1,
      promptType: 'system',
    };

    const improverCore = new PromptImproverCore(config, this);
    const generator = improverCore.run();

    let finalResults = null;
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        if (value) finalResults = value;
        break;
      }
    }

    if (finalResults && finalResults.length > 0) {
      // Return the prompt from the last round
      return finalResults[finalResults.length - 1].prompt;
    }

    return this.systemPrompt;
  }
}
