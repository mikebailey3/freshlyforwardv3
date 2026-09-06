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
      // .worktrees/ holds stale copies of the repo from past parallel work
      // sessions, each with its own node_modules (including its own React
      // copy). Running their tests alongside the real tree causes dual-React
      // hook errors unrelated to any current change. Excluded so the test
      // suite reflects only the actual working tree.
      exclude: ['**/node_modules/**', '.worktrees/**'],
    },
  })
)
