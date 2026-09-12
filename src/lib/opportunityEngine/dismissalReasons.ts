/**
 * OE 2.0 Phase 9 -- canonical member-feedback taxonomy for "why are you
 * dismissing this match." Single source of truth for both the dismiss
 * UI (DismissReasonMenu.tsx) and any later reporting (e.g. Phase 11
 * evaluation metrics) -- never duplicated as a second hardcoded list.
 *
 * Persisted as `member_feedback.feedback_type`, which is a free-text
 * column by design (see the Phase 9 migration's own docs for why no
 * database CHECK constraint was added there -- it already works this
 * way for every other kind of feedback on that table). This module is
 * what keeps that free text constrained to a known, typed set in
 * application code instead of at the schema layer.
 */
export const DISMISSAL_REASONS = [
  'not_interested',
  'wrong_role',
  'wrong_salary',
  'wrong_industry',
  'wrong_location',
  'wrong_work_model',
  'already_applied',
  'irrelevant_recommendation',
] as const

export type DismissalReason = (typeof DISMISSAL_REASONS)[number]

export const DISMISSAL_REASON_LABELS: Record<DismissalReason, string> = {
  not_interested: 'Not interested',
  wrong_role: 'Wrong role',
  wrong_salary: 'Wrong salary',
  wrong_industry: 'Wrong industry',
  wrong_location: 'Wrong location',
  wrong_work_model: 'Wrong work model',
  already_applied: 'Already applied',
  irrelevant_recommendation: 'Not a relevant recommendation',
}

/** Type guard -- narrows an arbitrary string (e.g. from a form) to a known reason, never fabricating a match. */
export function isDismissalReason(value: string): value is DismissalReason {
  return (DISMISSAL_REASONS as readonly string[]).includes(value)
}
