/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The domain lives in mobile/src/domain and is shared verbatim. Its third-party
// imports resolve to this app's node_modules so the web build stands alone.
const shared = ['zod', 'fflate', '@noble/hashes', '@noble/curves', 'pdf-lib', 'qrcode'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@pavo\/domain\//, replacement: `${here('../mobile/src/domain')}/` },
      ...shared.map((name) => ({
        find: new RegExp(`^${name.replace(/[/@]/g, (character) => `\\${character}`)}(?=/|$)`),
        replacement: here(`./node_modules/${name}`),
      })),
    ],
  },
  server: { port: 5173, fs: { allow: [here('..')] } },
  test: { environment: 'node' },
});
