import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/__tests__/security/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    environment: 'jsdom',
    globals: true,
  },
})
