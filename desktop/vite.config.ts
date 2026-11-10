import path from 'node:path';

import { defineConfig } from 'vite';

/**
 * Renderer build: `src/renderer` → `dist/renderer`, served by main at
 * `inquello://app/`. No inline scripts (no modulepreload polyfill) and no
 * inlined `data:` assets, so the page fits the `'self'`-only CSP.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  // Copied verbatim to dist/renderer: the font and icon licence texts must ship with the assets.
  publicDir: path.resolve(__dirname, 'src/renderer/public'),
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: false,
    target: 'es2024',
  },
});
