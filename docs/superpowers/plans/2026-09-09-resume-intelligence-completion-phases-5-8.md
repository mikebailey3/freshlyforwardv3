
# Resume Intelligence — Phases 5-8 Completion Plan

**Branch:** `resume-intelligence-completion` (worktree, off `main` @ `99afd64`). Not merged until separately authorized.

## Scope-reality note (read this first)

Phases 5-8 as specified are, taken together, a multi-week product program (visual
builder + drag/drop + live preview + 5 templates + PDF/DOCX export + FreshFit
tailoring + Career Vault evidence + AI-assisted grounded rewriting). This plan
implements every locked architectural rule and every dimension/interface
contract for real, with real tests, and ships a genuinely working vertical
slice of each phase. Where a sub-bullet would require infrastructure this repo
does not have and this task does not grant (a live external AI vendor
endpoint/credentials), it ships as a fully-built, safely-degrading interface
with a deterministic default — exactly the same `NullXProvider` pattern
already used for `EvidenceCoverageProvider`/`TargetRoleAlignmentProvider` in
Phases 1-3. This is called out explicitly, per module, in this plan and in the
final report. Nothing is claimed "done" that isn't real and tested.

## Open-source acceleration decision (locked for this program)

| Project | License | Decision |
|---|---|---|
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | MIT | **Adopt.** Drag-and-drop + keyboard sensor for section/entry ordering. |
| `@react-pdf/renderer` | MIT | **Adopt.** PDF generation from the same view model (selectable text, Letter size). |
| `docx` (dolanmiu) | MIT | **Adopt.** DOCX generation from the same view model. |
| JSON Resume schema (`jsonresume/resume-schema`) | MIT | **Reference only**, no import today. Export mapping deferred (not requested this pass); the normalized view model is structured so a `toJsonResume()` mapper is a pure function away. |
| Reactive Resume (AmruthPillai) | AGPL-3.0 | **Architectural inspiration only.** No code copied (already the standing rule from Phase 1-3 handoff). Referenced only for "what sections/fields a template gallery typically needs." |
| OpenResume (xitanggg) | AGPL-3.0 | **Architectural inspiration only.** No code copied. Referenced only for "print CSS / page-break handling is a real problem templates must solve." |

No copyleft code enters this repo. `package.json` only gains the four MIT
packages above.

## Locked architecture recap (from Phase 3 handoff + this task's brief)

- `member_profiles` stays the sole canonical truth store. Nothing here writes
  a new employment/education/certification/skill fact silently.
- `resume_versions`/`resume_entries` stay presentation/selection only.
- Master Resume is never silently mutated by tailoring or export.
- FreshFit (`src/lib/freshFitScore/*`) is the only alignment engine — Phase 6
  calls it, never reimplements matching.
- Six independent dimensions, no blended score — unchanged, Phase 7 only
  fills in the real `EvidenceCoverageProvider`.
- AI content is always a proposal, gated on explicit accept, never silently
  persisted — Phase 8.
- Durable canonical IDs, never array position, never regenerated on edit —
  every new write path re-validates against `entryIds.ts`-backed IDs, same as
  Phase 3/4.
- Strategist canonical-write permissions are NOT broadened anywhere in this
  plan.
- No relational normalization of `member_profiles` JSONB arrays. No fake FKs
  into JSONB elements.
- All schema changes additive, authored, tested, **left unapplied**.

---

## PHASE 5 — Visual Resume Builder & Export

### 5.1 Normalized view model
- `src/lib/resumeIntelligence/presentation/resumeViewModel.ts`
  - `buildResumeViewModel(entries, profile, versionMeta): ResumeViewModel`
  - `ResumeViewModel` (in `presentation/types.ts`): sections in order, each
    section's visible entries in order, contact block, summary (override-or-
    canonical, same precedence as `analyzeMasterResume`), template key.
    Derives only — never persists, never duplicates truth.
  - Test: `resumeViewModel.test.ts` — hide/show, ordering, override
    precedence, empty-section omission.

