import { describe, expect, it, vi, afterEach } from 'vitest'
import { assertNonProdProject, fixtureEmail, NON_PROD_PROJECT_REF } from './oe2SecurityFixtures'

describe('fixtureEmail', () => {
  it('produces a deterministic, obviously-fake address per actor and run tag', () => {
    expect(fixtureEmail('abc123', 'member-a')).toBe('oe2-fixture-member-a-abc123@oe2-security-fixture.invalid')
    expect(fixtureEmail('abc123', 'member-b')).toBe('oe2-fixture-member-b-abc123@oe2-security-fixture.invalid')
    expect(fixtureEmail('abc123', 'strategist-s')).toBe('oe2-fixture-strategist-s-abc123@oe2-security-fixture.invalid')
  })

  it('produces different addresses for different run tags -- fixtures from different runs never collide', () => {
    expect(fixtureEmail('run1', 'member-a')).not.toBe(fixtureEmail('run2', 'member-a'))
  })

  it('always uses the .invalid TLD -- never resolvable, never a real domain', () => {
    expect(fixtureEmail('x', 'member-a')).toContain('.invalid')
  })
})

describe('assertNonProdProject', () => {
  const originalExit = process.exit

  afterEach(() => {
    process.exit = originalExit
    vi.restoreAllMocks()
  })

  it('does not exit when the URL contains the known non-prod project ref', () => {
    const exitSpy = vi.fn()
    process.exit = exitSpy as never
    assertNonProdProject(`https://${NON_PROD_PROJECT_REF}.supabase.co`)
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('exits when the URL is undefined -- never silently proceeds without a URL at all', () => {
    const exitSpy = vi.fn()
    process.exit = exitSpy as never
    vi.spyOn(console, 'error').mockImplementation(() => {})
    assertNonProdProject(undefined)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('exits when the URL points at a different project (e.g. production) -- the core safety guarantee', () => {
    const exitSpy = vi.fn()
    process.exit = exitSpy as never
    vi.spyOn(console, 'error').mockImplementation(() => {})
    assertNonProdProject('https://bolt-native-database-69540068.supabase.co')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('never logs the fact that it is refusing without explaining why -- console.error is called with context', () => {
    const exitSpy = vi.fn()
    process.exit = exitSpy as never
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    assertNonProdProject('https://some-other-project.supabase.co')
    expect(errorSpy).toHaveBeenCalled()
  })
})
