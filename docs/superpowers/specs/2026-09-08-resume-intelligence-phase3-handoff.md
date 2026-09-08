# Resume Intelligence — Project Handoff & Design Reference

**Prepared for handoff (2026-09-08).** Covers Phases 1–3, all as implemented and pushed to GitHub. Nothing here has been merged to `main`, and no Supabase migration has been applied anywhere.

---

## 0. Where everything lives

| Branch | Status | Contents |
|---|---|---|
| `main` | untouched | unrelated to this project |
| `resume-intelligence-phase1` | pushed to `origin`, HEAD `287adfc` + later doc fix `ed36c27` | Phase 1 + Phase 2 |
| `resume-intelligence-phase3` | pushed to `origin`, HEAD `4edfd01` | Phase 3, branched from Phase 2's `ed36c27` |

No pull request has been opened for either branch. `resume-intelligence-phase3` is the branch to continue from — it contains everything from Phase 1/2/3.

Design docs already in the repo (both on `resume-intelligence-phase1` and carried forward into `resume-intelligence-phase3`):
- `docs/superpowers/specs/2026-09-07-resume-intelligence-phase1-design.md`
- `docs/superpowers/specs/2026-09-07-resume-intelligence-phase2-design.md`

There is **no Phase 3 design doc file** — Phase 3's design was worked out and approved across several rounds of chat before implementation, never persisted to a file. This handoff document is the closest thing to one; consider writing a proper `2026-09-08-resume-intelligence-phase3-design.md` from it if useful.

---

## 1. Product principle (locked, do not violate)

```
Career Vault (evidence, not yet built)
   → member_profiles (canonical career truth, never forked)
   → Resume Intelligence (version/presentation layer over that content)
   → Job-Specific Tailoring (not built)
   → Opportunity Engine
```

A resume is never a second source of truth for career history. It selects, presents, and scores existing content.

## 2. Locked architectural decisions

- **`member_profiles`** (`employment_history`, `education`, `certifications`, `skills` — all JSONB except skills, which is `string[]`) is the sole canonical career-truth store. Never forked, never duplicated into a competing shape.
- **Career Vault** is an evidence source only, never a Resume Intelligence write target. It doesn't exist yet — Resume Intelligence has an interface (`EvidenceCoverageProvider`) and a `NullEvidenceCoverageProvider` waiting for it.
- **A resume is a version/presentation layer**, not new career-history storage.
- **Master Resume** is comprehensive and NOT page-constrained. Tailored versions are what get trimmed for a specific application. Tailored resumes preserve lineage back to the Master (`derived_from_resume_version_id`).
- **FreshFit remains the only matching/alignment engine.** Resume Intelligence's `TargetRoleAlignmentProvider` calls into it later — never a second matcher.
- **Dimension-separated analysis, never a blended score.** Six dimensions (ATS Readability, Structural Quality, Content Strength, Quantification, Target Role Alignment, Evidence Coverage), each independently scored/explained. `ResumeIntelligenceResult` has no top-level score field — enforced by the type, not convention.
- **AI-generated/rewritten content is always proposed, never silently applied.** No AI is implemented anywhere in Phases 1–3; every parsing/mapping is deterministic.
- **JSON Resume** = import/export interop only, never the internal model. Not implemented.
- **Reactive Resume** (MIT) = pattern/reference only (ATS rule-catalog shape, future optional AI-provider reference, later template/render research) — explicitly **not** the deterministic-parser reference. Verified directly against a local clone (commit `ad91a0838c7d739eec4df5b2622750b0a4f1f7f3`): its own PDF import prefers AI (raw file to an LLM) with a deterministic fallback only when no AI provider is configured; DOCX/DOC import has **no** deterministic path at all. No Reactive Resume code is copied anywhere in this codebase.
- **Open Resume** (AGPL) = algorithm-pattern research only. No code referenced or copied.
- **`member_documents`** stays general upload intake — never a second/competing upload system. A resume upload becomes a parsing *source*, tracked by `member_documents.id`.
- **`resume_versions`** (existing table) keeps its identity — extended additively, never replaced. `applications.resume_version_id` is untouched.
- **Confirmation routing is semantic, decided by explicit member action — never by whether the target Profile field happens to be empty.** `accept_as_canonical` writes even when the field already has content.
- **No orphan factual entries (Phase 3 rule).** A brand-new career fact (`proposedAction === 'create'`) can never exist only as `use_as_resume_specific_only` content — it must be accepted canonically first, or rejected. Enforced in `applyConfirmedProposals`.
- **Canonical confirmation is member-only.** An assisting strategist can view import attempts/proposals but can never perform `accept_as_canonical`/`accept_edited_canonical` on a member's behalf. This is enforced today at the database layer already (verified live): neither `resume_field_proposals`' UPDATE policy nor `member_profiles`' UPDATE policies have a strategist branch.
- **No fake referential integrity.** `resume_entries.canonical_entry_id`/`skill_value` are plain text columns, never a `REFERENCES`/foreign key — Postgres cannot enforce a FK into a JSONB array element. Application code (`createMasterResume`) is the actual enforcement boundary: it verifies a referenced entry exists in the member's current Profile before inserting a reference to it.
- **Array position is never permanent identity.** Canonical entries get durable, additive string ids (see §4).

