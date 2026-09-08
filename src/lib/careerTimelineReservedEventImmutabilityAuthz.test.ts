import { describe, it, expect } from 'vitest'

// Executable-spec regression coverage for the career_timeline
// UPDATE/DELETE reserved-event-type threat model, closing a real gap found
// during review of supabase/migrations/20260908010000_career_timeline_reserved_event_type_rls.sql
// (a DRAFT, NOT APPLIED migration -- see that file's own header).
//
// Same sandbox limitation as every other RLS/SQL test in this repo: no live
// Supabase/Postgres access exists here, so this cannot execute real RLS
// against a real engine. What it CAN do -- and does -- is simulate
// PostgreSQL RLS's actual USING/WITH CHECK semantics precisely enough to
// prove, as an executable spec, that:
//   1. The OLD (WITH-CHECK-only) design had a real "launder a reserved
//      event back to normal" gap.
//   2. The NEW (USING-also-excludes-reserved) design closes it.
//   3. Neither design regresses any of the pre-existing legitimate paths.
//
// RLS semantics being simulated (per PostgreSQL documentation):
//   - UPDATE's USING clause is evaluated against the OLD row and determines
//     whether a row can be targeted by the UPDATE at all. If it fails, the
//     row is invisible to the UPDATE (as if it didn't match the WHERE
//     clause) -- not an error, just zero rows affected for that row.
//   - UPDATE's WITH CHECK clause is evaluated against the resulting NEW row
//     and determines whether that resulting row is allowed to exist. If it
//     fails, the whole statement raises an error.
//   - DELETE only has a USING clause (there's no resulting row to check).

const RESERVED_EVENT_TYPES = new Set(['career_roadmap', 'promotion_coaching'])

function isReserved(eventType: string): boolean {
  return RESERVED_EVENT_TYPES.has(eventType)
}

interface TimelineRow {
  userId: string
  eventType: string
}

/**
 * The ORIGINAL (gapped) update_own_timeline policy:
 *   USING (auth.uid() = user_id)
 *   WITH CHECK (auth.uid() = user_id AND NOT is_reserved(event_type))
 */
function oldUpdatePolicyAllows(callerUid: string, oldRow: TimelineRow, newRow: TimelineRow): boolean {
  const usingPasses = callerUid === oldRow.userId
  const withCheckPasses = callerUid === newRow.userId && !isReserved(newRow.eventType)
  return usingPasses && withCheckPasses
}

/**
 * The FIXED update_own_timeline policy:
 *   USING (auth.uid() = user_id AND NOT is_reserved(event_type))
 *   WITH CHECK (auth.uid() = user_id AND NOT is_reserved(event_type))
 */
function newUpdatePolicyAllows(callerUid: string, oldRow: TimelineRow, newRow: TimelineRow): boolean {
  const usingPasses = callerUid === oldRow.userId && !isReserved(oldRow.eventType)
  const withCheckPasses = callerUid === newRow.userId && !isReserved(newRow.eventType)
  return usingPasses && withCheckPasses
}

/** The ORIGINAL delete_own_timeline policy: USING (auth.uid() = user_id). */
function oldDeletePolicyAllows(callerUid: string, row: TimelineRow): boolean {
  return callerUid === row.userId
}

/** The FIXED delete_own_timeline policy: adds the reserved-type exclusion. */
function newDeletePolicyAllows(callerUid: string, row: TimelineRow): boolean {
  return callerUid === row.userId && !isReserved(row.eventType)
}

describe('career_timeline INSERT reserved-event-type policy (RLS WITH CHECK simulation)', () => {
  function insertPolicyAllows(callerUid: string, row: TimelineRow): boolean {
    return callerUid === row.userId && !isReserved(row.eventType)
  }

  it('member can insert a legitimate non-reserved event for themself', () => {
    expect(insertPolicyAllows('member-1', { userId: 'member-1', eventType: 'joined' })).toBe(true)
    expect(insertPolicyAllows('member-1', { userId: 'member-1', eventType: 'application_submitted' })).toBe(true)
  })

  it('member cannot insert career_roadmap directly', () => {
    expect(insertPolicyAllows('member-1', { userId: 'member-1', eventType: 'career_roadmap' })).toBe(false)
  })

  it('member cannot insert promotion_coaching directly', () => {
    expect(insertPolicyAllows('member-1', { userId: 'member-1', eventType: 'promotion_coaching' })).toBe(false)
  })

  it('member cannot insert any event -- reserved or not -- for another user', () => {
    expect(insertPolicyAllows('attacker', { userId: 'victim', eventType: 'joined' })).toBe(false)
    expect(insertPolicyAllows('attacker', { userId: 'victim', eventType: 'career_roadmap' })).toBe(false)
  })
})

