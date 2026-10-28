import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Renderer components under test use the automatic JSX runtime, as in `vite.config.ts`.
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The integration suite spawns the real runtime; keep files sequential so
    // stdio children never compete for the same debug binary or temp homes.
    fileParallelism: false,
  },
});
