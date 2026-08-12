import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// The webview is loaded from disk by the extension, so filenames must be stable
// and assets must not be hashed or split.
export default defineConfig({
  plugins: [react()],
  // Lib mode does not substitute this on its own, so React would ship its dev
  // build into the webview.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'media',
    emptyOutDir: false,
    // Fonts must stay as real files: inlining three families as data URIs would
    // balloon the stylesheet the webview parses on every open.
    assetsInlineLimit: 0,
    lib: {
      entry: resolve(__dirname, 'webview/main.tsx'),
      formats: ['iife'],
      name: 'BrainSnack',
      fileName: () => 'webview.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: asset => {
          if (asset.names?.some(name => name.endsWith('.css'))) {
            return 'webview.css';
          }

          return 'fonts/[name][extname]';
        },
        inlineDynamicImports: true,
      },
    },
  },
});
