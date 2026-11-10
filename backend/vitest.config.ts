import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Testi si delijo eno testno bazo, zato se datoteke izvajajo zaporedno.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://clubmanager:clubmanager@localhost:5433/clubmanager_test?schema=public',
      SESSION_SECRET: 'testna-skrivnost-za-seje-1234567890',
    },
  },
});