describe('career_timeline UPDATE reserved-event-type threat model (RLS USING/WITH CHECK simulation)', () => {
  it('THE GAP: the OLD policy (reserved-check only in WITH CHECK) let a member launder an existing reserved row back to normal', () => {
    const oldRow: TimelineRow = { userId: 'member-1', eventType: 'career_roadmap' }
    const newRow: TimelineRow = { userId: 'member-1', eventType: 'joined' } // escape hatch attempt
    expect(oldUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(true) // the historical gap
  })

  it('THE FIX: the corrected policy (reserved-check also in USING) blocks that same laundering attempt', () => {
    const oldRow: TimelineRow = { userId: 'member-1', eventType: 'career_roadmap' }
    const newRow: TimelineRow = { userId: 'member-1', eventType: 'joined' }
    expect(newUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(false)
  })

  it('the fix blocks modifying ANY field of an already-reserved row, even without changing event_type', () => {
    const oldRow: TimelineRow = { userId: 'member-1', eventType: 'promotion_coaching' }
    const newRow: TimelineRow = { userId: 'member-1', eventType: 'promotion_coaching' } // same type, e.g. editing a title
    expect(newUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(false)
    // The OLD policy also happened to block this specific case (WITH CHECK
    // still sees the unchanged reserved type on the new row) -- confirming
    // the fix's improvement is specifically the "convert back to normal"
    // escape hatch, not a regression on this already-blocked case.
    expect(oldUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(false)
  })

  it('both policies already blocked (and still block) escalating a normal row into a reserved type', () => {
    const oldRow: TimelineRow = { userId: 'member-1', eventType: 'joined' }
    const newRow: TimelineRow = { userId: 'member-1', eventType: 'career_roadmap' }
    expect(oldUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(false)
    expect(newUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(false)
  })

  it('the fix does not regress updating a normal row a member owns (no behavior change for the common case)', () => {
    const oldRow: TimelineRow = { userId: 'member-1', eventType: 'joined' }
    const newRow: TimelineRow = { userId: 'member-1', eventType: 'joined' }
    expect(newUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(true)
    expect(oldUpdatePolicyAllows('member-1', oldRow, newRow)).toBe(true)
  })

  it('ownership is enforced regardless of reserved status, under both policies', () => {
    const oldRow: TimelineRow = { userId: 'other-member', eventType: 'joined' }
    const newRow: TimelineRow = { userId: 'other-member', eventType: 'joined' }
    expect(oldUpdatePolicyAllows('attacker', oldRow, newRow)).toBe(false)
    expect(newUpdatePolicyAllows('attacker', oldRow, newRow)).toBe(false)
  })
})

describe('career_timeline DELETE reserved-event-type hardening (RLS USING simulation)', () => {
  it('THE GAP: the OLD delete_own_timeline policy let a member delete their own already-reserved row', () => {
    const row: TimelineRow = { userId: 'member-1', eventType: 'career_roadmap' }
    expect(oldDeletePolicyAllows('member-1', row)).toBe(true) // the historical gap
  })

  it('THE FIX: the corrected policy blocks deleting an existing reserved row', () => {
    const row: TimelineRow = { userId: 'member-1', eventType: 'career_roadmap' }
    expect(newDeletePolicyAllows('member-1', row)).toBe(false)
  })

  it('the fix does not regress deleting a normal row a member owns', () => {
    const row: TimelineRow = { userId: 'member-1', eventType: 'joined' }
    expect(newDeletePolicyAllows('member-1', row)).toBe(true)
    expect(oldDeletePolicyAllows('member-1', row)).toBe(true)
  })

  it('ownership is enforced regardless of reserved status, under both policies', () => {
    const row: TimelineRow = { userId: 'other-member', eventType: 'joined' }
    expect(oldDeletePolicyAllows('attacker', row)).toBe(false)
    expect(newDeletePolicyAllows('attacker', row)).toBe(false)
  })
})

describe('is_reserved_roadmap_event_type has no NULL-swallowing risk (three-valued-logic check)', () => {
  // This repo has already found one real NULL-swallows-authorization bug
  // this session (add_roadmap_milestone's admin-role predicate). Explicitly
  // re-checking this new predicate isn't vulnerable to the same class: the
  // simulated function below mirrors `p_event_type IN ('career_roadmap',
  // 'promotion_coaching')` -- since event_type is `text NOT NULL` at the
  // column level, a real row's event_type can never be SQL NULL, and the
  // list itself contains no NULL literal, so the result is always a
  // definite true/false, never NULL, for every real row.
  function simulatedIsReservedRoadmapEventType(eventType: string | null): boolean | null {
    if (eventType === null) return null // IN against a NULL left side is NULL
    return RESERVED_EVENT_TYPES.has(eventType) ? true : false // no NULL in the list -> always definite
  }

  it('returns a definite boolean (never null) for every realistic value, since event_type is NOT NULL at the column level', () => {
    expect(simulatedIsReservedRoadmapEventType('career_roadmap')).toBe(true)
    expect(simulatedIsReservedRoadmapEventType('promotion_coaching')).toBe(true)
    expect(simulatedIsReservedRoadmapEventType('joined')).toBe(false)
    expect(simulatedIsReservedRoadmapEventType('onboarding_completed')).toBe(false)
    // The NULL case exists only in this simulation to document why it's
    // unreachable in practice -- the column's NOT NULL constraint means no
    // real row can ever supply it.
    expect(simulatedIsReservedRoadmapEventType(null)).toBeNull()
  })
})
