import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Static SPA: the hosting only serves files, it never carries calls.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  preview: { host: '127.0.0.1', port: 5184, strictPort: true },
  // Flags stay separate files fetched on demand instead of being inlined in the script.
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0,
    rollupOptions: {
      input: { main: new URL('./index.html', import.meta.url).pathname, 'embed-sdk': new URL('./src/embed/client.ts', import.meta.url).pathname },
      preserveEntrySignatures: 'strict',
      output: { entryFileNames: chunk => chunk.name === 'embed-sdk' ? 'apisnix-embed.js' : 'assets/[name]-[hash].js' },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
