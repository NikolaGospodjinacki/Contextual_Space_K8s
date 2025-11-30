import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Get base path from env (for PR preview routing)
const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
