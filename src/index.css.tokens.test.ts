/// <reference types="node" />
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'index.css')

describe('semantic design tokens', () => {
  const css = readFileSync(cssPath, 'utf-8')

  it('defines the new surface and ink tokens', () => {
    expect(css).toMatch(/--color-bg:\s*#031421/)
    expect(css).toMatch(/--color-surface-elevated:\s*#062235/)
    expect(css).toMatch(/--color-surface-card:\s*#0A2B3A/)
    expect(css).toMatch(/--color-surface-subtle:\s*#0E3444/)
    expect(css).toMatch(/--color-surface-hover:\s*#123044/)
    expect(css).toMatch(/--color-ink:\s*#F4F7FA/)
    expect(css).toMatch(/--color-ink-muted:\s*#8FA3B8/)
    expect(css).toMatch(/--color-border:\s*#16374A/)
  })

  it('retunes the primary accent scale to the fresh green', () => {
    expect(css).toMatch(/--color-primary-400:\s*#50F28C/)
    expect(css).toMatch(/--color-primary-600:\s*#2DCE75/)
  })

  it('defines the shared typography scale', () => {
    expect(css).toMatch(/--text-display:/)
    expect(css).toMatch(/--text-eyebrow:/)
  })
})
