import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
      'mp3-splitter': './src/mp3-splitter/index.ts',
      'pdf-merger': './src/pdf-merger/index.ts',
      'google-drive-poc': './src/google-drive-poc/index.ts',
      'llm-chat': './src/llm-chat/index.ts',
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
