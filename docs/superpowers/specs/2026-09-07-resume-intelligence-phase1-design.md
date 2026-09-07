# Resume Intelligence Phase 1 — Foundation Design Spec

**Status: Architecture approved 2026-09-07 (Option A — Structured-First,
File-Optional). This document records the locked decisions and the
foundational implementation that shipped under them: canonical types,
shared text-quality primitives, four deterministic analysis dimensions,
and interface boundaries for the two dimensions that depend on systems
not yet wired (FreshFit alignment, Career Vault evidence). No migration
written or applied. No parsing, editor UI, templates, export, or AI
rewriting built — all explicitly deferred past this phase.**

---

## 0. Product Principle

Career Vault (evidence) → `member_profiles` (canonical career content,
unchanged) → Resume Intelligence (version/presentation layer over that
content) → Job-Specific Tailoring → Opportunity Engine. A resume is never
a second source of truth for career history — it selects, presents, and
scores existing content.

---

## 1. Locked Decisions (2026-09-07)

1. **`member_profiles.{employment_history,education,skills}` remains the
   canonical base.** Resume Intelligence does not create a competing
   career-history source of truth. `src/lib/resumeIntelligence/types.ts#ResumeContentInput`
   is built directly from the existing `EmploymentEntry`/`EducationEntry`
   types in `src/types/index.ts` — not a new parallel shape.
2. **Career Vault is an evidence source, never a write target.** See §5.
3. **A resume is a version/presentation layer**, not new career-history
   storage. See §4 (`ResumeDocument`/`ResumeEntry`).
4. **The Master Resume is comprehensive, not page-constrained.** It
   represents the member's full reusable career content; tailored
   versions are what get trimmed/selected for a specific application.
5. **Tailored resumes preserve lineage** back to the Master Resume via
   `ResumeDocument.derivedFromResumeId`.
6. **FreshFit remains the only matching/alignment engine.** Target Role
   Alignment calls into it — Phase 1 ships the interface boundary only
   (§6), no second matcher.
7. **Dimension-separated analysis, never a blended score.**
   `ResumeIntelligenceResult` has no top-level `score` field — enforced
   structurally by the type, not just by convention (`src/types/resume.ts`).
8. **AI-generated/rewritten content is always proposed, never silently
   applied.** `ResumeContentSuggestion` (§4) mirrors Career Vault's
   suggest/confirm shape. No AI is implemented in this phase.
9. **JSON Resume is import/export interop only**, never the internal
   model — not implemented in this phase.
