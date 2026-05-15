import { ChatCore, ChatMessage } from '../llm-chat/core.js';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { fs, vol } from 'memfs';
import { getStorage, setStorage } from '../shared/storage.js';

const DEFAULT_SYSTEM_PROMPT =
  'You are a chat agent helping the user generate an execution plan to be delegated to an autonomous coding agent. The plan should outline the approach but not be overly detailed. Entrust the coding agent to handle the implementation details. You do not have access to any tools. You must rely on the files provided in your context to answer questions and generate the plan.';

function getTabSessionId(): string {
  let sessionId = sessionStorage.getItem('tab-session-id');
  if (!sessionId) {
    sessionId =
      Date.now().toString() + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('tab-session-id', sessionId);
  }
  return sessionId;
}

export class RepoChatCore extends ChatCore {
  constructor() {
    super(`repo-chat-${getTabSessionId()}-`);
    this.toolsEnabled = false; // Disable tools
    this.loadChatState(); // load states explicitly here as well to overwrite ChatCore defaults
  }

  restartChat() {
    // Keeps the first message which is the cloned repo context + the initial assistant message
    if (this.history.length >= 2) {
      this.history = this.history.slice(0, 2);
    } else if (this.history.length === 1) {
      this.history = [this.history[0]];
    } else {
      this.history = [];
    }
    this.saveChatState();
  }

  clearAll() {
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    this.history = [];
    vol.reset();
    this.saveChatState();
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

    this.systemPrompt += `\n\n--- REPOSITORY FILES ---\n${totalContent}`;

    // Add the initial question
    const questionMsg: ChatMessage = {
      id: 'msg_seed_question_' + Date.now(),
      role: 'assistant',
      content:
        'I have read the repository files into my context. What changes do you want to make to the repo?',
    };
    this.history.push(questionMsg);
  }
}
