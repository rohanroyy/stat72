import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // GramJS (MTProto) needs these Node.js APIs polyfilled in the browser
      include: ['buffer', 'process', 'stream', 'crypto', 'path', 'events'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
  },
});