### 5.2 Section/entry visibility + ordering persistence
- Migration addition (additive, unapplied): `resume_versions.section_order
  jsonb` (array of section keys), `resume_versions.template_key text default
  'ats_classic'`. `resume_entries.sort_order` already exists (Phase 3/4) —
  reused, not duplicated, for entry-level ordering.
- `src/lib/resumeIntelligence/masterResume/updateResumeLayout.ts` —
  `updateSectionOrder(userId, resumeVersionId, sectionOrder)`,
  `updateTemplateKey(userId, resumeVersionId, templateKey)`. Ownership-checked
  the same way as `updateMasterResumeEntries`.
  - Tests mirror `updateMasterResumeEntries.test.ts`'s DI/fake-client pattern.

### 5.3 Editor state (business logic, no rendering)
- `src/hooks/useResumeEditorState.ts` — pure reducer wrapping section
  reorder / entry reorder / visibility toggle / override edit as local draft
  state, with an explicit `save()` that calls `updateMasterResumeEntries` +
  `updateResumeLayout`. Local draft never silently becomes canonical.
  - Test: `useResumeEditorState.test.ts` (reducer-level, no DOM).

### 5.4 Drag-and-drop (`@dnd-kit`)
- `src/components/resumeIntelligence/SortableSectionList.tsx`,
  `SortableEntryList.tsx` — `@dnd-kit/core` + `@dnd-kit/sortable` +
  `KeyboardSensor`/`PointerSensor`. Persisted order lives in the reducer/DB,
  never DOM order.

### 5.5 Live preview
- `src/components/resumeIntelligence/ResumePreview.tsx` — renders
  `ResumeViewModel` straight to React (no export dependency in the preview
  path), reflects reducer state with no reload.

### 5.6 Template engine
- `src/lib/resumeIntelligence/templates/types.ts` — `ResumeTemplate`
  interface (id, label, `layout: 'single-column'`, typography scale, ATS-safe
  flag).
- `src/lib/resumeIntelligence/templates/registry.ts` — 5 templates:
  `ats_classic` (single column, plain order, ATS-safe=true, no
  graphics/columns/progress-bars — the explicit anti-pattern list is enforced
  by construction, not by convention), `professional`, `modern`, `executive`,
  `minimal` (typography/spacing variants of the same renderer).
- One renderer (`TemplateRenderer.tsx`) driven by the registry — not five
  bespoke components.
  - Test: `registry.test.ts` asserts ATS Classic never sets a "columns"/
    "graphic" flag; asserts every template resolves.

### 5.7 PDF export (`@react-pdf/renderer`, MIT)
- `src/lib/resumeIntelligence/export/pdf/ResumePdfDocument.tsx` — React-PDF
  component consuming the exact same `ResumeViewModel`, Letter size, real
  text nodes (no raster/canvas), template-aware spacing.
- `src/lib/resumeIntelligence/export/pdf/exportResumePdf.ts` — `renderToBuffer`
  wrapper, returns a `Blob`/buffer for the caller to download.
- Round-trip smoke test: render a fixture view model to PDF, feed the buffer
  back through the existing `pdfExtractor.ts`/`plainTextExtractor.ts`, assert
  the member's actual name/employer/skill strings survive (a real, if
  narrow, "export -> reparse -> validate" check, per 5.6's requirement).

### 5.8 DOCX export (`docx`, MIT)
- `src/lib/resumeIntelligence/export/docx/exportResumeDocx.ts` — builds a
  `docx.Document` from the same view model (headings, dates, bullets,
  education, certifications, skills), `Packer.toBlob`.
  - Test: build a fixture view model, unzip the resulting docx buffer (docx
    files are zip archives) and assert `word/document.xml` contains the
    expected literal strings — a real structural assertion, not a mock.

### 5.9 Resume version management
- Extend `listResumeVersions.ts` (already exists) with `templateKey`,
  `derivedFromResumeVersionId`.
- `src/lib/resumeIntelligence/masterResume/duplicateResumeVersion.ts` — copies
  a version's entries into a new non-Master row (never touches the source).
