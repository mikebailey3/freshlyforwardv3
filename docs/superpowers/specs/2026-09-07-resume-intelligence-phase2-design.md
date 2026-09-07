# Resume Intelligence Phase 2 — Parsing & Confirmation Design Spec

**Status: Architecture approved 2026-09-07. This document records the
locked design (including the five corrections and one persistence
clarification made during review) and the implementation that shipped
under it: document extraction (TXT/PDF/DOCX), deterministic section
detection, deterministic field mapping for all nine resume fields,
structured proposal/provenance generation, anti-fabrication guarantees,
and an explicit five-decision confirmation layer. Persistence is authored
as a migration but not applied. No visual editor, export, AI parsing/
rewriting, job tailoring, or live migration was built — all explicitly
deferred past this phase.**

This document supersedes §8 of
`2026-09-07-resume-intelligence-phase1-design.md` ("Proposed Future
Database Schema"): that section's `resume_documents` table was a
placeholder sketch that explicitly deferred the `resume_versions` vs.
`member_documents` question. This phase resolved that question —
`resume_versions` is extended in place, `member_documents` stays general
upload intake — and the schema below is what was actually authored.

---

## 1. Product Principle (unchanged from Phase 1)

Career Vault (evidence) → `member_profiles` (canonical career content) →
Resume Intelligence (version/presentation layer) → Job-Specific Tailoring
→ Opportunity Engine. Parsing an uploaded resume never creates a second
source of career truth — it only ever *proposes* writes to
`member_profiles`, and only a member's explicit confirmation applies one.

---

## 2. The Five Corrections (locked into this design)

1. **Confirmation routing is semantic, decided by explicit member action —
   never by whether the target `member_profiles` field happens to be
   empty.** `accept_as_canonical` writes even when the field already has
   content; there is no "empty field → canonical, non-empty → resume-only"
   rule anywhere in this codebase. See §6.
2. **No redundant canonical flag.** `ProposalDestination.kind` is the sole
   source of truth for "is this canonical" — `isCanonicalDestination()`
   derives the answer; no `isCanonical` boolean is stored alongside it,
   in TypeScript or in the schema (§8's `destination_kind` column is the
   only place this lives).
3. **Provenance is structured, not a human-readable string.** Every
   proposal carries `sourceDocumentId`, `sectionKind`, `blockOrders`,
   `sourceExcerpt`, `page`, `matchedRule` as discrete fields (§5),
   extensible by adding new *optional* fields later (PDF bounding boxes,
   a Career Vault evidence reference, extraction engine, AI provider
   metadata) — none implemented speculatively.
4. **Name confidence is medium by default.** The name heuristic (first
   1-4 capitalized words on the first content line) never reaches
   `'high'` on its own — corroboration beyond the heuristic itself would
   be required, and none is implemented this phase. Format-validated
   unique fields (email) can still reach `'high'`.
5. **The employment parser test corpus covers nine synthetic layout
   variations** — see §4.3.

---

## 3. Extraction (`src/lib/resumeIntelligence/parsing/`)

| Format | Module | Library |
|---|---|---|
| Plain text | `plainTextExtractor.ts` | none — line/blank-line block splitting |
| PDF | `pdfExtractor.ts` | `unpdf` (MIT) — `getDocumentProxy` + `extractTextItems`, blocks sorted by descending Y then ascending X per page |
| DOCX | `docxExtractor.ts` | `mammoth` (BSD-2-Clause) → HTML, walked block-by-block with `cheerio` (pre-existing dependency) |

All three implement the shared `DocumentExtractor` interface
(`parsing/types.ts`) and resolve via `resolveDocumentExtractor()`
(`resolveExtractor.ts`) keyed on MIME type, returning a
`DocumentExtractionError` (never a throw) for unsupported types. Every
extractor produces the same normalized `ExtractedDocument`: `fullText`
plus an ordered `blocks[]` (`order`, `text`, `page`, `position`,
`styleHint`), so section detection and field mapping never need to know
which format produced the document.

**Deviation from the Phase 1 §8 placeholder / originally discussed
package set:** none — `unpdf` and `mammoth` were the locked choices from
the reuse-research pass and were used as designed. The one
implementation-discovered detail: mammoth's Node entrypoint accepts
`{buffer}` / `{path}` / `{file}`, not `{arrayBuffer}` despite the
published `.d.ts` listing it — `docxExtractor.ts` passes
`Buffer.from(file)`. Browser usage of mammoth is unverified and not
exercised by anything in this phase.

---

## 4. Section Detection & Field Mapping

### 4.1 Section detection (`sectionDetector.ts`)

`DeterministicSectionDetector` walks blocks in order, classifying heading
lines against `HEADING_RULES` (keyword/style-hint table covering Summary,
Experience, Education, Certifications, Skills) plus an implicit leading
**contact** section (blocks before the first recognized heading). Content
under a heading that matches no known category becomes an `unknown`-kind
section — **kept, never dropped or merged into a known section** (proven
by `antiFabrication.test.ts`'s "unknown content is preserved" case).
Total block count across all returned sections always equals the input
block count minus heading blocks themselves.

### 4.2 Field mapping (`fieldMapper.ts` + `fieldExtractors/*.ts`)

`DeterministicResumeFieldMapper` implements the `ResumeFieldMapper`
interface and is a pure composition of nine independent extractors — no
field's extraction depends on another's output:

`name`, `email`, `phone`, `location`, `summary`, `employment`,
`education`, `certifications`, `skills`.

Each extractor is a small (~20-60 line), independently tested pure
function from `DetectedSection[]` to `ResumeFieldProposal[]`, using
`buildProposal()` / `buildMultiBlockProposal()` (`fieldExtractors/helpers.ts`)
to assemble the proposal + provenance shape consistently.

### 4.3 Employment parsing corpus (`fieldExtractors/employment.test.ts`)

The highest-risk extractor: splitting a free-form Experience section into
discrete role entries. All entries and companies are fabricated
(Jordan Ellis / Initech Corp / Northwind Traders / Globex LLC / Vantage
Capital / Helios Systems / Meridian Logistics / Solstice Media / Fathom
Analytics) — no real resumes are checked into git anywhere in this
repository. The corpus covers all nine required layouts: title→company→date,
company→title→date, title/company on the same line, a separately
positioned date block, an aligned date block, bullet-style descriptions,
paragraph-style descriptions, multiple roles at the same employer, current
employment (no end date), and a resume with no conventional section
headings at all (which correctly yields zero employment candidates rather
than a guess — see §5).

`education.ts` uses a deliberately different algorithm (institution-
keyword anchoring, not header/description classification) — an honest,
narrower approach: an education block using no recognized institution
keyword yields zero candidates rather than a guess.

---

## 5. Proposal / Provenance Generation

Every `ResumeFieldProposal` (`src/types/resume.ts`) pairs a candidate
value with:

- `destination: ProposalDestination` — the discriminated union from
  correction #2, one of `canonical-profile` (scalar `member_profiles`
  field), `canonical-profile-array` (`employment_history` / `education` /
  `certifications` / `skills`, by index or `'append'`), or
  `resume-specific` (never touches `member_profiles`).
- `provenance: ResumeFieldProvenance` — structured per correction #3.
- `confidence: 'high' | 'medium' | 'low'`.
- `proposedAction: 'create' | 'update' | 'no-op-already-present'`.

**Anti-fabrication invariant** (`antiFabrication.test.ts`, 10 tests,
exercising the real extractor → section detector → field mapper pipeline
end to end, not individual units):

- Every `provenance.sourceExcerpt` is a literal substring reconstructable
  from the blocks named in `provenance.blockOrders` — never text pulled
  from elsewhere in the document.
- Every `candidateValue` derives only from those same referenced blocks.
- No proposal's `candidateValue` contains a digit sequence absent from
  the source document's full text (no fabricated metrics).
- A field with no supporting text in the source produces **no proposal**
  for that field — absence, not a guessed default.
- Ambiguity degrades confidence or yields no candidate, never a confident
  guess: multiple competing emails both degrade to `'low'` rather than
  one being silently preferred; the name heuristic never exceeds
  `'medium'` (correction #4); a document with no resume-like structure
  produces zero employment/education candidates.

**Interface deviation from the originally locked design:** the locked
`ResumeFieldMapper.map(sections, document)` two-argument signature had no
slot for `sourceDocumentId`, which structured provenance (correction #3)
requires on every proposal. `map()` gained a third, optional parameter —
`map(sections, document, sourceDocumentId?)`, defaulting to `'unknown'`
when omitted — a backward-compatible addition, not a breaking change to
the locked shape. Any future `AIResumeFieldMapper` keeps the same
signature.

---

## 6. Confirmation Layer (`confirmation/applyConfirmedProposals.ts`)

Implements the five distinguishable decisions
(`ConfirmationDecision`, correction #1 / persistence clarification):

| Decision | Writes to `member_profiles`? |
|---|---|
| `reject` | No |
| `accept_as_canonical` | Yes — `candidateValue`, **regardless of whether the field already has content** |
| `accept_edited_canonical` | Yes — the member-edited `editedValue` (never `candidateValue`); missing `editedValue` is a reported error, not a silent fallback |
| `keep_existing_canonical` | No (distinct from `reject` — reviewed and explicitly kept, not rejected as wrong) |
| `use_as_resume_specific_only` | No — never, even for a canonical-shaped proposal |

Routing is purely by `decision`, never by field emptiness — the whole
point of correction #1. `applyConfirmedProposals()` processes a batch of
decisions independently (`errors: string[]` in the result; one failure
does not block the others) and returns a reported error, not a silent
no-op, for two additional invalid states: `accept_as_canonical`/
`accept_edited_canonical` against a `resume-specific` destination, and
`accept_as_canonical`/`accept_edited_canonical` for `email`.

**Known limitation, flagged for a future schema decision:**
`member_profiles` has no `email` column
(`20260802172349_phase3_membership_system.sql` defines only `full_name`,
`phone`, `location` as scalar profile fields). The approved
`ProposalDestination` design includes `email` as a `canonical-profile`
field. Rather than silently writing an undefined column,
`applyConfirmedProposals()` explicitly detects this and returns an error
containing `"email"` (proven by test). This is a real gap between the
approved type design and the live schema — closing it (adding an `email`
column, or re-scoping `email` to a different destination kind) is
unresolved and should be decided before any Phase 3 UI exposes email
confirmation.

`canonical-profile-array` destinations (employment_history, education,
certifications, skills) are **out of scope for this function** — Phase 2
ships confirmation for the four scalar `canonical-profile` fields
(`full_name`, `phone`, `location`, and the not-yet-supported `email`)
only. Array-field confirmation is deferred to the persistence layer
landing with `resume_entries` (§8), since selecting/appending into a
`member_profiles` array entry is a materially different operation from a
scalar `UPDATE`.

---

## 7. Workflow Status vs. Decision (persistence clarification)

Per the explicit clarification during review: `status` and `decision` are
modeled as **separate** fields, not one overloaded column. `status` is
minimal — `'pending' | 'reviewed'` — while `decision` is the actual
`ConfirmationDecision` (`null` while pending, set exactly once when
`status` becomes `'reviewed'`). This is deliberately not a generalized
workflow engine: two states, one decision field, so `reject` and
`keep_existing_canonical` (both `status = 'reviewed'`) remain
distinguishable for later parsing evaluation, AI training, or analytics
that need to know *why* a proposal was not applied, not just that it
wasn't.

---

## 8. Persistence — Authored, Not Applied

`supabase/migrations/20260907120000_resume_intelligence_phase2_foundation.sql`
is written and reviewed but **not run against any live Supabase project**.
No Phase 2 application code writes to `resume_entries` or
`resume_field_proposals` — `applyConfirmedProposals()` only ever writes to
the pre-existing `member_profiles` table.

Additive to the existing schema:

- **`resume_versions`** (unchanged identity, unchanged
  `applications.resume_version_id` FK) gains three nullable columns:
  `derived_from_resume_version_id` (Master lineage),
  `target_opportunity_id`, `source_document_id` (which `member_documents`
  upload, if any, this version originated from).
- **One-active-Master constraint**, resolved as a partial unique index:
  `UNIQUE (member_id) WHERE is_master AND NOT is_archived`. An archived
  Master doesn't count, so retiring one doesn't require clearing its flag
  first.
- **Atomic Master swap**, resolved as `set_master_resume_version()`, a
  `SECURITY DEFINER` RPC issuing a single `UPDATE` statement
  (`SET is_master = (id = p_new_master_id) WHERE member_id = ... AND
  (is_master OR id = p_new_master_id)`) across every affected row of one
  member in one command — a partial unique index has no `DEFERRABLE`
  option in Postgres, so two separate UPDATE statements (clear old, set
  new) would violate it on the first statement; one statement computes
  every new tuple before the index is checked, so the swap never observes
  a transient two-Master or zero-Master state.
- **`resume_entries`** — per-version entry selection/override. References
  `member_profiles` array entries by kind-appropriate identity, resolved
  as a discriminator: `employment_history` entries carry a stable string
  `id` (backfilled by the pre-existing
  `ensureEmploymentEntryIdsForUser`), referenced via
  `employment_entry_id`; `education`/`certification`/`skill` entries have
  **no stable id today**, so those three kinds are referenced by
  `source_index` — the entry's position in its array when the row was
  created. A `CHECK` constraint enforces exactly one of the two identity
  columns is set, matching `entry_kind`. **This positional reference is a
  known, documented limitation**: editing or reordering
  `member_profiles.education` (etc.) after a `resume_entries` row exists
  can point it at the wrong entry. Acceptable now because no application
  code writes this table yet; must be revisited (most likely by giving
  those three arrays a stable id, mirroring the employment pattern)
  before any Phase 3 UI writes through it. No full array content is ever
  duplicated into this table — only `included` and an optional
  `override_description`, alongside the existing snapshot
  `original_description`.
- **`resume_field_proposals`** — one row per `ResumeFieldProposal`,
  flattening `destination` (kind + field, matching correction #2 — no
  separate `isCanonical` column), structured `provenance_*` columns
  (correction #3), `confidence`, and `status`/`decision`/`decided_at`
  (§7). References `source_document_id` (`member_documents`, required)
  and an optional `resume_version_id` (nullable — a proposal can be
  reviewed and applied to `member_profiles` before any resume version
  exists for the uploaded document).

RLS on both new tables mirrors `resume_versions`' existing
member-or-assigned-strategist policy shape.

---

## 9. What Was Deliberately Not Built This Phase

Visual Resume Builder/editor, templates, PDF rendering/export, DOCX
export, rendered ATS validation, an AI parser, AI rewriting, job-specific
tailoring, and — as stated throughout — no live Supabase migration. All
per the explicit instruction to stop after this foundation.

---

## 10. Testing Strategy (executed this phase)

TDD throughout: every extractor, section detector, field extractor, field
mapper, and the confirmation layer had its test written first (against
the not-yet-implemented module), then the implementation, then a green
re-run. `antiFabrication.test.ts` adds a cross-cutting, pipeline-level
proof suite on top of the per-module unit tests. See the implementation
report for exact counts, `tsc --noEmit` results, and full-repo regression
results.
