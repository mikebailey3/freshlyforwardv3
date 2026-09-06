/// <reference types="node" />
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

// See index.css.tokens.test.ts for why fs + a triple-slash reference is used
// here instead of a bare `node:fs` import or a Vite `?raw` import (both fail
// under this project's tsconfig/vitest setup).
const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'index.css')

describe('legacy :root variables', () => {
  const css = readFileSync(cssPath, 'utf-8')

  it('flips --navy to the new deep-navy background role', () => {
    expect(css).toMatch(/--navy:\s*#031421/)
  })

  it('adds a dedicated --ink variable for text now that --navy is a background', () => {
    expect(css).toMatch(/--ink:\s*#F4F7FA/)
  })

  it('retunes --cream and --mint from light warm tints to dark surfaces', () => {
    expect(css).toMatch(/--cream:\s*#0A2B3A/)
    expect(css).toMatch(/--mint:\s*#0E3444/)
  })

  it('body reads text/background from variables, not hardcoded literals', () => {
    expect(css).toMatch(/body\s*\{[^}]*color:\s*var\(--ink\)/)
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--navy\)/)
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#fff/)
  })

  it('removes hardcoded literal white/#fff card backgrounds in favor of --cream', () => {
    expect(css).not.toMatch(/\.pricing-card\s*\{[^}]*background:\s*white/)
    expect(css).not.toMatch(/\.contact-card\s*\{[^}]*background:\s*white/)
  })
})
