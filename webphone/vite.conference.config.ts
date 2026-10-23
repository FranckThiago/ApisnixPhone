import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()], base: './',
  build: { target: 'es2022', sourcemap: false, outDir: 'dist-conference', assetsInlineLimit: 0,
    rollupOptions: { input: new URL('./native-conference.html', import.meta.url).pathname },
  },
});
