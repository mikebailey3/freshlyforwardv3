/**
 * Resume Intelligence Phase 1 — canonical types.
 *
 * Locked architecture (Option A — Structured-First, File-Optional,
 * approved 2026-09-07): a resume is a version/presentation layer over
 * existing career data (member_profiles.employment_history/education/
 * skills) and evidence (Career Vault, once built) — never a competing
 * source of truth for career history. See
 * docs/superpowers/specs/2026-09-07-resume-intelligence-phase1-design.md.
 *
 * Nothing in this file is persisted yet — no migration has been written
 * or applied. These are the shapes the eventual `resume_documents` /
 * `resume_entries` tables and the analysis engine will use.
 */

/** Severity of a single finding — mirrors reactive-resume's ATS catalog shape (studied as pattern reference, no code reused). */
export type ResumeFindingSeverity = 'error' | 'warning' | 'info'

/**
 * One explainable finding: rule code, why it matters, the literal evidence
 * that triggered it, and what to do about it.
 *
 * Finding -> why it matters -> evidence -> recommended action, per the
 * locked design. `evidence` must always be a literal excerpt of the
 * content being analyzed, never a paraphrase or an invented example —
 * same anti-fabrication discipline as Career Vault's interpreter.
 */
export interface ResumeFinding {
  /** Stable, machine-readable identifier, e.g. 'MISSING_EMAIL' or 'WEAK_OPENER_BULLET'. */
  code: string
  severity: ResumeFindingSeverity
  /** Why this matters — human-readable, not just a label. */
  meaning: string
  /** The literal text/data that triggered this finding. */
  evidence: string
  /** What the member should do about it. */
  action: string
}

/**
 * The six Resume Intelligence dimensions. Deliberately never combined
 * into a single blended "resume score" — each is independently scored
 * and explained (locked decision), same philosophy as FreshFit's
 * dimension-separated `FreshFitDimensionResult`.
 */
export type ResumeDimensionKey =
  | 'atsReadability'
  | 'structuralQuality'
  | 'contentStrength'
  | 'quantification'
  | 'targetRoleAlignment'
  | 'evidenceCoverage'

/**
 * Whether a dimension was actually scored, or is honestly unavailable
 * because its upstream dependency isn't wired yet (no FreshFit call, no
 * Career Vault data yet). 'unavailable' must never be silently rendered
 * as a fabricated score.
 */
export type ResumeDimensionStatus = 'scored' | 'unavailable'

export interface ResumeDimensionResult {
  key: ResumeDimensionKey
  label: string
  status: ResumeDimensionStatus
  /** 0-100, this dimension only. Always null when status is 'unavailable'. */
  score: number | null
  /** Present only when status is 'unavailable' — why no score exists yet. */
  unavailableReason?: string
  findings: ResumeFinding[]
}

/** All six dimensions. Still never combined into one number. */
export interface ResumeIntelligenceResult {
  dimensions: ResumeDimensionResult[]
}

/* ---------------------------------------------------------------------- */
/* Interfaces for pieces Phase 1 does not implement (design boundary)     */
/* ---------------------------------------------------------------------- */

/**
 * Target-role alignment must call FreshFit's existing skill/role matching
 * — never a second matching engine (locked decision). Phase 1 ships this
 * interface plus a `NullTargetRoleAlignmentProvider`; a real
 * `FreshFitTargetRoleAlignmentProvider` is a later, interface-compatible
 * swap — same pattern as Career Vault's `CareerWinInterpreter`.
 */
export interface TargetRoleAlignmentProvider {
  score(input: TargetRoleAlignmentInput): Promise<ResumeDimensionResult>
}

export interface TargetRoleAlignmentInput {
  resumeSkills: string[]
  targetRole: string | null
  /** Opportunity to align against when tailoring a specific version. Null for the Master Resume. */
  opportunityId: string | null
}

/**
 * Evidence coverage reads Career Vault's confirmed `career_win_capabilities`
 * — never invents substitute evidence (locked decision). Phase 1 ships
 * this interface plus a `NullEvidenceCoverageProvider` that reports
 * 'unavailable' honestly, since Career Vault does not exist yet.
 */
export interface EvidenceCoverageProvider {
  score(input: EvidenceCoverageInput): Promise<ResumeDimensionResult>
}

export interface EvidenceCoverageInput {
  userId: string
  /** Skill names claimed on this resume, to check for confirmed evidence coverage. */
  claimedSkills: string[]
}

/* ---------------------------------------------------------------------- */
/* Forward-looking version/lineage shapes (types only — no persistence)   */
/* ---------------------------------------------------------------------- */

/**
 * A resume "version" — the Master Resume or a tailored derivative.
 * Content is selected/overridden from member_profiles, never duplicated
 * into a competing employment-history array (locked decision). The
 * Master Resume is the member's comprehensive, reusable career content —
 * not constrained to a traditional 1-2 page resume length.
 */
export interface ResumeDocument {
  id: string
  userId: string
  title: string
  /** True for exactly one row per member: the comprehensive Master Resume. */
  isMaster: boolean
  /** Null for the Master Resume. Set for a tailored version, preserving lineage back to it. */
  derivedFromResumeId: string | null
  /** Opportunity this tailored version targets, if any. */
  targetOpportunityId: string | null
  status: 'draft' | 'final'
  createdAt: string
  updatedAt: string
}

/**
 * Per-version selection of which employment content to include, plus any
 * resume-specific override text. `originalDescription` is always
 * retained alongside `overrideDescription` so nothing in member_profiles
 * is ever silently rewritten — mirrors Career Vault's "never rewrite
 * original_statement" rule.
 */
export interface ResumeEntry {
  id: string
  resumeDocumentId: string
  /** References an employment_entry_id in member_profiles.employment_history. */
  employmentEntryId: string
  included: boolean
  originalDescription: string
  overrideDescription: string | null
}

export type ResumeContentSuggestionStatus = 'pending' | 'accepted' | 'rejected'

/**
 * An AI- or system-proposed rewrite/addition. Always proposed, never
 * auto-applied — member approval is mandatory (locked decision). Same
 * suggest/confirm shape as `career_win_capabilities`.
 */
export interface ResumeContentSuggestion {
  id: string
  resumeDocumentId: string
  targetField: string
  proposedText: string
  /** What this suggestion is traceable to (e.g. a Career Vault career_win id or statement excerpt). Null only for a purely stylistic suggestion with no factual content. */
  evidenceReference: string | null
  status: ResumeContentSuggestionStatus
  createdAt: string
  decidedAt: string | null
}
