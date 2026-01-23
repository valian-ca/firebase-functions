import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    environment: 'node',
    globals: false,
    clearMocks: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts'],
      thresholds: {
        statements: 80,
        branches: 85,
        functions: 100,
        lines: 80,
      },
    },
    sequence: {
      hooks: 'list',
    },
  },
})