---

## 3. What's built, by phase

### Phase 1 — Foundation (`resume-intelligence-phase1`, commit `9dcbe4d`)
- `src/types/resume.ts` — canonical types (`ResumeFinding`, `ResumeDimensionResult`, `ResumeIntelligenceResult`, etc.)
- `src/lib/textQuality/` — extracted shared text-quality primitives (cliché detection, weak-opener detection, metric detection) from `linkedinOptimizer.ts`, behavior-preserving
- `src/lib/resumeIntelligence/{atsReadability,structuralQuality,contentStrength,quantification}.ts` — 4 deterministic dimensions
- `src/lib/resumeIntelligence/{alignment,evidenceCoverage}.ts` — interfaces + Null providers for the 2 not-yet-wired dimensions
- `src/lib/resumeIntelligence/index.ts#computeResumeIntelligence()` — runs all six, returns `{dimensions: ResumeDimensionResult[]}`, no blended score

### Phase 2 — Parsing engine (`resume-intelligence-phase1`, commit `8039da3` + follow-ups)
- `src/lib/resumeIntelligence/parsing/` — the whole extraction/parsing pipeline:
  - `plainTextExtractor.ts`, `pdfExtractor.ts` (unpdf), `docxExtractor.ts` (mammoth + cheerio), `resolveExtractor.ts` — all implement `DocumentExtractor`, normalize into one `ExtractedDocument` shape (`types.ts`), no library types leak downstream
  - `sectionDetector.ts` — deterministic heading-based section detection, implicit contact section, unknown-content preservation (never dropped)
  - `fieldExtractors/{name,email,phone,location,summary,employment,education,certifications,skills}.ts` — 9 deterministic field extractors; `employment.ts` is the highest-risk one, proven against 9 synthetic layout variations (fabricated people/companies, no real resumes)
  - `fieldMapper.ts#DeterministicResumeFieldMapper` — orchestrates all 9 extractors
  - `provenance.ts`, `antiFabrication.test.ts` — every candidate's excerpt is a literal substring of its source blocks, ambiguity degrades confidence or yields nothing, unknown content preserved
- `src/lib/resumeIntelligence/confirmation/applyConfirmedProposals.ts` — the 5-decision confirmation layer (`reject`, `accept_as_canonical`, `accept_edited_canonical`, `keep_existing_canonical`, `use_as_resume_specific_only`). Only writes `member_profiles`, only for `canonical-profile` (scalar) destinations. **`canonical-profile-array` (employment/education/certifications/skills) confirmation writes were never built** — out of scope through Phase 3.
- `supabase/migrations/20260907120000_resume_intelligence_phase2_foundation.sql` — authored, revised in Phase 3, **never applied**.
- **Known gap:** `member_profiles` has no `email` column. `accept_as_canonical`/`accept_edited_canonical` for email fails loudly with an error rather than writing an undefined column. Needs a schema decision.

### Phase 3 — Canonical identity, import review, Master Resume (`resume-intelligence-phase3`, 8 commits on top of Phase 2)
- `src/lib/profile/entryIds.ts` — domain-neutral, additive id backfill (`ensureEntryIds`/`ensureEntryIdsForUser` + `ensureEducationEntryIds(ForUser)`/`ensureCertificationEntryIds(ForUser)`). Existing ids never regenerated. `src/lib/forwardDna/employmentEntryIds.ts` kept its exact public API, now delegates internally — zero call-site changes.
- Audited every Profile write path before relying on this (`ProfileEditForm`, `OnboardingQuestionnaire`, the shared `QuestionnaireFields` editors, strategist workspace). **Result: no id-loss risk exists** — all spread-preserve rather than reconstruct from a narrow schema. Locked in with regression tests. No reordering UI exists (N/A, not skipped).
- `src/lib/resumeIntelligence/import/importResumeDocument.ts` — the orchestration service: `member_documents` → storage download → extractor resolution → extraction → section detection → field mapping → `resume_field_proposals` persistence, tracked under a `resume_import_attempts` row. 6 typed `ImportStatus` outcomes (`succeeded`/`partial`/`unsupported_format`/`extraction_failed`/`parsing_failed`/`missing_source_document`, plus `no_content_found`) — no raw exception ever escapes.
- `src/lib/resumeIntelligence/import/reviewProposals.ts` — `fetchProposalsForReview()` + `recordProposalDecision()` (incremental, per-decision persistence; only marks a row `reviewed` once the canonical write actually succeeded).
- `src/lib/resumeIntelligence/masterResume/createMasterResume.ts` — creates the member's first Master Resume, validates every entry selection against the member's actual current Profile (reports+skips invalid references, never fabricates). **Refuses to run if an active Master already exists** — updating/swapping an existing Master is a separate action, deliberately not built yet (see §6).
- `src/lib/resumeIntelligence/masterResume/analyzeMasterResume.ts` — first real caller of the Phase 1 engine; builds `ResumeContentInput` from `resume_entries` selections (included/order/override), never the raw Profile.
- `src/components/ImportReviewPanel.tsx` — the review UI. Groups by Contact/Summary/Employment/Education/Certifications/Skills. Offers only the decisions that are actually valid for a given proposal. Conservative bulk-accept (high-confidence-only, listed before confirming). Incremental persistence. **Pure presentational component — not wired to a route/page yet** (see §6).
- Migration revised in place: `resume_entries` collapsed to `canonical_entry_id` + `skill_value`; added `resume_import_attempts` and `resume_field_proposals.import_attempt_id`/`superseded_at` for explicit (not timestamp-inferred) retry/supersession.

