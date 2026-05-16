import React from 'react';
import './shared/components/styles.css';

const llmTools = [
  { name: 'LLM Chat', path: 'llm-chat.html' },
  { name: 'Prompt Improver', path: 'prompt-improver.html' },
  { name: 'Agent Workflow Designer', path: 'agent-workflow-designer.html' },
  { name: 'Repo Chat', path: 'repo-chat.html' },
  { name: 'Text Adventure Writer', path: 'text-adventure-writer.html' },
];

const utilityTools = [
  { name: 'MP3 Splitter', path: 'mp3-splitter.html' },
  { name: 'PDF Merger', path: 'pdf-merger.html' },
  { name: 'PDF Splitter', path: 'pdf-splitter.html' },
  { name: 'Google Drive POC', path: 'google-drive-poc.html' },
  { name: 'Text Inspector', path: 'text-inspector.html' },
  { name: 'Basic Auth Generator', path: 'basic-auth-generator.html' },
];

export const App: React.FC = () => {
  return (
    <div
      className="container"
      style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}
    >
      <h1>In-Browser Tools</h1>
      <p>
        Disclaimer: mostly vibe-coded and not well-defined hobby level tools.
      </p>

      <h2>LLM Tools</h2>
      <ul>
        {llmTools.map((tool) => (
          <li key={tool.path}>
            <a href={tool.path}>{tool.name}</a>
          </li>
        ))}
      </ul>

      <h2>Utility Tools</h2>
      <ul>
        {utilityTools.map((tool) => (
          <li key={tool.path}>
            <a href={tool.path}>{tool.name}</a>
          </li>
        ))}
      </ul>

      <hr style={{ margin: '20px 0' }} />

      <ul>
        <li>
          <a href="settings.html">Settings</a>
        </li>
      </ul>
    </div>
  );
};
