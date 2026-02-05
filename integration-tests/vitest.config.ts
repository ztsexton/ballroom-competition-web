import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 300000, // 5 minutes for Docker builds
    hookTimeout: 300000,
    pool: 'forks', // Use forks for better isolation with Docker
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially in a single fork
      },
    },
  },
});