10. **Reactive Resume (MIT) is pattern/reference only** — scoped to the
    ATS finding/rule-catalog shape (`code`/`severity`/`meaning`/`evidence`/`action`)
    used in §7, a future optional AI mapper/provider reference, and later
    template/render research. It is explicitly **not** the
    deterministic-parser reference: Phase 2's `resume → structured data`
    extraction and field-mapping logic (`src/lib/resumeIntelligence/parsing/`)
    was built clean-room against unpdf/mammoth output and this codebase's
    own conventions, with no Reactive Resume code, algorithm, or design
    copied. No code from Reactive Resume is copied anywhere in this
    codebase. **Verified directly against a local clone of the Reactive
    Resume repository** (`amruthpillai/reactive-resume`, commit
    `ad91a0838c7d739eec4df5b2622750b0a4f1f7f3`, 2026-09-07) — the earlier
    version of this line could not be confirmed from this environment;
    with the local clone available, here is what the source actually
    does. Its import dialog (`apps/web/src/dialogs/resume/import.tsx`)
    branches by file type: **`.docx`/`.doc` import has no deterministic
    path at all** — `aiRequired = type === "docx"`, and the dialog
    blocks the import entirely ("Importing from Word requires a
    connected AI provider") if none is configured. **PDF import prefers
    AI but has a deterministic fallback**: with a usable AI provider
    connected it calls `client.ai.parsePdf`, which sends the raw PDF
    file straight to an LLM (`packages/api/src/features/ai/service.ts`,
    `generateText` with the file as a multimodal message part); with no
    provider connected it falls back to `extractPdfLines` + the
    deterministic `parseResumeText` (`packages/import/src/plain-text.ts`)
    — geometric PDF-to-text extraction (font-relative line clustering,
    column-gutter detection, shared with Reactive Resume's own ATS
    checker) followed by rule-based line parsing, no LLM involved. One
    further nuance worth recording precisely: for `.docx` specifically
    (not legacy `.doc`), the server extracts plain text deterministically
    first (`extractDocxText`) and sends that *text*, not the raw file
    bytes, to the LLM — only PDF and legacy `.doc` send the raw file
    itself. None of this changes anything about FreshlyForward's own
    architecture: Phase 2's parser remains deterministic-first by design
    (§2 of the Phase 2 spec) and was built clean-room, independent of
    which of Reactive Resume's two import paths it might otherwise have
    resembled. (Superseded caveat, kept for history: an earlier pass
    relying on public README/search sources only found JSON/Markdown
    export-to-assistant workflows and multi-provider AI settings, not a
    documented PDF/DOCX-upload parsing feature — the direct source
    inspection above supersedes that gap.)
11. **Open Resume (AGPL) is algorithm-pattern research only.** No code
    referenced or copied in this phase (no parsing was built at all this
    phase — see §9).
12. **RenderCV's ATS round-trip extraction testing technique** is
    adopted when PDF export is eventually implemented — not yet, since no
    export exists in this phase.
13. **No locked surface modified** except the one explicit,
    behavior-preserving extraction in §3 (`linkedinOptimizer.ts`).
14. **No Supabase migration run or applied.** §8 describes the proposed
    schema; nothing has been written as a `.sql` file.

---

## 2. Canonical Types (`src/types/resume.ts`)

| Type | Purpose |
|---|---|
| `ResumeFinding` | One explainable finding: `code`, `severity`, `meaning`, `evidence` (always a literal excerpt, never a paraphrase), `action`. |
| `ResumeDimensionKey` | `atsReadability \| structuralQuality \| contentStrength \| quantification \| targetRoleAlignment \| evidenceCoverage`. |
| `ResumeDimensionResult` | One dimension's `{key, label, status, score, unavailableReason?, findings[]}`. `status: 'unavailable'` forces `score: null` — a dimension can never fabricate a number when its upstream dependency isn't wired. |
| `ResumeIntelligenceResult` | `{dimensions: ResumeDimensionResult[]}` — no blended score field exists on this type at all. |
| `TargetRoleAlignmentProvider` / `EvidenceCoverageProvider` | Interfaces for the two dimensions Phase 1 does not implement (§6, §5). |
| `ResumeDocument` / `ResumeEntry` / `ResumeContentSuggestion` | Forward-looking version/lineage/suggestion shapes — types only, no persistence yet (§4, §8). |

---

## 3. Shared Text-Quality Extraction (`src/lib/textQuality/`)

`CLICHES`, `WEAK_OPENERS`, `VERB_MAP`, `hasMetric()`, `findCliches()`,
`rewriteBullet()` were moved out of `src/lib/linkedinOptimizer.ts`
verbatim (no logic changed) into `src/lib/textQuality/index.ts`, with
`linkedinOptimizer.ts` importing them back and re-exporting `rewriteBullet`
for its one external consumer (`LinkedInOptimizerPage.tsx`).

**Regression proof:** `src/lib/linkedinOptimizer.test.ts` did not exist
before this phase. It was written first, as a characterization suite
against the *pre-extraction* file (11 tests, all passing), then the
extraction was performed, then the same suite was re-run unchanged — still
11/11 passing. `src/lib/textQuality/index.test.ts` adds 11 more tests
against the primitives directly.

This is now the shared foundation both `linkedinOptimizer.ts`'s
content-quality scoring and `resumeIntelligence/{contentStrength,quantification}.ts`
consume — no duplicated heuristics.

---

## 4. Version/Lineage Model (types only — `src/types/resume.ts`)

```
ResumeDocument (Master, is_master=true)
      │ derivedFromResumeId
      ▼
ResumeDocument (tailored, targetOpportunityId = <opportunity>)
      │
      ▼
ResumeEntry (per included employment_entry_id, optional overrideDescription)
      │
      ▼
ResumeContentSuggestion (pending/accepted/rejected, evidenceReference nullable)
```

- `ResumeEntry.originalDescription` is always retained alongside any
  `overrideDescription` — nothing in `member_profiles` is ever silently
  rewritten, mirroring Career Vault's "never rewrite `original_statement`"
  rule.
- `ResumeContentSuggestion` is never auto-applied; `status` starts
  `'pending'` and only a member action moves it to `'accepted'`/`'rejected'`.

---

## 5. Evidence Model / Career Vault Relationship

Career Vault (`docs/superpowers/specs/2026-09-01-career-vault-capability-engine-design.md`)
is not implemented yet — spec and plan approved, no migration applied.
Resume Intelligence's `EvidenceCoverageProvider` interface exists so that,
once Career Vault ships, a `CareerVaultEvidenceCoverageProvider` can read
confirmed `career_win_capabilities` rows and slot in with zero change to
any caller. Until then, `NullEvidenceCoverageProvider`
(`src/lib/resumeIntelligence/evidenceCoverage.ts`) reports the
`evidenceCoverage` dimension as `status: 'unavailable'`, `score: null`,
with an honest `unavailableReason` — never invented coverage data.

---

## 6. Target Role Alignment / FreshFit Relationship

`TargetRoleAlignmentProvider` exists so a future
`FreshFitTargetRoleAlignmentProvider` can call
`src/lib/freshFitScore/{skillMatching,roleRelevance}.ts` directly — no
second matching engine is ever built. Until wired,
`NullTargetRoleAlignmentProvider` (`src/lib/resumeIntelligence/alignment.ts`)
reports `targetRoleAlignment` as `status: 'unavailable'`, `score: null`.

---

## 7. Analysis Dimensions Implemented This Phase

All four deterministic dimensions score via one shared helper,
`scoreFromFindings()` (`src/lib/resumeIntelligence/score.ts`): start at
100, deduct `error: 25 / warning: 10 / info: 3` per finding, clamp to
`[0, 100]`. Every finding follows **Finding → why it matters → evidence →
recommended action**.

**Scope note on ATS Readability:** this dimension analyzes structured
content (`ResumeContentInput`, the same shape `member_profiles` and the
Phase 2 parser produce) — it checks whether identity/contact *fields are
present and well-formed*, never whether a rendered PDF/DOCX file would
survive an actual ATS's own parsing. There is no rendered-file ATS
round-trip validation anywhere in Phase 1 or Phase 2 (no PDF/DOCX export
exists yet); that is RenderCV's round-trip technique (decision #12,
above), explicitly deferred until export is built.

