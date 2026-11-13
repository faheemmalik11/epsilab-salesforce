import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Some tests parse the 12 MB seed CSV.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  },
});
