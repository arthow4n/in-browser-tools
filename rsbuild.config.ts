import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './src/index.html',
  },
  output: {
    assetPrefix: '/in-browser-tools/',
  },
});
