import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Separate app from the webview: it is served over HTTP by admin/server.ts
// rather than loaded from disk by VS Code, so normal hashed assets are fine.
export default defineConfig({
  root: resolve(__dirname, 'admin/client'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'admin/dist'),
    emptyOutDir: true,
  },
  server: {
    port: 4320,
    proxy: {
      '/api': 'http://127.0.0.1:4319',
    },
  },
});
