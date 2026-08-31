import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Reuses the real app config (plugins, @ alias) instead of duplicating it,
// so the alias only needs to stay correct in one place.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/vitest.setup.ts',
    },
  })
)
