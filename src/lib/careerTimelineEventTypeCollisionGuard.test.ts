import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { ROADMAP_EVENT_TYPES } from './roadmap'

// Pure repo-side regression guard for Risk 1 / "Option C" documented in
// docs/superpowers/plans/2026-09-04-career-timeline-event-type-hardening-proposal.md
// and referenced in docs/superpowers/plans/2026-09-04-roadmap-cross-surface-integration-wave1-plan.md
// (§3): "a Vitest/grep-based check that fails CI if a new string literal
// matching career_roadmap/promotion_coaching appears outside src/lib/roadmap.ts."
//
// career_timeline.event_type has no DB-level CHECK constraint (that's Risk 1's
// separate, NOT-taken DB-level fix -- explicitly out of scope here, still
// gated behind live Supabase access per the proposal doc). This test only
// guards the one thing a pure-repo test can: a future addTimelineEvent(...)
// call, or a future direct career_timeline insert outside addTimelineEvent(),
// accidentally reusing one of the two reserved Roadmap milestone event types
// for something else.
//
// Deliberately NOT a generic "grep every event_type: '...' in src/" sweep --
// that would false-positive on CalendarPage.tsx's UnifiedEvent.event_type,
// which is a purely local, client-side display field merging four unrelated
// tables (calendar_events, mock_interviews, friday_reports, applications)
// and is never written to career_timeline. Confirmed by direct inspection:
// the only production career_timeline writers today are addTimelineEvent()
// (src/lib/profile.ts, called from src/lib/operations.ts, OnboardingPage.tsx,
// and the two onboarding/* components) and the stripe-webhook edge function's
// one direct insert -- both scanned explicitly below.

const SRC_DIR = join(process.cwd(), 'src')
const ROADMAP_LIB_PATH = join('src', 'lib', 'roadmap.ts')

/**
 * Recursively walks `dir`, collecting every literal string passed as the
 * second argument to addTimelineEvent(...) in every non-test .ts/.tsx file
 * (except src/lib/roadmap.ts itself, the legitimate owner of the two
 * reserved types). Skips dynamic/variable event-type arguments -- those
 * can't be statically checked this way, and none exist in the codebase
 * today (verified by direct grep before writing this test).
 */
function collectAddTimelineEventLiterals(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      collectAddTimelineEventLiterals(fullPath, out)
      continue
    }

    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) continue
    if (fullPath.endsWith(sep + ROADMAP_LIB_PATH.split(sep).join(sep))) continue

    const content = readFileSync(fullPath, 'utf-8')
    const callRegex = /addTimelineEvent\(\s*[^,]+,\s*['"]([a-zA-Z0-9_]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = callRegex.exec(content)) !== null) {
      out.push(match[1])
    }
  }
  return out
}

describe('career_timeline event_type collision guard (repo-side only, no DB/live Supabase involved)', () => {
  it('never calls addTimelineEvent() with a reserved Roadmap milestone event_type anywhere in src/', () => {
    const literals = collectAddTimelineEventLiterals(SRC_DIR)

    // Sanity check: prove the scan actually found real call sites rather
    // than silently matching nothing (a regex/path typo would otherwise
    // make this test pass trivially forever and stop guarding anything).
    expect(literals.length).toBeGreaterThan(0)

    for (const literal of literals) {
      expect(ROADMAP_EVENT_TYPES as readonly string[]).not.toContain(literal)
    }
  })

  it('the stripe-webhook edge function never inserts a reserved Roadmap milestone event_type into career_timeline', () => {
    const content = readFileSync(
      join(process.cwd(), 'supabase', 'functions', 'stripe-webhook', 'index.ts'),
      'utf-8',
    )

    // Scoped specifically to this one confirmed direct career_timeline
    // writer outside addTimelineEvent() -- not a generic event_type: '...'
    // sweep, which would also match this same file's unrelated
    // stripe_webhook_events insert (event_type: event.type, a Stripe event
    // name, and a different table entirely) if matched too broadly.
    const careerTimelineInsertBlock = content.split('career_timeline').slice(1).join('career_timeline')
    const match = /event_type:\s*["']([a-zA-Z0-9_]+)["']/.exec(careerTimelineInsertBlock)

    expect(match).not.toBeNull()
    expect(ROADMAP_EVENT_TYPES as readonly string[]).not.toContain(match![1])
  })

  it('locks in the exact reserved Roadmap event-type list this guard protects', () => {
    expect(ROADMAP_EVENT_TYPES).toEqual(['career_roadmap', 'promotion_coaching'])
  })
})
