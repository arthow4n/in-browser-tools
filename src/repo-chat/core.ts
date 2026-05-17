import { ChatCore, ChatMessage } from '../llm-chat/core.js';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { fs, vol } from 'memfs';
import { getStorage, setStorage } from '../shared/storage.js';

const DEFAULT_SYSTEM_PROMPT =
  'You are a chat agent helping the user generate an execution plan to be delegated to an autonomous coding agent. The plan should outline the approach but not be overly detailed. Entrust the coding agent to handle the implementation details. You must rely on the files provided in your context to answer questions and generate the plan.';

function getTabSessionId(): string {
  let sessionId = sessionStorage.getItem('tab-session-id');
  if (!sessionId) {
    sessionId =
      crypto.randomUUID();
    sessionStorage.setItem('tab-session-id', sessionId);
  }
  return sessionId;
}


export const BUILT_IN_PROMPTS = [
  {
    id: 'repo-chat-planner',
    name: 'Feature implementation planner',
    content: `You are a chat agent helping the user generate an execution plan to be delegated to an autonomous coding agent. The plan should outline the approach but not be overly detailed. Entrust the coding agent to handle the implementation details. You must rely on the files provided in your context to answer questions and generate the plan.

When generating a plan, outline the plan -> invoke the \`response_grounding\` tool to review the plan -> follow the tool\'s instruction -> generate a new version -> loop until the tool forces you to stop.

Once the review is done, output ONLY the final plan content. Do NOT invoke any implementation or edit tools.`,

    toolsEnabled: true,
    disabledTools: ['ask_question'], // enable response_grounding
  },
  {
    id: 'repo-chat-quick',
    name: 'Quick chat',
    content: 'You are a chat assistant that has access to a cloned repository. You can access information from the repo or answer questions grounded by the repo context.',
    toolsEnabled: false,
    disabledTools: [],
  },
];
export class RepoChatCore extends ChatCore {
  public clonedWordCount: number = 0;

  public clonedRepoContext: string = '';

  constructor() {
    super(`repo-chat-${getTabSessionId()}-`, 'repo-chat-');
    this.toolsEnabled = false; // Disable tools
    this.loadChatState(); // load states explicitly here as well to overwrite ChatCore defaults
    if (!this.selectedPromptId || this.selectedPromptId === 'builtin-assistant') {
      this.selectedPromptId = 'repo-chat-planner';
      this.systemPrompt = BUILT_IN_PROMPTS[0].content;
      this.toolsEnabled = true;
      this.disabledTools = new Set(['ask_question']);
      this.saveChatState();
    }
  }

  restartChat() {
    this.history = [];
    this.saveChatState();
  }

  clearAll() {
    this.clonedWordCount = 0;
    this.clonedRepoContext = '';
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    this.history = [];
    vol.reset();
    this.saveChatState();
  }


  async *streamChatCompletion(newMessages: ChatMessage[]) {
    const originalPrompt = this.systemPrompt;
    this.systemPrompt = originalPrompt + this.clonedRepoContext;
    try {
      yield* super.streamChatCompletion(newMessages);
    } finally {
      this.systemPrompt = originalPrompt;
    }
  }

  async *streamChatCompletionWithTools(newMessages: ChatMessage[]) {
    const originalPrompt = this.systemPrompt;
    this.systemPrompt = originalPrompt + this.clonedRepoContext;
    try {
      yield* super.streamChatCompletionWithTools(newMessages);
    } finally {
      this.systemPrompt = originalPrompt;
    }
  }

  async cloneRepo(url: string, statusCallback: (msg: string) => void) {
    statusCallback('Clearing memory file system...');
    vol.reset(); // Clear previous clones

    statusCallback(`Cloning ${url}...`);
    await git.clone({
      fs: fs as any, // Type cast since isomorphic-git expects standard fs but memfs works
      http: http as any,
      dir: '/',
      corsProxy: 'https://cors.isomorphic-git.org',
      url,
      depth: 1,
      singleBranch: true,
    });
    statusCallback('Clone complete.');
  }

  async seedChatHistory() {
    const filesToRead: string[] = [];

    // Helper to recursively list files
    const readDirRecursive = async (dir: string) => {
      const entries = fs.readdirSync(dir) as string[];
      for (const entry of entries) {
        if (
          entry === '.git' ||
          entry === 'node_modules' ||
          entry === 'package-lock.json' ||
          entry === 'yarn.lock' ||
          entry === 'pnpm-lock.yaml'
        )
          continue;
        const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          await readDirRecursive(fullPath);
        } else {
          // Exclude likely binary files to prevent context corruption
          if (
            !fullPath.match(
              /\.(png|jpe?g|gif|webp|ico|mp3|mp4|webm|pdf|woff2?|ttf|eot)$/i,
            )
          ) {
            filesToRead.push(fullPath);
          }
        }
      }
    };

    await readDirRecursive('/');

    this.history = []; // Clear previous history

    let totalContent = '';

    for (const file of filesToRead) {
      try {
        const content = fs.readFileSync(file, 'utf8') as string;
        totalContent += `\n--- File: ${file} ---\n${content}\n`;
      } catch (e) {
        console.error(`Failed to read file ${file}`, e);
      }
    }

    this.clonedRepoContext = `\n\n--- REPOSITORY FILES ---\n${totalContent}`;
    this.clonedWordCount = totalContent.split(/\s+/).length;

    // Initial question removed per requirements.
  }
}
