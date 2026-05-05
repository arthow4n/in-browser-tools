console.log('Tools loaded.');

const tools = [
  { name: 'MP3 Splitter', path: 'mp3-splitter.html' },
  { name: 'PDF Merger', path: 'pdf-merger.html' },
  { name: 'Google Drive POC', path: 'google-drive-poc.html' },
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
