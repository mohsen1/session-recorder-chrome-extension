import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Most pure-logic tests run in node; DOM-dependent tests opt into jsdom via
    // a `// @vitest-environment jsdom` file pragma.
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
  },
});
