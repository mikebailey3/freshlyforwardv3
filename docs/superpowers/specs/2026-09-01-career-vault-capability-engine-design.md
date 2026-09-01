# ForwardOS Project 2 — Career Vault + Capability Engine + Forward DNA Evidence Integration — Design Spec

**Status: DESIGN ONLY. Not approved. No migration written. No production code changed.**

## 0. Product Principle (restated, unchanged)

Career Win → Structured Evidence → Capability Suggestions → Member
Confirmation → Forward DNA. Forward DNA remains the one central career
profile. Career Vault is its evidence/memory layer, not a competitor to
it.

---

## 1. Existing System Audit

| Existing capability | What it actually does | Disposition |
|---|---|---|
| `career_skills` table + `SkillState` (`claimed\|demonstrated\|supported`) (`src/lib/forwardDna/skills.ts`, `src/types/forwardDna.ts`) | Exactly the tri-state evidence model the spec describes. Already has an `evidence_note text` column (free text, no structure, no link back to a source event). | **CONNECT + UPGRADE.** This *is* the capability model. No new taxonomy. New: a structured evidence relationship replacing/augmenting the flat `evidence_note`. |
| `scoreSkillEvidence()` in `src/lib/forwardDna/matching.ts` | Already reads `career_skills.state` and gives FreshFit bonus points, weighted `claimed=0.5, demonstrated=0.8, supported=1.0`. | **CONNECT, zero changes needed.** The moment Career Vault upgrades a skill's `state`, FreshFit scoring improves automatically. This is the existing, live proof that "evidence strengthens Forward DNA" already works end-to-end for one consumer. |
| `calculateForwardDnaCompleteness()` (`src/lib/forwardDna/completeness.ts`) | One of its 6 weighted checks is `hasSkillEvidenceBeyondClaimed` — true the moment *any* skill's state moves off `claimed`, for *any* reason. | **CONNECT, zero changes needed.** A confirmed Career Win capability trips this exact existing flag. See §12 for why no *new* Career-Vault-specific completeness signal is proposed. |
| `EmploymentEntry.id` (client-generated, backfilled by `src/lib/forwardDna/employmentEntryIds.ts`) | Stable per-role id used by `career_scope` / `career_responsibilities` to reference a jsonb array element that can't hold a real FK. | **CONNECT.** Career Wins reuse the identical `employment_entry_id text` (nullable) pattern — no new backfill mechanism needed, the existing one already runs on every Forward DNA page load. |
| `career_scope`, `career_responsibilities` CRUD modules (`src/lib/forwardDna/scope.ts`, `responsibilities.ts`) | Thin, unit-tested, DI-friendly (`client: SupabaseClient = defaultClient`) CRUD wrappers, one per table, no inline Supabase calls in components. | **CONNECT as the architectural template.** Career Vault's own CRUD modules (`careerWins.ts`, `capabilities.ts`) follow this exact shape. |
| `ForwardDnaPage.tsx` + `components/forwardDna/*Card.tsx` | Section-based member page; each card owns one concern (scope, responsibilities, skills, goals) and calls a CRUD module. `SkillEvidenceCard.tsx` already renders per-skill state as a 3-way toggle. | **CONNECT.** Career Vault gets its own new page/route (see §2), but a new `CareerVaultTeaserCard` (or an expanded `SkillEvidenceCard`) surfaces on `/forward-dna` linking out — same non-invasive pattern the Career Compass summary card uses today. |
| `member_profiles.search_readiness_score`, `calculateSearchReadiness()` (`src/lib/profile.ts`), `badge_system.sql` trigger (awards "search-ready" at 100), `AdminMemberSummary` view (defined/recreated in `20260818020000`, `20260820000000`, `20260822000000`) | Independent weighted-checklist score over a **fixed, enumerated** list of `member_profiles` columns (full_name, phone, location, headline, summary, employment_history, education, skills, preferred_jobs, preferred_industries, salary_min, remote_preference, schedule_preference, work_style, career_goals, strengths, motivators, application_authorized, electronic_consent). Read directly by `CareerProfilePage`, `AdminMemberDetailPage`, `StrategistMemberWorkspacePage`, `StrategistDashboardPage`, `StrategistMembersPage`. | **KEEP, completely untouched.** Career Vault introduces zero new `member_profiles` columns and never calls `calculateSearchReadiness`. See §13 for the exhaustive dependency list and how each is protected. |
| `career_notes` table (`20260802180911_phase4_operational_engine.sql`) | Strategist-**authored** notes about a member (`strategist_id` writes, `note text`, `category`, `is_pinned`). | **KEEP, unrelated.** Opposite authorship direction from Career Vault (member writes about themself). Flag only to avoid naming/mental-model confusion — do not merge or rename either system. |
| `/achievement-vault` route + membership/achievement badge display (`Badges.tsx`) | Gamification badges (membership tier, milestones). Unrelated data model. | **KEEP, unrelated.** Flagged only because "Career Vault" is adjacent-sounding to "Achievement Vault." Recommend the nav label/route stay unambiguous — see §16 naming risk. |
| Strategist/admin cross-member READ RLS pattern (`resume_versions`, `cover_letters`, `opportunities`, `career_notes`, `linkedin_profiles` — all in `20260802180911_phase4_operational_engine.sql` and `20260823000000_linkedin_optimizer.sql`) | Identical 3-way `USING` clause everywhere: `auth.uid() = member_id OR auth.uid() IN (SELECT strategist_id FROM strategist_assignments WHERE member_id = <table>.member_id AND is_active = true) OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`. | **CONNECT, reuse verbatim** (translated to this schema family's `user_id` column name) for Career Vault's SELECT-only strategist/admin policy. No INSERT/UPDATE/DELETE grant to strategist/admin — that's what makes it read-only. |
| `StrategistMemberWorkspacePage.tsx` `TabKey` union + tab bar | Existing tabbed member-detail UI: Snapshot, Opportunities, Applications, Resumes, Cover Letters, Career Notes, Follow-ups, Messages, Timeline. | **CONNECT.** Add one new tab (`'career_vault'`) reading the same `memberId` route param already in scope. No new page, no new route. |
| `AdminMemberDetailPage.tsx` | Single-page, section-based (not tabbed): Account Status, Subscription, Career Profile. | **CONNECT (optional/secondary).** A read-only "Career Vault" `<section>` could be added here too, same visual pattern as the existing "Career Profile" section. Lower priority than the strategist workspace tab — this page is admin/account-focused, not career-work-focused. |
| `useEntitlements()` / `FeatureKey` / `ProtectedRoute`'s `feature`/`requiredPlan` props | Opt-in, per-feature plan gating. Forward DNA registers **no** `FeatureKey` and is available to every member regardless of plan (confirmed precedent). | **CONNECT (by omission).** Career Vault's route follows the exact same precedent: no `feature` prop, no `requiredPlan` prop. Free for every authenticated member, per the locked decision. |
| `WizardShell.tsx` | Full multi-step assessment chrome (sticky progress bar, step indicators, back/next) — built for Career Compass/Onboarding's 10+ question flows. | **NOT reused for capture.** Too heavy for a sub-1-minute, single-field capture. See §2/§5 — Career Vault's capture flow uses the lighter "modal with progressive disclosure" pattern instead (see next row). |
| `SubmitJobModal.tsx` / `AddCalendarEventModal.tsx` | Existing "single-purpose modal" pattern: fixed-inset overlay, bordered inputs, disabled-until-valid submit, `ModalActions`-style buttons, mobile-friendly. | **CONNECT as the architectural template** for `AddCareerWinModal.tsx` — same shape, same conventions, same a11y baseline. |
| `parseScopeSignals()` regexes in `matching.ts` (`TEAM_SIZE_RE`, `DIRECT_REPORTS_RE`, `BUDGET_RE`) | Working, deterministic dollar/count extraction from free text (job descriptions). | **CONNECT as prior art / reference implementation**, not literally imported (different input register — JD text vs. first-person member statements — so patterns differ slightly), but the "regex-extract, never infer" *technique* is the direct precedent for the Career Win interpreter's metric extraction. Genuinely shared logic (e.g. a `parseCurrency` helper) is called out as an optional DRY follow-up in §16, not required for v1. |
| Any AI/LLM integration anywhere in `src/` | None exists. | Confirmed absent — no accidental double-build risk. V1 stays 100% deterministic per the locked decision. |
| `career_success_items` / feature entitlements | Existing plan-gated career tools. | **KEEP, unrelated.** Not reused, not touched — cited only as the existing precedent for *how* something in this app would be plan-gated, which Career Vault deliberately opts out of. |

**Conclusion:** Skills/capabilities = **UPGRADE** an existing table (add a
relationship, not a new taxonomy). Evidence/provenance, deterministic
interpretation, capability suggestion = **BUILD** (genuinely nothing
exists today). Strategist visibility, RLS pattern, CRUD architecture,
mobile modal pattern = **CONNECT** to things that already exist almost
exactly as needed. Nothing needs to be **REPLACED**.

---

## 2. Final Architecture

```
                     ┌─────────────────────┐
                     │   Career Compass     │  (personality/archetype fit)
                     └──────────┬───────────┘
                                │ read-only summary
┌───────────────┐      ┌────────▼────────┐      ┌──────────────────┐
│  Career Goals  │─────▶│   Forward DNA    │◀─────│  career_skills    │
│ (target_role,  │      │ (the one central │      │ (claimed/demo/   │
│  timeframe)    │      │  career profile) │      │  supported)      │
└───────────────┘      └────────▲────────┘      └────────▲─────────┘
                                │                          │ upgrade on
                                │ strengthens               │ confirm
                     ┌──────────┴───────────┐      ┌────────┴─────────┐
                     │   Career Vault        │─────▶│ Capability Engine │
                     │ (career_wins = the    │ infer│ (deterministic,  │
                     │  member's memory of   │      │  pure, swappable)│
                     │  what they did)       │      └──────────────────┘
                     └───────────────────────┘
                                │
                                │ read-only
                     ┌──────────▼───────────┐
                     │ Strategist Workspace  │  (existing tab-based page)
                     └───────────────────────┘

Untouched, parallel, independent:
  Search Readiness (member_profiles.search_readiness_score) — different
  purpose (application-readiness checklist), different consumers
  (strategist queue thresholds, badge trigger), zero shared code path.
```

Relationship rules this design enforces:

- **Forward DNA does not gain new top-level sections for Career Vault
  data.** It gains *stronger existing signals* — `career_skills.state`
  transitions are the only channel through which Career Vault affects
  Forward DNA. There is no `career_wins` column or section rendered
  inside `ForwardDnaPage.tsx` beyond a small teaser/link card.
- **Career Vault is additive plumbing, not a second profile.** It has
  its own route/page (members go there deliberately to log evidence),
  but everything it *produces* (confirmed capabilities) flows into the
  one table Forward DNA and FreshFit already read.
- **Capability Engine is a pure library, not a page.** It has no UI,
  no route, no table of its own beyond the join table in §4. It is
  called by the Career Vault capture flow and returns data; it never
  writes to the database itself (the calling code decides what to
  persist, same separation `careerCompass`'s scoring engines already
  use).

---

## 3. Existing Data Structures To Reuse

| Structure | Location | How Career Vault reuses it |
|---|---|---|
| `career_skills` table + RLS policy | `20260831000000_forward_dna.sql` | Target of capability confirmation writes. No schema change to this table itself. |
| `SkillState` type, `getSkillStates`, `upsertSkillState` | `src/types/forwardDna.ts`, `src/lib/forwardDna/skills.ts` | Called directly by the new confirmation-writing function — no duplicate skill-state logic. |
| `employment_entry_id` client-id pattern | `src/lib/forwardDna/employmentEntryIds.ts` | Career Wins optionally tag an `employment_entry_id`; the existing lazy-backfill already guarantees ids exist once a member visits Forward DNA or Career Vault. |
| RLS 3-way strategist/admin SELECT clause | `20260802180911_phase4_operational_engine.sql`, `20260823000000_linkedin_optimizer.sql` | Copied verbatim (column name adjusted) for `career_wins` / `career_win_capabilities` SELECT policy. |
| `strategist_assignments` table | `20260802180911_phase4_operational_engine.sql` | Referenced by the RLS policy above — not modified. |
| `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` admin-check idiom | Used throughout `supabase/migrations/*` | Same idiom, no new "is admin" function needed. |
| DI-friendly CRUD module pattern (`client: SupabaseClient = defaultClient`) | `src/lib/forwardDna/*.ts`, `src/lib/opportunityEngine.ts` | Every new Career Vault module follows this exactly, for the same reason: unit-testable without a real Supabase connection. |
| `MemberLayout`, `StrategistLayout`, `ProtectedRoute` | `src/components/` | Career Vault's member page uses `MemberLayout` + `ProtectedRoute` with no `feature`/`requiredPlan` prop, same as `/forward-dna`. |
| `AddCalendarEventModal.tsx` / `SubmitJobModal.tsx` structural pattern | `src/components/` | Template for `AddCareerWinModal.tsx` — fixed overlay, bordered inputs, disabled-until-valid submit. |
| `UserRole` (`'member' \| 'strategist' \| 'admin'`), `useAuth()` | `src/context/AuthContext.tsx` | No changes. Read `role`/`profile` exactly as every other page does. |
| `StrategistMemberWorkspacePage.tsx` `TabKey` union | `src/pages/strategist/StrategistMemberWorkspacePage.tsx` | Extended with one new tab value; no restructuring of the page. |
| `calculateForwardDnaCompleteness()` input shape | `src/lib/forwardDna/completeness.ts` | Read-only reference — confirms the existing `hasSkillEvidenceBeyondClaimed` flag already covers Career Vault's contribution (§12). No signature change proposed. |

No existing table's **columns** change. No existing table is renamed. No
existing RLS policy is dropped or rewritten.

---

## 4. New Data Structures Required

Two new tables. That's it — everything else is a reuse or a pure
TypeScript module with no persistence of its own.

### 4.1 `career_wins`

The durable, verbatim record of what the member said happened. This is
the "USER-PROVIDED FACT" layer.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | Follows the Forward DNA sibling tables' naming (`user_id`, not `member_id`) since this family is a direct extension of that schema. |
| `employment_entry_id` | `text null` | Same client-generated id used by `career_scope`/`career_responsibilities`. **Nullable** — a Career Win doesn't have to be tied to one specific role (e.g. cross-role achievements, or a member with no employment history entered yet). |
| `original_statement` | `text not null` | Verbatim, immutable member input. Never rewritten by any downstream process. This is the one field every future feature (resume generation, interview prep) must be able to trust as ground truth. |
| `evidence_type` | `text not null default 'accomplishment'` | **Deliberately not a DB `CHECK` enum.** Enforced as a TypeScript union at the application layer instead, so adding a new evidence type later (the spec explicitly warns against over-narrowing to "wins" only) never requires a migration. Starting set: `accomplishment \| project \| process_improvement \| promotion \| recognition \| certification \| leadership \| problem_solved \| other`. |
| `category` | `text null` | System-inferred, human-readable (e.g. "Financial / Operational Impact"). Nullable — inference may not always produce one. |
| `metric_type` | `text null` | `'currency' \| 'percentage' \| 'count' \| null` — inferred, app-level union, not a DB enum, same rationale as `evidence_type`. |
| `metric_value` | `numeric null` | Parsed numeric value (e.g. `31000`). Never present unless `metric_raw` is also present — enforced at the application layer, not a DB constraint (see §6 anti-fabrication design). |
| `metric_raw` | `text null` | The exact matched substring from `original_statement` (e.g. `"$31,000"`). Exists so the UI/strategist view can show *why* the system extracted that number — explainability, not just a bare figure. |
| `created_at`, `updated_at` | `timestamptz` | Standard trigger, same as `career_skills`. |

No `confirmation_state` column on this table. The Career Win itself is
a trusted, member-authored fact the instant it's saved — like any other
free-text profile field. Confirmation only gates the *capability*
relationship (next table), never the existence of the win record
itself. This keeps provenance clean: a member can have Career Wins with
zero confirmed capabilities, and that's a completely valid, common
state, not an error condition.

### 4.2 `career_win_capabilities`

The single evidence-relationship table. Serves as **both** "suggestion"
and "confirmed evidence" — same row, different `status` — per the
instruction to prefer relationships over duplicated tables. This is the
"SYSTEM INTERPRETATION" + "USER-CONFIRMED INTERPRETATION" layer.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `career_win_id` | `uuid not null references career_wins(id) on delete cascade` | |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | Denormalized (same pattern as `career_scope`/`career_responsibilities` carrying `user_id` alongside a text reference) — keeps RLS a single-column check instead of a subquery join, and makes "all of a member's confirmed capabilities" a one-table query. |
| `skill_name` | `text not null` | Matches `career_skills.skill_name` exactly (same free-text space, no separate taxonomy — see §7). |
| `suggested_state` | `text not null check (suggested_state in ('demonstrated','supported'))` | What state this evidence supports. Never `'claimed'` — evidence can only ever argue *up* from claimed, never re-assert the base state. |
| `source` | `text not null check (source in ('system','member'))` | Distinguishes a deterministic-interpreter suggestion from a capability the member manually added themselves (the spec's "member can... potentially add another applicable capability"). |
| `inference_reason` | `text null` | Short, deterministic, human-readable explanation (e.g. `"Statement mentions a dollar-value reduction in inventory loss"`). Always present when `source = 'system'`; always `null` when `source = 'member'` (there's no inference to explain). |
| `status` | `text not null default 'pending' check (status in ('pending','confirmed','rejected'))` | See §8 for exactly when each value is written. In the v1 mobile flow (§5), only `'confirmed'` rows are ever actually persisted — `'pending'`/`'rejected'` exist in the schema for forward-compatibility with a possible future async/strategist-proposed confirmation flow, not exercised by v1 UI. |
| `decided_at` | `timestamptz null` | Set when `status` moves out of `'pending'`. |
| `created_at` | `timestamptz not null default now()` | |

Unique constraint: `(career_win_id, skill_name)` — a single Career Win
can't suggest the same capability twice.

**RLS (both tables, identical shape, reusing §3's pattern):**

```
-- member: full CRUD on their own rows
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())

-- strategist/admin: SELECT only, no INSERT/UPDATE/DELETE grant
USING (
  auth.uid() = user_id
  OR auth.uid() IN (
    SELECT strategist_id FROM strategist_assignments
    WHERE strategist_assignments.member_id = career_wins.user_id
    AND strategist_assignments.is_active = true
  )
  OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
)
```

No `anon`-role policy on either table — signed-in-only feature, same
as every other Forward DNA table.

**What is explicitly NOT a new table**, per "prefer relationships over
copying information into multiple tables":

- No separate `capability_suggestions` table distinct from
  `career_win_capabilities` — one table, `status` column distinguishes
  suggested vs. confirmed.
- No separate `career_evidence` table — `career_wins` *is* the
  evidence; `career_win_capabilities` *is* the evidence-to-skill
  relationship. Nothing else needs to reference "evidence" generically
  in v1.
- No new capability/skill taxonomy table (§7).

---

## 5. Career Win Data Flow

Full lifecycle, mapped to concrete modules:

1. **Member opens `AddCareerWinModal`** from a "+ Add Career Win" button
   on the new `/career-vault` page (and optionally a shortcut on
   `/dashboard` and `/forward-dna`, matching how Opportunity Engine's
   "Submit a Job" button pattern already works).
2. **Screen 1 — "What happened?"**: one textarea, autofocus, single
   "Continue" CTA. No metric fields, no category picker, nothing that
   feels like a resume form. This is the entire mobile-critical path;
   everything below happens client-side, instantly, with no network
   round trip yet.
3. **On Continue (client-side only):**
   `DeterministicCareerWinInterpreter.interpret(statement)` runs
   (pure, synchronous under the hood, `Promise`-wrapped per §6) and
   returns a structured, **never-saved-yet** result: `{ metricType,
   metricValue, metricRaw, category }`.
   `inferCapabilities(interpretedResult, statement)` (the Capability
   Engine) runs next, returning
   `{ skillName, suggestedState, reason }[]` — zero, one, or several
   suggestions, each traceable to the exact rule that produced it.
4. **Screen 2 — Review** (same modal, no page navigation):
   - Original statement shown read-only (proves nothing was silently
     changed).
   - Any detected metric shown as a small, editable/removable chip
     (member can strike it out if the extraction is wrong — this never
     rewrites `original_statement`, only whether `metric_value` gets
     persisted at all).
   - Capability suggestions shown as pre-checked checkboxes, per the
     spec's own mock:
     `[] Inventory Management  [] Financial Performance  [] Problem Solving  [] Operational Execution`
   - A free-text "add another capability" affordance for member-added
     ones (`source = 'member'`, no `inference_reason`).
   - Optional employment-entry picker, defaulting to "not tied to a
     specific role."
5. **Member taps Save.** One write sequence:
   a. Insert `career_wins` row (`original_statement`, any *kept*
      metric/category fields, `employment_entry_id` if chosen).
   b. For every **checked** capability: insert `career_win_capabilities`
      row with `status = 'confirmed'`, `decided_at = now()`.
      Unchecked suggestions are simply never persisted (v1 keeps this
      one-shot — no draft/pending state to manage later).
   c. For each confirmed row, call the existing `upsertSkillState()`:
      - No existing `career_skills` row for that `skill_name` → insert
        at `state = suggested_state`.
      - Existing row at a **lower** state → upgrade to
        `suggested_state`.
      - Existing row already at an **equal or higher** state → leave
        `career_skills.state` untouched, but the
        `career_win_capabilities` row is still saved (it's still valid
        evidence for the "why ForwardOS believes this" view, even if it
        didn't change the number).
6. **Forward DNA is now stronger** with zero additional writes to any
   Forward DNA table: `scoreSkillEvidence()` and
   `calculateForwardDnaCompleteness()` both read `career_skills.state`
   directly and pick up the change the next time either runs.
7. **Strategist/admin** can see the resulting `career_wins` +
   `career_win_capabilities` rows read-only via the new workspace tab
   (§11) — no separate write path exists for them.

---

## 6. Deterministic Inference Design

**Location:** `src/lib/careerVault/interpreter.ts`

```ts
export interface InterpretedCareerWin {
  metricType: 'currency' | 'percentage' | 'count' | null
  metricValue: number | null
  metricRaw: string | null   // exact matched substring, or null
  category: string | null
}

export interface CareerWinInterpreter {
  interpret(statement: string): Promise<InterpretedCareerWin>
}
```

- **`Promise`-returning from day one**, even though v1's implementation
  resolves synchronously (`return Promise.resolve(result)`). This is
  the one deliberate concession to the future: a hypothetical
  `AICareerWinInterpreter` will need to make a network call, and
  changing a sync interface to async later would be a breaking change
  to every caller. Designing it async now costs nothing today and
  avoids that rewrite entirely.
- **`DeterministicCareerWinInterpreter`** (v1, `src/lib/careerVault/deterministicInterpreter.ts`)
  implements `CareerWinInterpreter` with pure regex/keyword matching —
  no I/O, fully unit-testable, same testing shape as
  `lib/careerCompass/*Engine.ts` and `lib/forwardDna/matching.ts`.
- **A future `AICareerWinInterpreter`** (not built now, not stubbed,
  just designed-for) would implement the identical interface, live in
  the same directory, and be swapped in at the single call site that
  currently instantiates `DeterministicCareerWinInterpreter` — no
  change to `career_wins`, `career_win_capabilities`, the confirmation
  flow, the UI, or strategist views. This is the entire point of the
  interface boundary: AI becomes a drop-in alternative implementation,
  never a foundation the rest of the system depends on.
- **Anti-fabrication is enforced by construction, not by a separate
  validation pass:** every field the interpreter returns must be a
  direct, literal regex match against `original_statement`. There is no
  step anywhere that computes, estimates, or infers a number/date/scale
  that isn't a substring of the input. `metricValue` is only ever
  non-null when `metricRaw` is also a literal substring of the
  statement. This is a hard architectural rule for the interpreter
  module, verified by the anti-fabrication test suite in §14.
- **Capability inference is a separate, sibling module**
  (`src/lib/careerVault/capabilityEngine.ts`), not part of the
  interpreter — single-responsibility separation:
  - The interpreter's job: extract *structure* (numbers, category) from
    text.
  - The capability engine's job: map *structure + raw text* to
    *suggested capabilities*, via a small, explicit, data-driven rule
    table (`{ pattern: RegExp, skillName: string, reason: string }[]`),
    not a giant scattered if/else across components. One centralized
    module, unit-tested independently of the interpreter.
  - A capability suggestion is a *plausibility claim* ("this statement
    may demonstrate X"), which is allowed to fire on category-level
    keyword presence alone (e.g. the word "inventory" is enough to
    *suggest* "Inventory Management") — that's categorically different
    from fabricating a *fact* (a number, date, or scale that wasn't
    written). The member's confirmation step is exactly what makes that
    distinction safe.

---

## 7. Capability Model — Recommendation

**Reuse and extend `career_skills`. Do not introduce a separate
capability taxonomy.**

Rationale, directly from the audit:

1. `career_skills.skill_name` is already a free-text column with no
   rigid taxonomy today — "Inventory Management," "People Development,"
   "Succession Planning" are all just valid values already, with zero
   schema change.
2. `career_skills.state` already **is** the exact
   claimed→demonstrated→supported machine the spec's own example uses,
   with zero new enum values required.
3. `scoreSkillEvidence()` (FreshFit) and
   `calculateForwardDnaCompleteness()` already consume this exact
   table/column — confirming a suggestion automatically strengthens two
   systems that already exist, for free.
4. The one genuine gap — no structured link from a skill's state back
   to *why* it's at that state — is closed by the new
   `career_win_capabilities` join table (§4.2), not by a new taxonomy.

A separate capability taxonomy would create exactly the
duplicate-profile risk this project is explicitly forbidden from
creating (§ Non-Negotiables): two overlapping "what can this person do"
systems that could drift out of sync. Reuse is both the simplest and
the lowest-risk answer.

**Open decision requiring your explicit approval before implementation**
(flagged rather than silently decided, per instructions):

- **What distinguishes `demonstrated` from `supported`?** Today's
  codebase defines the three states by name and by FreshFit weight
  (0.5 / 0.8 / 1.0) but never documents the semantic difference between
  the top two. This design's default recommendation: Career Win
  evidence confirmation upgrades a skill to **`demonstrated`** only.
  Reaching `supported` stays a deliberate, separate member action (or a
  future rule, e.g. "2+ independent confirmed Career Wins," or
  strategist sign-off) — **not** decided or built in v1. If you'd
  rather a single strong Career Win be able to suggest `supported`
  directly, say so and this design will be revised before
  implementation.
- **Does a brand-new capability (no existing `career_skills` row at
  all) get created at `demonstrated` on first confirmation**, skipping
  `claimed` entirely? This design assumes yes — the evidence itself
  *is* the demonstration, there's no separate unproven "claim" to make
  first. Flagging because the spec's own worked example only covers the
  *upgrade* case (existing `claimed` → `demonstrated`), not the
  brand-new-capability case.

---

## 8. Confirmation Flow

**Before confirmation exists:**
- `career_wins` row is already saved (member-authored fact, trusted on
  arrival).
- Capability suggestions exist only in memory, client-side, as the
  Capability Engine's return value — **nothing is written to
  `career_win_capabilities` or `career_skills` yet.**
- The UI presents them as checkboxes, framed as "This win **may
  demonstrate**," not as facts.

**The confirmation action itself:** in the v1 fast-mobile flow, ticking
a checkbox *is* the confirmation — there is no separate "suggest now,
confirm later" round trip, to keep the whole flow inside the ~1-minute
target. Tapping the modal's single "Save" button is the one moment
serialization happens.

**After confirmation:**
- One `career_win_capabilities` row per checked suggestion, `status =
  'confirmed'`, `decided_at = now()`.
- `upsertSkillState()` called for each — upgrading `career_skills.state`
  only if the confirmed state is *higher* than what's currently stored
  (never a downgrade, never silent).
- Unchecked suggestions are simply not persisted — no
  `career_skills` write, no `career_win_capabilities` row. (Schema
  supports persisting them as `status = 'rejected'` for a future
  richer flow, but v1 doesn't need that data yet, so it isn't written —
  avoiding speculative rows nobody reads.)
- **Nothing about Forward DNA's stored data changes for an unconfirmed
  suggestion.** A member can add ten Career Wins and confirm zero
  capabilities; Forward DNA is byte-for-byte unaffected by the wins
  themselves, only by what's confirmed.

---

## 9. Evidence / Provenance Model

Four questions, four unambiguous answers, all derivable from one join:

| Question | Where the answer lives |
|---|---|
| WHO supplied the information? | Always the member — `career_wins.user_id`. Career Vault has no strategist-write path (§11). |
| WHAT did the member actually say? | `career_wins.original_statement` — verbatim, immutable, never overwritten by inference. |
| WHAT did the system infer? | `career_wins.{metric_type, metric_value, metric_raw, category}` (interpreter output) plus every `career_win_capabilities` row where `source = 'system'`, each with its own `inference_reason`. |
| WHAT did the member confirm? | `career_win_capabilities` rows where `status = 'confirmed'` — regardless of `source` (a member-added capability is still something the member explicitly asserted by adding it, functionally "confirmed" from the moment it's created). |
| WHAT Forward DNA conclusion is supported by that evidence? | `career_skills` row matching `career_win_capabilities.skill_name` for that `user_id` — its current `state` is the conclusion; every `career_win_capabilities` row pointing at it (joined back through `career_win_id` to `career_wins.original_statement`) is the full "why" trail, exactly matching the spec's worked "Why ForwardOS believes this" example. |

This is a pure read — a "why" view for a given skill is:

```sql
SELECT cw.original_statement, cwc.inference_reason, cwc.source
FROM career_win_capabilities cwc
JOIN career_wins cw ON cw.id = cwc.career_win_id
WHERE cwc.user_id = :user_id
  AND cwc.skill_name = :skill_name
  AND cwc.status = 'confirmed'
ORDER BY cwc.decided_at ASC;
```

No new column, no denormalization, no materialized view needed for
this in v1 — it's a cheap indexed join (`career_win_capabilities` is
indexed on `(user_id, skill_name)`, see §10 migration notes).

Per the spec's own instruction ("if a simple evidence view naturally
fits the existing Forward DNA UI, include it; don't build a massive
analytics screen"): this design proposes exactly one small addition —
an expandable "Evidence" disclosure inside the existing
`SkillEvidenceCard.tsx`, per skill, rendering the query above. No new
page, no new route for this specifically.

---

## 10. Forward DNA Integration

Career Vault strengthens Forward DNA through exactly **one** channel:
`career_skills.state` transitions. It never writes to `career_scope`,
`career_responsibilities`, `member_profiles`, or any other Forward DNA
table, and it never renders a competing "profile" view — its own page
is explicitly about capturing and reviewing evidence, not about
presenting "who this member is" (that remains Forward DNA's job).

Concretely, nothing changes in `ForwardDnaPage.tsx`'s data model. The
only proposed addition there is presentational: a small card/link
inviting the member to Career Vault (mirroring how `CompassSummaryCard`
already links out to the full Career Compass results page rather than
re-rendering it), plus the optional per-skill "Evidence" disclosure
inside `SkillEvidenceCard.tsx` described in §9.

---

## 11. Strategist / Admin Integration

**Primary:** one new tab in `StrategistMemberWorkspacePage.tsx`.

```ts
type TabKey = 'snapshot' | 'opportunities' | 'applications' | 'resumes'
  | 'cover_letters' | 'notes' | 'follow_ups' | 'messages' | 'timeline'
  | 'career_vault'   // new
```

Renders a read-only list of that member's `career_wins` (with their
confirmed `career_win_capabilities`), fetched with the same
`memberId` route param the page already loads its profile with. No
edit affordance anywhere on this tab — the RLS policy (§4) makes
write attempts fail server-side regardless, but the UI simply never
renders an edit control, consistent with "READ-ONLY unless an existing
permission architecture makes editing trivial and clearly appropriate"
(it doesn't here — Career Vault is explicitly member-voice evidence,
a strategist editing it would corrupt the provenance model in §9).

**Secondary (optional, lower priority):** a matching read-only
`<section>` in `AdminMemberDetailPage.tsx`, visually consistent with
its existing "Career Profile" section. Not required for v1 — the
strategist workspace tab is the primary, richer surface and covers the
stated requirement on its own.

**Explicitly not built:** any separate strategist-facing Career Vault
app, editing UI, resume-generation, job-matching, interview-prep, or
coaching tooling referencing Career Vault data. All flagged by the spec
itself as *future* applications, not v1 scope.

---

## 12. Search Readiness Protection

Every dependency found during the audit, and how this design avoids
touching each one:

| Dependency | File(s) | Protection |
|---|---|---|
| `search_readiness_score` column | `member_profiles` (`20260802172349_phase3_membership_system.sql`) | No new migration touches `member_profiles` at all. Career Vault introduces zero columns on this table. |
| `calculateSearchReadiness()` | `src/lib/profile.ts` | Not called anywhere in Career Vault code. Its fixed `readinessChecks` array is not read, imported, or extended. |
| "search-ready" badge trigger | `20260818010000_badge_system.sql` (fires at `search_readiness_score >= 100`) | Untouched — no migration in this project alters this trigger or the column it watches. |
| `AdminMemberSummary` view | Defined/recreated across `20260818020000`, `20260820000000`, `20260822000000` | Not recreated, not extended. This project adds no columns to it. |
| Consumers: `CareerProfilePage.tsx`, `AdminMemberDetailPage.tsx`, `StrategistDashboardPage.tsx`, `StrategistMembersPage.tsx`, `SearchReadinessWidget.tsx`, `StrategistMemberWorkspacePage.tsx` | `src/pages/*`, `src/components/SearchReadinessWidget.tsx` | None of these files' Search Readiness code paths are edited. `StrategistMemberWorkspacePage.tsx` is touched (§11), but only to add a new, independent tab — its existing `calculateSearchReadiness(profile)` call and Snapshot tab are untouched. |
| Forward DNA's own separate completeness score | `src/lib/forwardDna/completeness.ts` | Already explicitly independent of Search Readiness (confirmed in the Project 1 spec, §2/§6 there). This project doesn't merge them, doesn't add a Career-Vault-specific new completeness signal (§ below), and doesn't change the weighting of the existing `hasSkillEvidenceBeyondClaimed` check. |

**Forward DNA completeness note (per explicit instruction not to make
completeness scale with quantity):** this design proposes **no new**
completeness checkbox for "member has added a Career Win." The existing
`hasSkillEvidenceBeyondClaimed` check already responds correctly to a
*confirmed* capability (quality-gated: it only trips once a skill's
state changes, not once evidence merely exists) with zero code change.
A separate, quantity-based signal ("has ≥1 Career Win") is explicitly
**not** proposed, and is called out here as intentionally deferred
work, not an oversight, per the instruction: "if doing so requires
meaningful changes, defer it and document the recommendation."

---

## 13. Files Expected to Change

**New files:**
```
src/types/careerVault.ts                              - CareerWin, CareerWinCapability, EvidenceType, MetricType
src/lib/careerVault/interpreter.ts                     - CareerWinInterpreter interface + InterpretedCareerWin type
src/lib/careerVault/deterministicInterpreter.ts        - DeterministicCareerWinInterpreter (v1 impl)
src/lib/careerVault/deterministicInterpreter.test.ts
src/lib/careerVault/capabilityEngine.ts                - inferCapabilities(): pure rule-table matcher
src/lib/careerVault/capabilityEngine.test.ts
src/lib/careerVault/careerWins.ts                      - CRUD: createCareerWin, getCareerWinsForUser, deleteCareerWin
src/lib/careerVault/careerWins.test.ts
src/lib/careerVault/capabilities.ts                    - confirmCapabilities() -> writes career_win_capabilities + upserts career_skills
src/lib/careerVault/capabilities.test.ts
src/lib/careerVault/index.ts                           - typed barrel export
src/components/careerVault/AddCareerWinModal.tsx       - "What happened?" -> review -> save
src/components/careerVault/AddCareerWinModal.test.tsx
src/components/careerVault/CareerWinCard.tsx           - single win, its confirmed capabilities, evidence trail
src/components/careerVault/CareerWinCard.test.tsx
src/components/careerVault/CareerVaultTeaserCard.tsx   - small link-out card for /forward-dna and /dashboard
src/pages/CareerVaultPage.tsx                          - member's own list + "+ Add Career Win"
src/pages/CareerVaultPage.test.tsx
src/pages/strategist/StrategistCareerVaultTab.tsx      - read-only tab content (or inlined in the workspace page, TBD at implementation time)
supabase/migrations/2026090X000000_career_vault.sql    - NOT WRITTEN YET, described only (§14)
```

**Existing files modified (all additive):**
```
src/App.tsx (or wherever routes are declared)          - add /career-vault route, member-only, no feature gate
src/components/MemberLayout.tsx                        - add nav item (matches how /forward-dna was added)
src/pages/strategist/StrategistMemberWorkspacePage.tsx - add 'career_vault' to TabKey union + tab bar + panel
src/pages/ForwardDnaPage.tsx                            - render CareerVaultTeaserCard (one new line, no restructuring)
src/components/forwardDna/SkillEvidenceCard.tsx         - optional: per-skill "Evidence" disclosure (§9)
src/pages/DashboardPage.tsx                             - optional: dashboard card/CTA, same non-invasive pattern as the existing Forward DNA teaser
```

**Confirmed NOT touched by this project (exhaustive, matches §12):**
`src/lib/profile.ts`, `src/components/SearchReadinessWidget.tsx`,
`src/pages/CareerProfilePage.tsx` (except by nothing — not touched),
`src/pages/strategist/AdminMemberDetailPage.tsx` (unless the optional
§11 secondary section is approved separately), any
`supabase/migrations/*badge_system*` or `*admin_member_management*`
file, `src/lib/forwardDna/matching.ts`, `src/lib/freshFitScore.ts`.

---

## 14. Migration Strategy (description only — not written)

One new, purely additive migration file,
`supabase/migrations/2026090X000000_career_vault.sql`, following the
exact structural convention of `20260831000000_forward_dna.sql`:

- `CREATE TABLE IF NOT EXISTS career_wins (...)`
- `CREATE TABLE IF NOT EXISTS career_win_capabilities (...)`
- Indexes: `(user_id)` on both tables; `(user_id, skill_name)` on
  `career_win_capabilities` for the evidence-view query in §9;
  `(career_win_id)` for cascade lookups.
- `ALTER ... ENABLE ROW LEVEL SECURITY` + the policies from §4 on both
  tables.
- `updated_at` trigger on `career_wins` only (`career_win_capabilities`
  rows are immutable once decided — a rejected/superseded suggestion
  gets a new row, not an update, preserving history; only
  `career_wins.updated_at` needs the standard trigger, e.g. if a member
  edits their own kept metric chip before saving — TBD at
  implementation time whether editing after save is in scope at all, or
  whether `career_wins` is create/delete only in v1, see §17).
- No `ALTER` of any existing table. No `DROP` of anything.

**Rollback:** since this is purely additive with no existing-table
changes, rollback is `DROP TABLE career_win_capabilities; DROP TABLE
career_wins;` (in that FK-respecting order) with no data loss to any
*other* system — the only data at risk is Career Vault's own, which is
the expected blast radius for reverting a purely-additive feature.
No existing table's data, trigger, or view is ever in a state that
needs repairing after rollback.

**Risk of drift with `career_skills`:** since `career_skills` rows can
also be edited directly and independently on `/forward-dna` (the
existing `SkillEvidenceCard` 3-way toggle), a member could manually set
a skill to `demonstrated` with no Career Vault evidence at all, or
manually downgrade a skill Career Vault upgraded. This is **existing,
accepted behavior** already true of `career_skills` today (nothing
about Career Vault makes this worse) — flagged here only so it's a
known, not-newly-introduced trade-off, not something this project needs
to solve.

---

## 15. Testing Strategy

**Unit — deterministic interpreter (`deterministicInterpreter.test.ts`):**
- Extracts a currency metric from `"I reduced inventory loss by $31,000."` → `metricType: 'currency', metricValue: 31000, metricRaw: '$31,000'`.
- Extracts a percentage, a plain count, each independently.
- Returns all-null fields for a statement with no detectable metric.
- Category inference maps known keyword clusters to a category label.

**Unit — anti-fabrication (explicit, required per instructions):**
- INPUT `"I improved inventory."` → `metricValue === null`, `metricType === null`, `metricRaw === null`. Category/capability suggestions, if any, must be traceable only to literal words present in the input.
- INPUT with a dollar amount but no percentage → `metricType !== 'percentage'`, no percentage-shaped value invented.
- Never returns a `metricValue` without a corresponding literal `metricRaw` substring of `original_statement` — a property-style test asserting this invariant across a table of inputs.
- Explicitly asserts the four named invalid outputs from the spec never occur for `"I improved inventory."`: no fabricated dollar figure, no fabricated percentage, no fabricated team size, no fabricated timeframe.

**Unit — capability engine (`capabilityEngine.test.ts`):**
- `"Reduced inventory loss by $31,000"` → includes `Inventory Management`, `Financial Performance`, each with a non-empty `reason`.
- `"Developed three associates who were later promoted into leadership"` → includes `People Development`, `Coaching`/`Leadership`.
- A statement matching zero rules → empty suggestion array (not an error).

**Unit — CRUD modules (`careerWins.test.ts`, `capabilities.test.ts`)**, using the same fake-Supabase-client harness pattern already established in `opportunityEngine.test.ts`:
- `createCareerWin` persists `original_statement` unchanged.
- `confirmCapabilities` inserts one `career_win_capabilities` row per confirmed suggestion with `status='confirmed'`.
- `confirmCapabilities` calls `upsertSkillState` with the higher state when the existing skill is lower.
- `confirmCapabilities` does **not** call `upsertSkillState` down when the existing skill state is already equal/higher — but still writes the `career_win_capabilities` row.
- Ownership: a CRUD call for `user_id: A` never reads/writes rows for `user_id: B` (mirrors existing Forward DNA CRUD test conventions).

**Component:**
- `AddCareerWinModal`: Save button disabled until the statement field is non-empty; capability checkboxes default checked; unchecking then saving does not include that capability in the persisted set (assert against the fake client's calls, same pattern as `SubmitJobModal.test.tsx`).
- `StrategistCareerVaultTab` (or wherever the read-only tab renders): renders Career Wins with no edit/delete affordance visible, regardless of viewer role.

**Authorization / RLS (documented as required manual/staging verification, consistent with the existing pattern flagged in the Job Discovery Hardening project — no live Supabase in this sandbox):**
- A member cannot SELECT another member's `career_wins`/`career_win_capabilities` rows.
- An unassigned strategist (no active `strategist_assignments` row for that member) cannot SELECT that member's rows.
- An assigned, active strategist CAN SELECT but an INSERT/UPDATE/DELETE attempt from that strategist's session fails.
- An admin (JWT `app_metadata.role = 'admin'`) CAN SELECT any member's rows but an INSERT/UPDATE/DELETE attempt fails (read-only holds even for admin, per the locked decision).

**Regression protection for Search Readiness:**
- A snapshot/characterization test asserting `calculateSearchReadiness()`'s `readinessChecks` array is byte-for-byte unchanged (field list + weights) after this project lands.
- A test confirming `career_wins`/`career_win_capabilities` tables are never referenced anywhere in `src/lib/profile.ts`.

**Mobile-critical flow:**
- A component-level test asserting the modal reaches its "Save" state from a single textarea entry with no required additional fields (i.e. the fast path genuinely requires only one input to complete).

---

## 16. Risks / Conflicts

| Risk | Assessment / Mitigation |
|---|---|
| **Duplicate data risk** | Low. No member-facing fact is stored in two places — `original_statement` lives only in `career_wins`; skill state lives only in `career_skills` (Career Vault upgrades it, never shadows it). |
| **Migration risk** | Low. Purely additive, two new tables, no existing table altered — same risk profile as the already-shipped `20260831000000_forward_dna.sql` and `20260901000000_member_submitted_jobs.sql`. Real residual risk: like every migration in this project's history, it has never been run against a live/staging Postgres from this sandbox (no Supabase CLI/DB access) — flagged as a required pre-deploy manual verification step, consistent with prior projects. |
| **Permission risk** | Medium-low. The 3-way RLS clause is copy-proven elsewhere in this codebase, but every new copy of it is a new opportunity for a typo (e.g. checking the wrong column name) to silently over- or under-grant access — mitigated by the explicit RLS test list in §15, run against staging before production use. |
| **Search Readiness regression risk** | Very low. Zero shared columns, zero shared functions, one shared *file* touched (`StrategistMemberWorkspacePage.tsx`) but only to add an independent tab. Mitigated further by the explicit regression test in §15. |
| **Capability taxonomy risk** | Low, by design choice (§7) — reusing `career_skills`' existing free-text space means there's no separate taxonomy to drift out of sync. Residual risk: without any normalization, two members (or the same member at different times) could record slightly different strings for the same real-world capability (`"Inventory Mgmt"` vs `"Inventory Management"`) — an existing risk already true of `career_skills` today, not introduced by this project. Not proposed to be solved in v1 (would require fuzzy-matching or a controlled vocabulary, explicitly deferred per §17). |
| **Heuristic false-positive risk** | Medium — inherent to any keyword-based capability inference. Mitigated structurally by the confirmation gate itself (§8): a false-positive suggestion is just an unchecked box, never a silent write. The real residual risk is *false negatives* (a genuinely strong Career Win that the deterministic engine doesn't recognize) — acceptable for v1 given the explicit "member can add another applicable capability" escape hatch, and the clearly-designed future AI-interpreter path for improving recall later. |
| **Mobile UX risk** | Low-medium. The single-textarea-first design is the right shape, but real-world review-screen density (metric chip + several checkboxes + optional role picker) needs an actual on-device check before shipping, same as every other UI project in this repo's history — flagged for the polish pass, not a structural risk. |
| **Future AI migration risk** | Low, by design — the `Promise`-returning interface (§6) is specifically chosen to absorb this. Residual risk: an AI interpreter would need its own error/timeout/rate-limit handling that a synchronous deterministic function never needs — noted as a concern for whenever that future work actually happens, not solvable in this design. |
| **Naming confusion risk** | Low but worth a conscious decision: "Career Vault" vs. the existing "Achievement Vault" (`/achievement-vault`, badges) are unrelated systems with adjacent names. Recommend keeping both names as-is but making sure nav copy/ordering doesn't place them next to each other in a way that implies a relationship — a copy/IA decision for the polish pass, not a schema decision. |

---

## 17. Scope Check — Explicitly NOT Built in v1

Per the spec's own instructions to avoid premature complexity, the
following are recognized as future/adjacent work and are **not**
part of this design's v1 scope:

- Any AI/LLM-backed interpreter — the interface exists, the
  implementation doesn't.
- Editing a `career_wins` row's `original_statement` after save (v1 is
  create + delete only; the trigger in §14 is a placeholder for a
  possible future edit flow, not a commitment to build one now).
- Persisting `'rejected'`/`'pending'` `career_win_capabilities` rows in
  the v1 UI flow (schema supports it; the fast mobile flow doesn't use
  it).
- Fuzzy-matching or normalizing `skill_name` strings across members
  (capability taxonomy risk, §16).
- Any dedicated Career-Vault-specific Forward DNA completeness signal
  (§12) — deferred, documented, not built.
- Consolidating Search Readiness and Forward DNA completeness into one
  score — out of scope for this project entirely (was already deferred
  by Project 1, restated here for continuity).
- A dedicated "Why ForwardOS believes this" analytics screen beyond the
  small in-place evidence disclosure in §9.
- Strategist editing, collaborative Career Vault management, or any
  strategist write path to `career_wins`/`career_win_capabilities`.
- Resume generation, interview prep, career path, Forward Score, or
  FreshFit changes that *consume* Career Vault data beyond the existing
  `career_skills.state` channel — explicitly named as future systems
  this design prepares for but does not build.
- A separate strategist-facing Career Vault application of any kind.
- Any new `FeatureKey`/entitlement gate — Career Vault is free for
  every authenticated member, full stop.

---

## 18. Implementation Sequence (recommended, post-approval)

Mirrors the task-group structure already used successfully for the
Forward DNA and Job Discovery Hardening projects — small, TDD'd,
independently-reviewable commits:

1. **Types + migration.** `src/types/careerVault.ts`, then the
   migration file itself (§14) — written and reviewed, but the two new
   open decisions in §7 must be resolved *before* this step, since they
   affect the `career_win_capabilities.suggested_state` semantics.
2. **Deterministic interpreter**, TDD, including the full
   anti-fabrication test suite (§15) before any capability-engine work
   starts — this is the highest-risk-of-getting-wrong piece and should
   be hardened first, in isolation.
3. **Capability engine**, TDD, as a sibling module consuming the
   interpreter's output type.
4. **CRUD modules** (`careerWins.ts`, `capabilities.ts`), TDD, using the
   fake-client harness pattern, including the state-upgrade-never-
   downgrade logic.
5. **`AddCareerWinModal` + `CareerVaultPage`**, TDD, wired to the real
   modules — this is the first point real, manual, mobile-viewport
   verification happens.
6. **Strategist read-only tab**, TDD, reusing the workspace page's
   existing data-loading pattern.
7. **Forward DNA teaser card + optional evidence disclosure** in
   `SkillEvidenceCard.tsx` — last, since it's the lowest-risk, purely
   additive presentational piece.
8. **Full regression pass**: entire existing suite green, `tsc` clean,
   explicit Search Readiness regression test (§15) green, RLS
   verification checklist run against staging before this branch is
   considered mergeable to production.

Each step follows this repo's established convention: red test, green
implementation, commit, then an independent code-review pass before
moving to the next step — same discipline as every prior ForwardOS
project.

---

## 19. Open Decisions Requiring Your Approval Before Implementation

1. **`demonstrated` vs. `supported` semantics** (§7) — does Career Win
   evidence ever suggest `supported` directly, or always cap at
   `demonstrated`?
2. **Brand-new capability creation** (§7) — does confirming a
   suggestion for a skill with no existing `career_skills` row create
   it at `demonstrated` (this design's assumption), or should
   first-time capabilities always start at `claimed` regardless of
   evidence?
3. Anything in §17's scope-check list you'd actually like pulled into
   v1 instead of deferred.

Everything else in this document is a concrete recommendation, not an
open question — but flagging these three explicitly rather than
guessing, per your instruction not to silently invent product
decisions.
