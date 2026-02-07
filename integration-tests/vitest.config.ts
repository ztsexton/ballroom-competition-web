import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 600000, // 10 minutes for E2E tests
    hookTimeout: 300000, // 5 minutes for Docker builds
    pool: 'forks', // Use forks for better isolation with Docker
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially in a single fork
      },
    },
  },
});
