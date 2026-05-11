console.log('Tools loaded.');

const tools = [
  { name: 'MP3 Splitter', path: 'mp3-splitter.html' },
  { name: 'PDF Merger', path: 'pdf-merger.html' },
  { name: 'PDF Splitter', path: 'pdf-splitter.html' },
  { name: 'Google Drive POC', path: 'google-drive-poc.html' },
  { name: 'LLM Chat', path: 'llm-chat.html' },
  { name: 'Prompt Improver', path: 'prompt-improver.html' },
  { name: 'Text Inspector', path: 'text-inspector.html' },
  { name: 'Agent Workflow Designer', path: 'agent-workflow-designer.html' },
  { name: 'Repo Chat', path: 'repo-chat.html' },
  { name: 'Text Adventure Writer', path: 'text-adventure-writer.html' },
  { name: 'Basic Auth Generator', path: 'basic-auth-generator.html' },
  { name: 'Settings', path: 'settings.html' },
];

const list = document.getElementById('tools-list');
if (!(list instanceof HTMLUListElement))
  throw new Error('Tools list not found');

for (const tool of tools) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = tool.path;
  a.textContent = tool.name;
  li.appendChild(a);
  list.appendChild(li);
}