| Dimension | Module | Rules implemented |
|---|---|---|
| ATS Readability | `atsReadability.ts` | `MISSING_NAME` (error), `MISSING_EMAIL` (error), `MALFORMED_EMAIL` (error), `MISSING_PHONE` (warning), `MISSING_LOCATION` (info) — pattern-adapted from Reactive Resume's ATS catalog shape, clean-room. |
| Structural Quality | `structuralQuality.ts` | `NO_EXPERIENCE_ENTRIES` (warning), `EMPLOYMENT_MISSING_START_DATE` (warning, per entry), `EMPLOYMENT_MISSING_DESCRIPTION` (warning, per entry), `NO_SKILLS_LISTED` (warning), `FEW_SKILLS_LISTED` (info, <5), `NO_EDUCATION_ENTRIES` (info). |
| Content Strength | `contentStrength.ts` | `CLICHE_IN_SUMMARY` (info), `CLICHE_IN_BULLET` (info, per entry), `WEAK_OPENER_BULLET` (warning, per entry) — uses `findCliches`/`WEAK_OPENERS` from `textQuality`. |
| Quantification | `quantification.ts` | `NO_BULLETS_TO_QUANTIFY` (info, when no employment descriptions exist), `BULLET_NOT_QUANTIFIED` (info, per entry) — uses `hasMetric` from `textQuality`. |
| Target Role Alignment | `alignment.ts` | Interface + `NullTargetRoleAlignmentProvider` only (§6). |
| Evidence Coverage | `evidenceCoverage.ts` | Interface + `NullEvidenceCoverageProvider` only (§5). |

`src/lib/resumeIntelligence/index.ts#computeResumeIntelligence(content, options)`
runs all six and returns `{dimensions: ResumeDimensionResult[]}`, with
`alignmentProvider`/`evidenceProvider` as DI options (default to the null
providers) — same `client: SupabaseClient = defaultClient` DI convention
used throughout the codebase (`opportunityEngine.ts`, `forwardDna/*.ts`).

---

## 8. Proposed Future Database Schema (described only — NOT written or applied)

Purely additive, following the exact structural convention of
`20260831000000_forward_dna.sql` and the (also not-yet-applied) Career
Vault migration:

```sql
-- Not written this phase. Description only.

CREATE TABLE IF NOT EXISTS resume_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_master boolean NOT NULL DEFAULT false,
  derived_from_resume_id uuid REFERENCES resume_documents(id) ON DELETE SET NULL,
  target_opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  -- Transitional, backward-compatible with the existing resume_versions shape:
  file_path text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- UNIQUE partial index: at most one is_master=true row per user_id (enforced at migration time, not designed further here).

CREATE TABLE IF NOT EXISTS resume_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_document_id uuid NOT NULL REFERENCES resume_documents(id) ON DELETE CASCADE,
  employment_entry_id text NOT NULL,
  included boolean NOT NULL DEFAULT true,
  override_description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resume_content_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_document_id uuid NOT NULL REFERENCES resume_documents(id) ON DELETE CASCADE,
  target_field text NOT NULL,
  proposed_text text NOT NULL,
  evidence_reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

-- RLS: identical 3-way member/strategist/admin SELECT pattern already used
-- verbatim across resume_versions, cover_letters, career_scope, and the
-- (also not-yet-applied) Career Vault tables. Not repeated here -- see
-- phase4_operational_engine.sql / 20260831000000_forward_dna.sql for the
-- exact clause to reuse.
```

`applications.resume_version_id` compatibility: `resume_documents` is
designed as a superset of `resume_versions` (keeps `file_path`/`file_name`)
so a future migration can either extend `resume_versions` in place or
have `applications` grow a second nullable FK — that choice is deferred
to implementation time, not decided here.

---

## 9. What Was Deliberately Not Built This Phase

Parsing (file → structured data), the resume editor/preview UI, templates,
PDF/DOCX export, any AI integration, any live migration, and resolving the
pre-existing `resume_versions` vs. `member_documents` duplication (named
in the architecture audit, not fixed here). All per the explicit
instruction to stop after this foundation.

---

## 10. Testing Strategy (executed this phase)

Every deterministic module has direct unit tests (TDD: test written and
run against the not-yet-implemented module first, then implemented, then
re-run green). `linkedinOptimizer.test.ts` is a full characterization
suite proving the shared-primitive extraction changed no behavior. See
the implementation report for exact counts.
