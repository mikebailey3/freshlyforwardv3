# ForwardOS Project 1 — Forward DNA Design Spec

## 1. Purpose

Forward DNA is a central "professional intelligence profile" for each
member — not a resume, not a form. It's the durable, structured
representation of who someone is professionally: their Career Compass
result, career history (with real scope/scale, not just titles and
dates), responsibilities, skills (with evidence, not just a word list),
education/credentials, and career goals — plus a transparent,
non-gamified completeness signal.

This is Project 1 of 3 in the ForwardOS initiative. Projects 2
(Career Vault + Capability Engine) and 3 (ForwardOS Home + Forward
Score) are separate, sequential, gated specs — not in scope here.
Non-negotiable rule carried from the parent brief: every ForwardOS
feature must either add to Forward DNA or use Forward DNA to produce a
better outcome. No chatbot, no generic AI assistant, no new
Opportunity Engine work happens in this project.

## 2. Existing-System Audit

| Existing capability | What it actually does | Disposition |
|---|---|---|
| `member_profiles` (employment_history, education, certifications, skills, career_goals, strengths, salary/remote/relocate fields) | Already holds ~90% of what Forward DNA needs as flat columns + jsonb arrays. | **CONNECT.** Read/display directly. No duplication into parallel tables. |
| `CareerProfilePage.tsx` / `ProfileEditForm.tsx` | The existing member-facing editor for all of the above. | **CONNECT + extend**, not replace. Forward DNA is a new page that reads the same data plus new tables; the existing edit flow keeps working. |
| `career_compass_assessments` / `career_compass_results` | Already-shipped archetype/readiness/recommendation data, RLS-scoped to `auth.uid()`. | **CONNECT.** Forward DNA surfaces the current result; no new storage. |
| `skills: string[]` on `member_profiles` | Flat list, no evidence or confidence state. | **UPGRADE**, via a new additive table (see Data Model). Old column stays untouched and readable by existing consumers (`freshFitScore.ts`, `CareerProfilePage`). |
| `search_readiness_score` / `calculateSearchReadiness()` / `SearchReadinessWidget` | Weighted-checklist profile-completeness score. Also wired into a DB trigger (`badge_system.sql`, awards "search-ready" badge at 100) and read directly by `AdminMemberDetailPage`, `StrategistMembersPage`, `StrategistMemberWorkspacePage`, `StrategistDashboardPage` via an `AdminMemberSummary` view recreated across 3 migrations. | **KEEP, untouched, for this project.** Forward DNA gets its own independent completeness score (section 6). Consolidating the two into one north-star score is an explicit, deferred follow-up ticket for after Project 3 (Forward Score), not part of this spec. Confirmed with user 2026-08-31. |
| `/achievement-vault` (badge display) | Membership + achievement badges. | **KEEP, unrelated.** Flagged only because Project 2's "Career Vault" name is adjacent; naming disambiguation is Project 2's concern, not this spec's. |
| `freshFitScore.ts` ("FreshFit") | A working, deterministic job-fit scorer already live in the Opportunity Engine, based on flat `member_profiles` fields. | **KEEP, out of scope.** Upgrading FreshFit to consume Forward DNA/Capability Engine data instead of flat fields is explicitly next-phase work per the parent brief. |
| Opportunities/applications/job_matches pipeline | Full existing Opportunity Engine. | **KEEP, do not touch.** |
| AI/LLM integration anywhere in `src/` | None exists. | Not needed for this project — Forward DNA is 100% deterministic, no AI calls. |
| Routing convention | Flat (`/profile`, `/roadmap`, `/achievement-vault`, `/career-compass`), not nested. | New route follows this convention: `/forward-dna`, not `/dashboard/forward-dna`. |
| Feature entitlements (`FeatureKey`, `useEntitlements`) | Plan-gated system already exists, used by `career_success_items` tools. | **Not used here.** Confirmed with user: Forward DNA is available to every member regardless of plan, no entitlement gate. |

