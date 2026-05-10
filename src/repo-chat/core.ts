import { ChatCore, ChatMessage } from '../llm-chat/core.js';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { fs, vol } from 'memfs';

export class RepoChatCore extends ChatCore {
  constructor() {
    super();
    this.systemPrompt =
      'You are a chat agent helping the user generate an execution plan to be delegated to an autonomous coding agent. The plan should outline the approach but not be overly detailed. Entrust the coding agent to handle the implementation details. Use the ask_question tool to clarify requirements.';
    this.toolsEnabled = true; // Enable tools by default
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
        if (entry === '.git' || entry === 'node_modules') continue;
        const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          await readDirRecursive(fullPath);
        } else {
          // Exclude likely binary files to prevent context corruption
          if (!fullPath.match(/\.(png|jpe?g|gif|webp|ico|mp3|mp4|webm|pdf|woff2?|ttf|eot)$/i)) {
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

    const toolCallId = 'call_seed_repo_files_' + Date.now();

    // 1. Mock the assistant calling read_files
    const assistantMsg: ChatMessage = {
      id: 'msg_seed_call_' + Date.now(),
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: toolCallId,
          type: 'function',
          function: {
            name: 'read_files',
            arguments: JSON.stringify({ path: '/' }),
          },
        },
      ],
    };
    this.history.push(assistantMsg);

    // 2. Mock the tool returning the file contents
    const toolMsg: ChatMessage = {
      id: 'msg_seed_result_' + Date.now(),
      role: 'tool',
      content: totalContent,
      tool_call_id: toolCallId,
    };
    this.history.push(toolMsg);

    // 3. Add the initial question
    const questionMsg: ChatMessage = {
      id: 'msg_seed_question_' + Date.now(),
      role: 'assistant',
      content: 'What changes do you want to make to the repo?',
    };
    this.history.push(questionMsg);
  }
}