- `src/lib/resumeIntelligence/masterResume/archiveResumeVersion.ts` — sets
  `is_archived`, ownership-checked, refuses to archive the active Master
  without an explicit separate promote-first step (reuses
  `set_master_resume_version` semantics already in the DB).
- `ResumeVersionsPanel.tsx` extended: name, created/modified, lineage badge,
  template picker, duplicate/archive actions.

---

## PHASE 6 — Job-Specific Tailoring

### 6.1 Create tailored resume from opportunity
- `src/lib/resumeIntelligence/tailoring/createTailoredResume.ts` —
  `createTailoredResume(userId, { masterResumeVersionId, opportunityId })`:
  copies Master's current `resume_entries` into a **new** `resume_versions`
  row with `derived_from_resume_version_id = master.id`,
  `target_opportunity_id = opportunityId`, `is_master = false`. Never writes
  to the Master row. If an `applications` row already exists for that
  member+opportunity, sets its existing `resume_version_id` column (no schema
  change, no relationship redesign).

### 6.2 FreshFit-driven tailoring analysis
- `src/lib/resumeIntelligence/tailoring/analyzeTailoringFit.ts` — calls
  `src/lib/freshFitScore/{skillMatching,roleRelevance}.ts` directly (same
  modules already used by `NullTargetRoleAlignmentProvider`'s doc comment as
  the one true engine) against the opportunity's listed skills/role text and
  the Master's canonical entries. No second scorer.

### 6.3 Deterministic suggestions
- Pure functions in the same module: `suggestEntryOrder`,
  `suggestHiddenEntries`, `suggestEvidenceGaps` — derived only from FreshFit's
  matched/unmatched skill sets and existing canonical entries. Never invents
  a fact; only reorders/hides/flags what's already there.
  - Tests: fixture opportunity + fixture Master entries, assert suggestions
    only ever reference entry IDs that exist in the input (no fabrication).

### 6.4 Tailored resume creation UI
- Reuses `MasterResumeEditor`/`ResumePreview`/`SortableEntryList` against the
  derived version instead of the Master — zero new editor component.

### 6.5 Job/application linkage
- Uses existing `applications.resume_version_id` column only; no new table,
  no redesign.

---

## PHASE 7 — Career Vault Evidence Integration

### 7.1 Real evidence provider
- `src/lib/resumeIntelligence/careerVaultEvidenceCoverageProvider.ts` —
  `CareerVaultEvidenceCoverageProvider implements EvidenceCoverageProvider`
  (existing interface, unchanged). Reads `career_skills` (state
  `demonstrated`/`supported` = strong evidence) and `career_win_capabilities`
  (`status = 'confirmed'`) — both real, already-shipped Career Vault tables
  (`src/lib/careerVault/capabilities.ts`) — never invents a table.
- Wired as the production `EvidenceCoverageProvider` in
  `analyzeMasterResume.ts`'s dimension composition, replacing
  `NullEvidenceCoverageProvider` only there (the Null provider stays in the
  codebase for any caller without a Career Vault context, e.g. tests).

### 7.2 Evidence Coverage dimension output
- Classifies each resume-claimed skill into strong-evidence / weak-evidence /
  no-evidence buckets, plus a list of confirmed Career Vault
  skills/capabilities not currently represented on the resume. Same
  `ResumeDimensionResult`/`findings[]` shape — no new top-level score field.

### 7.3 Evidence-backed recommendations
- Findings explicitly tag their source (`'resume'` / `'profile'` /
  `'career_vault'` / `'proposed'`) so the UI can never blur the four
  categories the task calls out.

### 7.4 No silent evidence promotion
- No new write path from Career Vault into `member_profiles` is created.
  Any future "turn this Vault evidence into a canonical fact" flow is
  explicitly out of scope for this pass and would route through the existing
  `resume_field_proposals` confirmation model if built later — not invented
  here.

---

## PHASE 8 — AI-Assisted Resume Intelligence