**Conclusion:** Career Compass connection, Career History, Education,
Career Goals = CONNECT (read existing data as-is). Skills = UPGRADE
(new evidence table, old column untouched). Professional Scope and
Responsibilities = BUILD (genuinely new, nothing exists today).
Completeness score = BUILD, computed independently of the existing
Search Readiness score.

## 3. Architecture

```
src/pages/ForwardDnaPage.tsx                 - main page, section-based layout
src/components/forwardDna/CareerScopeCard.tsx
src/components/forwardDna/ResponsibilitiesCard.tsx
src/components/forwardDna/SkillEvidenceCard.tsx
src/components/forwardDna/CareerGoalsCard.tsx
src/components/forwardDna/CompassSummaryCard.tsx
src/components/forwardDna/CompletenessWidget.tsx
src/lib/forwardDna/scope.ts                  - career_scope CRUD
src/lib/forwardDna/responsibilities.ts       - career_responsibilities CRUD
src/lib/forwardDna/skills.ts                 - career_skills CRUD + backfill-from-flat-list
src/lib/forwardDna/completeness.ts           - pure, deterministic completeness scoring
src/lib/forwardDna/index.ts                  - typed barrel export
```

Follows the same pattern already established by `lib/careerCompass/`:
pure, unit-testable calculation modules; UI never reaches into
persistence internals directly; every new table gets a thin CRUD
wrapper rather than inline Supabase calls scattered through
components.

## 4. Data Model

One migration, following the existing phase-numbered convention.

