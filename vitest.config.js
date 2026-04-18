import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'data', 'logs', 'backups'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'data/',
        'logs/',
        'backups/',
        '**/*.test.js',
        '**/*.spec.js',
        'vitest.config.js',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
