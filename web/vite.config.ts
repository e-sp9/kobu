/// <reference types="vitest/config" />

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Release downloads don't return Access-Control-Allow-Origin,
  // so fetching uf2 binaries directly from the browser fails CORS.
  // In dev mode we route the install flow through `/__release/...`,
  // which the dev server proxies to github.com server-side (CORS does
  // not apply between server and origin). Production needs a real
  // solution — see the open issue tracking same-origin deployment.
  server: {
    proxy: {
      '/__release': {
        target: 'https://github.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/__release/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest's default `exclude` already covers `node_modules` and
    // `dist`, but not `.direnv` — direnv copies flake inputs (full
    // nixpkgs sources, etc.) underneath it and they contain their
    // own tests we definitely do not want to run.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.direnv/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx', // bootstrap only
        'src/test/**',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
      ],
    },
  },
});