**Change to `EmploymentEntry` shape (client-side type only, no schema
migration needed since it's jsonb):** add an optional `id` field.
Existing entries without one get a stable id generated client-side the
first time they're read or saved (idempotent — if an entry already has
an id, it's preserved). This gives Professional Scope and
Responsibilities something stable to reference without migrating
`employment_history` itself.

**`career_scope`** (new table)
- `id uuid pk`
- `user_id uuid not null references auth.users(id)`
- `employment_entry_id text not null` (the client-generated id above)
- `revenue_managed_cents bigint null`
- `team_size int null`
- `budget_managed_cents bigint null`
- `direct_reports int null`
- `notes text null`
- `created_at`, `updated_at`
- Unique constraint on `(user_id, employment_entry_id)` — one scope
  record per role.

**`career_responsibilities`** (new table)
- `id uuid pk`
- `user_id uuid not null references auth.users(id)`
- `employment_entry_id text not null`
- `tag text not null`
- `category text null`
- `created_at`

**`career_skills`** (new table)
- `id uuid pk`
- `user_id uuid not null references auth.users(id)`
- `skill_name text not null`
- `state text not null check (state in ('claimed','demonstrated','supported'))`
- `evidence_note text null`
- `created_at`, `updated_at`
- Unique constraint on `(user_id, skill_name)`.
- One-time client-side backfill: on first Forward DNA page load, any
  skill present in `member_profiles.skills` but absent from
  `career_skills` gets inserted at `state = 'claimed'`. The old
  `skills: string[]` column is left untouched and keeps working for
  existing consumers (`freshFitScore.ts`, `CareerProfilePage`).

**Two new optional columns on `member_profiles`:**
- `target_role text null`
- `target_timeframe text null`

(Existing `career_goals`, `strengths`, `weaknesses`, `motivators`,
`biggest_challenge` stay exactly as-is — additive only, no
restructuring of existing free-text fields.)

**RLS:** identical pattern to every other member-owned table in this
schema — `FOR ALL TO authenticated USING (user_id = auth.uid()) WITH
CHECK (user_id = auth.uid())` on all three new tables. No `anon`-role
policy on any of them (Forward DNA is a signed-in-only feature; no
anonymous-visitor use case like Career Compass has).

## 5. UX Flow / Page Layout

`/forward-dna`, a new member route (flat, `ProtectedRoute`-wrapped,
`MemberLayout` chrome — same convention as `/profile` and `/roadmap`).
Added as a new item in the member nav and as a card on the existing
dashboard (additive only — no dashboard redesign, that's Project 3).

Section order on the page:
1. **Career Compass Summary** — primary/secondary archetype, top
   barrier, link to full report. Read-only here, links out to
   `/career-compass/results` for the full existing experience.
2. **Career History** — reuses existing employment_history display
   pattern from `CareerProfilePage`, each entry expandable to show/add
   its Professional Scope and Responsibilities.
3. **Professional Scope** — per-role revenue/team-size/budget, editable
   inline under each employment entry.
4. **Responsibilities** — per-role tags, editable inline.
5. **Skills** — existing flat skill chips, each now with a
   claimed/demonstrated/supported toggle and optional evidence note.
6. **Education & Credentials** — pure read of existing `education[]` /
   `certifications[]`, no new UI beyond what `CareerProfilePage`
   already renders (link to edit there rather than duplicating the
   edit form).
7. **Career Goals** — existing free-text fields plus the two new
   `target_role`/`target_timeframe` fields.
8. **Completeness widget** — see section 6.

## 6. Completeness Scoring

New, independent function `calculateForwardDnaCompleteness()` in
`lib/forwardDna/completeness.ts`, structurally modeled on
`calculateSearchReadiness()` (weighted checklist → 0–100 → missing-item
list) but covering a different set of signals:

- Career Compass completed (weight)
- At least one employment entry has Professional Scope filled in
- At least one employment entry has Responsibilities tagged
- At least one skill has evidence beyond "claimed"
- Education/certifications present
- `target_role` + `target_timeframe` present

**Computed on-the-fly, not stored.** Nothing needs to filter or sort
members by this score server-side yet (no entitlement gate, no
strategist queue depends on it), so there's no trigger, no new column,
no migration risk here — pure function, called client-side same as
`calculateSearchReadiness` already is. If a future project needs this
queryable server-side, that's an additive follow-up, not a blocker now.

This is deliberately **separate** from `search_readiness_score`. Per
the audit (section 2) and user confirmation, consolidating the two
into a single north-star number is explicit deferred work, tracked as
a follow-up ticket after Project 3.

## 7. AI Usage

None. Every part of Forward DNA (display, scope/responsibility/skill
CRUD, completeness scoring) is deterministic, same as Career Compass's
scoring engines. No LLM calls anywhere in this project.

## 8. Risks / Accepted Trade-offs

1. **Two "profile completeness" scores will exist side-by-side for a
   while** (Search Readiness + Forward DNA completeness). Copy must
   keep them clearly distinct on the dashboard, same discipline already
   applied to "Search Readiness" vs. "Forward Readiness" in the Career
   Compass spec. This is accepted, not an oversight — consolidation is
   explicitly deferred.
2. **Two skill representations will exist side-by-side** (`skills:
   string[]` and `career_skills` table) until a future consolidation
   pass. `freshFitScore.ts` keeps reading the old flat list; it is not
   touched by this project.
3. **Client-generated `employment_entry_id` backfill** happens lazily
   (on first read/save) rather than via a one-time migration script.
   Acceptable since nothing depends on every entry having an id until a
   user actually adds Scope/Responsibilities to that specific entry.
4. **No admin/strategist visibility into Forward DNA in this project.**
   Strategists don't get a Forward DNA view in their member workspace
   yet — out of scope, flagged as a plausible future nice-to-have, not
   a Project 1 requirement.

## 9. Acceptance Criteria

- A member can view their Career Compass result summary on
  `/forward-dna` without retaking the assessment.
- A member can add Professional Scope (revenue/team size/budget) and
  Responsibility tags to any individual employment history entry, and
  the association survives a page reload.
- A member can mark any skill as claimed/demonstrated/supported with
  an optional evidence note; existing flat skill list still displays
  and still feeds `freshFitScore.ts` unchanged.
- Career Goals section shows existing free-text fields plus new
  target role/timeframe fields, editable and persisted.
- A completeness percentage displays, computed from the checklist in
  section 6, entirely independent of `search_readiness_score` (no
  shared code path, no shared column).
- `search_readiness_score`, its DB trigger, the "search-ready" badge,
  and every existing admin/strategist page that reads it are
  completely unmodified by this project.
- No new AI/LLM calls anywhere in this project's code.
- Route is `/forward-dna`, member-only, in nav + one dashboard card,
  no dashboard redesign.
