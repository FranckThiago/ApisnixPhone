import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Static SPA: the hosting only serves files, it never carries calls.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  preview: { host: '127.0.0.1', port: 5184, strictPort: true },
  // Flags stay separate files fetched on demand instead of being inlined in the script.
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