**Verification (current as of last push):** 739/739 tests passing across 136 files, `tsc --noEmit` clean.

---

## 4. Canonical entry identity — the key data-model fact

`member_profiles.employment_history`/`education`/`certifications` are JSONB arrays. Employment entries *can* carry a stable string `id` (was already backfilled opportunistically by Forward DNA); education/certifications had none until Phase 3. `src/lib/profile/entryIds.ts` now backfills all three the same way — **additively, only filling missing ids, never touching existing ones**. Skills stay identified by their own string value (`member_profiles.skills` is `string[]`, no per-entry object).

None of this is a real foreign key — Postgres cannot reference an element of a JSONB array. `resume_entries.canonical_entry_id`/`skill_value` are plain columns; `createMasterResume()` is the actual (application-level) enforcement point.

---

## 5. Database state

- **Live project:** `siysdmgdsxlceewlwngl` ("bolt-native-database"), Postgres 17.6. This is where `member_profiles`, `resume_versions`, `member_documents`, `applications`, etc. actually live.
- **Nothing from this project has ever been applied.** `resume_entries`, `resume_field_proposals`, `resume_import_attempts` don't exist live. The migration (`supabase/migrations/20260907120000_resume_intelligence_phase2_foundation.sql`) is fully authored and was validated read-only against the live schema (no naming collisions, all FK targets type-compatible) but is **not applied**.
- All new/existing RLS policies were checked directly against the live schema, not assumed.

---

## 6. What's designed but NOT implemented — the actual Phase 4 punch list

1. **Wire `ImportReviewPanel`/`analyzeMasterResume`/`createMasterResume` into real routed pages.** Nothing in Phase 3 has a URL a member can visit — the services and the review component exist and are tested in isolation, but no page assembles them.
2. **"Update an existing Master's entries" flow.** `createMasterResume()` deliberately refuses if a Master already exists (explicit non-silent-replace design). The actual update path was never built.
3. **"Promote a tailored version to Master" flow**, using the already-authored `set_master_resume_version()` atomic-swap RPC (in the migration, never called from application code yet).
4. **Apply the migration** — to a local/branch Supabase environment for integration testing first. Never production without explicit confirmation.
5. **Resume-specific overrides beyond an employment description have no persistence layer.** `summary_override`, education/certification overrides — proposal destinations are confirmed but `applyConfirmedProposals` never writes `resume-specific` destinations anywhere (by design, Phase 2's locked boundary). `analyzeMasterResume` currently always uses the canonical `member_profiles.summary`.
6. **`email` column gap on `member_profiles`.** Needs a schema decision before email can round-trip through the confirmation layer.
7. **`canonical-profile-array` (employment/education/certifications/skills) confirmation writes.** `applyConfirmedProposals` only ever writes the 3 scalar canonical-profile fields (`full_name`, `phone`, `location`) — never a full new employment/education/certification/skill entry into `member_profiles`. This is a real, unbuilt piece: accepting a *new* parsed employment entry "canonically" currently has no write path at all.

## 7. Explicit exclusions — do not build without a fresh decision

Visual Resume Builder/editor, template gallery, PDF export, DOCX export, `@react-pdf/renderer` or any render/export dependency, rendered ATS round-trip validation, AI parser, AI rewriting, job-specific tailoring, automatic applications, Profile 2.0 / relational normalization of `member_profiles` arrays (the JSONB-with-additive-ids approach was explicitly chosen over normalizing into child tables — revisit only if a concrete need appears, not preemptively).

## 8. Conventions to preserve

- **TDD throughout** — every module's test was written first, against the not-yet-built code, then implemented to green.
- **DI convention**: `client: SupabaseClient = defaultClient` as the last positional parameter on every service function; tests use a hand-built fake client (`vi.fn()` chains mimicking `.from().select().eq()...`), never a real Supabase connection.
- **Anti-fabrication discipline**: every proposal's evidence must be a literal excerpt of the source; ambiguity degrades confidence or yields nothing, never a confident guess.
- **No real resumes in fixtures** — all test people/companies are fabricated.
- Full verification before any push: full `vitest run`, `tsc --noEmit`, and a git-state check (branch, clean tree, diff scoped to intended files, other worktrees/branches untouched) every time.

---

*This document was compiled from the full multi-phase design/implementation record; nothing in it is speculative — it reflects only what was actually built, tested, and pushed.*
