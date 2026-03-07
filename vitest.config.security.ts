import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/__tests__/security/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
  },
})
