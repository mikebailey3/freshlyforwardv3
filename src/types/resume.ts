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
 * Which member_profiles array an entry-kind's canonicalEntryId resolves
 * against. Skills are the one kind with no per-entry object —
 * member_profiles.skills is a flat string[] — so a skill's identity is
 * its own value, not a generated id (Phase 3).
 */
export type ResumeEntryKind = 'employment' | 'education' | 'certification' | 'skill'

/**
 * Per-version selection of which canonical content to include, plus any
 * resume-specific override text. `originalDescription` is always
 * retained alongside `overrideDescription` so nothing in member_profiles
 * is ever silently rewritten — mirrors Career Vault's "never rewrite
 * original_statement" rule.
 *
 * `canonicalEntryId`/`skillValue` are a discriminated pair (exactly one
 * set, matching `entryKind`) — not a foreign key the database can
 * enforce (Postgres cannot reference an element of a jsonb array).
 * Service code creating/updating a ResumeEntry MUST verify the
 * referenced canonical entry actually exists for that member; see
 * `createMasterResume.ts`.
 */
export type ResumeEntry =
  | {
      id: string
      resumeVersionId: string
      entryKind: 'employment' | 'education' | 'certification'
      /** References the durable `id` backfilled by src/lib/profile/entryIds.ts onto the matching member_profiles array entry. */
      canonicalEntryId: string
      included: boolean
      sortOrder: number | null
      originalDescription: string | null
      overrideDescription: string | null
    }
  | {
      id: string
      resumeVersionId: string
      entryKind: 'skill'
      /** A skill's identity is its own string value — member_profiles.skills has no per-entry object to generate an id for. */
      skillValue: string
      included: boolean
      sortOrder: number | null
      originalDescription: null
      overrideDescription: string | null
    }

/**
 * Workflow status, kept separate from the member's actual decision
 * (`ConfirmationDecision` below) per the Phase 2 persistence
 * clarification — `status='reviewed'` + `decision='keep_existing_canonical'`
 * rather than overloading one status column with five values. Deliberately
 * minimal: two states, not a generalized workflow engine.
 */
export type ResumeContentSuggestionStatus = 'pending' | 'reviewed'

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
  /** Null while status is 'pending'. Set exactly once, when status becomes 'reviewed' -- preserves which of the five distinguishable member decisions this was, for later parsing evaluation/AI/analytics ("why was this not applied?"). */
  decision: ConfirmationDecision | null
  createdAt: string
  decidedAt: string | null
}

/* ---------------------------------------------------------------------- */
/* Phase 2 — proposal / provenance / confirmation types                   */
/* ---------------------------------------------------------------------- */

export type ProposalConfidence = 'high' | 'medium' | 'low'

/**
 * Single source of truth for "is this canonical" -- no separate boolean
 * flag exists anywhere that could disagree with this. Derive with
 * `isCanonicalDestination()` below rather than storing the answer twice.
 */
export type ProposalDestination =
  | { kind: 'canonical-profile'; field: 'full_name' | 'email' | 'phone' | 'location' }
  | { kind: 'canonical-profile-array'; field: 'employment_history' | 'education' | 'certifications' | 'skills'; index: number | 'append' }
  | { kind: 'resume-specific'; field: 'summary_override' | 'section_order' }

export function isCanonicalDestination(destination: ProposalDestination): boolean {
  return destination.kind !== 'resume-specific'
}

/**
 * Structured provenance -- not a human-readable string contract. Every
 * candidate must be traceable to a literal source. `sourceExcerpt` must
 * always be a literal substring of the block(s) named in `blockOrders`
 * (anti-fabrication invariant, enforced by the field-mapper tests).
 *
 * Extensibility strategy: this interface is flat and open-ended. Later
 * phases add new OPTIONAL fields directly to it when actually needed --
 * PDF bounding-box coordinates, a Career Vault evidence reference, the
 * extraction engine used, the parser/provider that produced the
 * candidate, AI provider metadata -- each additive and non-breaking.
 * None of those are implemented speculatively here.
 */
export interface ResumeFieldProvenance {
  sourceDocumentId: string
  sectionKind: import('@/lib/resumeIntelligence/parsing/types').ResumeSectionKind
  blockOrders: number[]
  sourceExcerpt: string
  page: number | null
  matchedRule: string
}

export interface ResumeFieldProposal {
  id: string
  candidateValue: string
  destination: ProposalDestination
  provenance: ResumeFieldProvenance
  confidence: ProposalConfidence
  proposedAction: 'create' | 'update' | 'no-op-already-present'
}

/**
 * Async from day one, same reason as Career Vault's `CareerWinInterpreter`
 * -- a future `AIResumeFieldMapper` needs a network call, and designing
 * this async now means that swap costs nothing later. The deterministic
 * `DeterministicResumeFieldMapper` is the only Phase 2 implementation and
 * remains the default.
 */
export interface ResumeFieldMapper {
  /**
   * `sourceDocumentId` is optional and defaults to 'unknown' when omitted
   * -- a minor, backward-compatible addition discovered during
   * implementation: structured provenance (§3 of the Phase 2 design)
   * requires a source document id on every proposal, and the originally
   * locked two-argument signature had no slot for it. Any
   * `ResumeFieldMapper` implementation, including a future
   * `AIResumeFieldMapper`, keeps the same shape.
   */
  map(
    sections: import('@/lib/resumeIntelligence/parsing/types').DetectedSection[],
    document: import('@/lib/resumeIntelligence/parsing/types').ExtractedDocument,
    sourceDocumentId?: string,
  ): Promise<ResumeFieldProposal[]>
}

/**
 * The five distinguishable member decisions (Phase 2 persistence
 * clarification). `reject` and `keep_existing_canonical` are NOT the same
 * decision -- one means the suggestion was wrong/unwanted, the other means
 * it was reviewed and the member explicitly chose to keep their existing
 * canonical value. Both must remain distinguishable in persisted
 * review/audit data.
 */
export type ConfirmationDecision =
  | 'reject'
  | 'accept_as_canonical'
  | 'accept_edited_canonical'
  | 'keep_existing_canonical'
  | 'use_as_resume_specific_only'

export interface ProposalDecision {
  proposal: ResumeFieldProposal
  decision: ConfirmationDecision
  /** Required for accept_edited_canonical; optional for use_as_resume_specific_only when the member adjusts the wording. */
  editedValue?: string
}