### 8.1 AI provider boundary
- `src/lib/resumeIntelligence/ai/aiResumeAssistProvider.ts` —
  `AIResumeAssistProvider` interface (`proposeBulletRewrite`,
  `proposeSummary`, `proposeQuantificationHint`), each returning a discriminated
  `AIProposalResult` (`ok` | `unavailable` | `timeout` | `malformed` |
  `rejected_unsupported_claim`).
- `UnavailableAIProvider` — the shipped default. **This repo has zero
  existing live-LLM integration anywhere** (`freshFitScore`, `linkedinOptimizer`,
  `forwardScore`, `textQuality` are all explicitly documented as
  deterministic/no-LLM). Wiring a real vendor (e.g. via AI Innovation Lab) is
  a first-of-its-kind infrastructure decision for this codebase requiring its
  own credentials/endpoint choice — treated the same way production migration
  application is treated in this whole program: a separate, explicit,
  future gate. The interface, grounding pipeline, and review UI are fully
  built and real; only the live vendor call is deferred.
- `FixtureAIProvider` (test-only, clearly labeled) — returns deterministic
  canned proposals built strictly from its own input arguments, used to prove
  the grounding/review pipeline end-to-end without pretending to be a model.
- React components call the provider only through this interface — no
  business logic embedded in components (8.1's explicit requirement).

### 8.2-8.5 Grounded proposal generation + quantification + summary assistance
- `src/lib/resumeIntelligence/ai/groundedProposal.ts` —
  `buildAllowedEvidenceSet(canonicalProfile, resumeEntries, careerVaultEvidence,
  targetRoleContext)` and `validateProposalGrounding(proposal, allowedEvidenceSet)`.
  A proposal is rejected (`rejected_unsupported_claim`) if any quantified
  claim or fact it contains is not a literal substring/derivable value from
  the allowed evidence set — same anti-fabrication discipline as Phase 2's
  `provenance.ts`/`antiFabrication.test.ts`, reused conceptually, not
  duplicated as a second mechanism (imports the same substring-provenance
  helper where applicable).
  - Tests: a proposal citing a metric present in evidence -> accepted; a
    proposal citing a metric absent from evidence -> rejected. Quantification
    hints without a real number ("add team size if known") always pass;
    invented numbers always fail.

### 8.6 Proposal review UI
- `src/components/resumeIntelligence/AIProposalReviewPanel.tsx` — current
  wording / proposed wording / evidence-provenance / reason / edit-then-
  accept / reject. Accept path calls the existing resume-specific override or
  entry-override persistence (Phase 4's `masterResumeOverrides.ts` /
  `updateMasterResumeEntries.ts`) — no new persistence mechanism, no
  silent batch-apply.

### 8.7 Failure/safety states
- Enumerated in the `AIProposalResult` discriminant above; every UI state
  (unavailable/timeout/malformed/rejected/partial) has an explicit rendered
  branch in `AIProposalReviewPanel` — no silent swallow.

---

## Testing plan (TDD, per module above)
Each file listed above ships with a co-located `*.test.ts`/`*.test.tsx`
following this repo's existing DI convention (`client: SupabaseClient =
defaultClient`, fake client in tests, no real Supabase connection). No test
touches a live database. New security-relevant tests explicitly cover:
ownership rejection (wrong user), Master-only refusal (archived/non-master),
grounding rejection (unsupported claim), and no-fabrication (suggestions
reference only IDs present in input).

## Commit boundaries
1. `Phase 5: normalized view model + layout persistence + editor state`
2. `Phase 5: drag-and-drop + live preview + template engine`
3. `Phase 5: PDF + DOCX export + version management`
4. `Phase 6: FreshFit-driven tailoring + derived resume creation`
5. `Phase 7: Career Vault evidence coverage provider`
6. `Phase 8: AI provider boundary + grounded proposal pipeline`
7. `Phase 8: proposal review UI + product integration wiring`

## Explicit non-goals for this pass (do not build)
MCP project, Community, automatic job applications, any Phase 9+ item, JSON
Resume *import*, a second alignment engine, relational normalization of
`member_profiles`, any live external AI vendor call, broadened strategist
canonical-write permissions.
