import { defineConfig } from '@rsbuild/core';
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginNodePolyfill(), pluginReact()],
  source: {
    entry: {
      index: './src/index.tsx',
      'repo-chat': './src/repo-chat/index.tsx',
      'mp3-splitter': './src/mp3-splitter/index.tsx',
      'pdf-merger': './src/pdf-merger/index.tsx',
      'pdf-splitter': './src/pdf-splitter/index.tsx',
      'google-drive-poc': './src/google-drive-poc/index.tsx',
      'llm-chat': './src/llm-chat/index.tsx',
      'prompt-improver': './src/prompt-improver/index.tsx',
      'text-inspector': './src/text-inspector/index.tsx',
      'agent-workflow-designer': './src/agent-workflow-designer/index.tsx',
      'text-adventure-writer': './src/text-adventure-writer/index.tsx',
      'basic-auth-generator': './src/basic-auth-generator/index.tsx',
      settings: './src/settings/index.tsx',
    },
  },
  html: {
    template: ({ entryName }) => {
      return entryName === 'index'
        ? './src/index.html'
        : `./src/${entryName}/index.html`;
    },
  },
  output: {
    assetPrefix: '/in-browser-tools/',
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
