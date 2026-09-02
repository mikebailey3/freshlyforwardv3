# ForwardOS Project 3 — ForwardOS Home + Forward Score — Design Spec

**Status: Design APPROVED 2026-09-01. Final requirements (visual
direction, terminology, Next Best Move design, explainability
enforcement) LOCKED in §10. No migration written, no schema applied,
no implementation code changed. Companion implementation plan:
`docs/superpowers/plans/2026-09-01-forwardos-home-forward-score.md`,
awaiting your approval before any coding begins.**

Branch: `forwardos-home-forward-score`, cut from `main` @ `76b86cb`.
Deliberately not based on, and does not merge, the unmerged
`career-vault-capability-engine` branch.

Revision note: this replaces the initial draft. Two substantive
changes came out of your review, both reflected throughout this
document, not just patched in one spot:
1. Search Readiness is no longer a weighted pillar at all (was
   "Profile Readiness" at 30% in the draft) — it's now excluded from
   the Forward Score calculation entirely, per your instruction.
2. Goal Alignment / Direction went through the required data-richness
   audit (§3.1) before being locked — the audit changed *what data
   grounds it*, not whether it exists as a pillar.

---

## 0. Product Principle (inherited, unchanged)

Same non-negotiable rule as Projects 1 and 2: every ForwardOS feature
must either add to Forward DNA or use Forward DNA to produce a better
outcome. Forward Score is a *consumer* of existing signals, not a new
source of truth.

Forward Score answers a specifically different question than Search
Readiness, and the two must never be conflated in code, copy, or UI:

| Metric | Question it answers |
|---|---|
| Search Readiness | "Does FreshlyForward have what it needs to effectively help this member conduct a job search?" (operational — can we act on their behalf right now) |
| Forward Score | "How strong, evidenced, active, and directionally prepared is this member's current career position, based on the information ForwardOS has?" (a snapshot of the member's own position, not of our operational readiness to help them) |

## 1. Existing-System Audit

| Existing capability | What it actually does | Disposition |
|---|---|---|
| `DashboardPage.tsx` (`/dashboard`) | Current member home: Search Readiness card, Applications/Interviews/Messages cards, strategist CTA, tips, upcoming events, "Recommended for You", "Your Progress This Week", Career Compass card, Forward DNA card, Forward Feed, Quick Access Tools. | **UPGRADE IN PLACE.** No new page, no new route. |
| `calculateSearchReadiness()` + `member_profiles.search_readiness_score` + badge trigger + admin/strategist reads | Independent weighted-checklist score. | **UNTOUCHED. NOT a Forward Score input.** Locked per §8 — this is a change from the initial draft, where it was proposed as a 30%-weighted pillar. It is now excluded entirely from the calculation, displayed only as its own secondary card (§4). |
| `calculateForwardDnaCompleteness()` | Independent weighted-checklist score (Compass completion, scope, responsibilities, skill evidence, education, target role/timeframe presence). | **CONNECT, read-only.** Input to the Forward DNA Depth pillar, unchanged in substance from the initial draft. |
| `career_skills` table (tri-state evidence) | Live evidence-quality signal, already merged (Project 1), already consumed by FreshFit and Forward DNA completeness. | **CONNECT.** Input to Evidence Quality pillar (weight increased 20% → 30% per your instruction — evidence-backed capability is the core differentiator). |
| `applications`, `mock_interviews`, `calendar_events` | Real activity data, already read by `DashboardPage.tsx`. | **CONNECT, read-only.** Input to Career Momentum pillar. |
| `member_profiles.career_goals` / `target_role` / `target_timeframe` / `strengths` / `motivators` / `biggest_challenge` | Free-text, optional fields. `target_role`+`target_timeframe` presence is *already* one of Forward DNA Depth's six binary checks. | **AUDITED, NOT used as Goal Alignment's basis.** See §3.1 — this data is too thin/unstructured to score honestly beyond presence, and that presence check is already counted elsewhere. Using it again here would both double-count and invent false precision. |
| `career_compass_results.readiness_scores` (jsonb: `careerDirection`, `resumePositioning`, `searchStrategy`, `applicationResults`, `interviewConfidence`, each 0–100) + `primary_barrier`/`secondary_barrier` | **Newly surfaced by this audit.** A real, structured, deterministic 5-dimension readiness questionnaire (`readinessEngine.ts`), already live, already persisted per-user (`readiness_scores jsonb NOT NULL`, confirmed in the migration), already RLS-scoped, currently used only to drive plan recommendations (`recommendationEngine.ts`) — **no other ForwardOS score reads it today.** | **CONNECT.** This is the resolution to §3.1 — `readiness_scores.careerDirection` becomes Goal Alignment / Direction's actual basis, in place of the free-text fields. |
| Career Vault (`career_wins`, `career_win_capabilities`) | Unmerged. Upgrades `career_skills.state`, introduces no score of its own. | **DO NOT DUPLICATE OR REIMPLEMENT.** Unchanged from the initial draft — see §2. |
| Achievement Vault / badges, FreshFit, AI/LLM anywhere in `src/` | Unrelated / out of scope / absent, respectively. | **KEEP, unrelated / out of scope / stays absent.** Unchanged from the initial draft. |

## 2. The Career Vault Dependency — Unchanged, Reconfirmed Under the New Weights

Still resolved the same way as the initial draft: Evidence Quality
reads `career_skills` (merged in Project 1), never `career_wins` or
`career_win_capabilities`. Raising this pillar's weight from 20% to
30% doesn't change *what* it reads, only how much it counts — the
dependency boundary is identical. Once Career Vault merges, the same
`career_skills` input gets richer automatically, with zero Forward
Score code changes.

## 3. Forward Score — Locked Pillars (v1)

| Pillar | Weight | Source | Computation |
|---|---|---|---|
| Forward DNA Depth | 25% | `calculateForwardDnaCompleteness(...).score` | Used directly, 0–100. |
| Evidence Quality | **30%** (highest — evidenced capability is a core ForwardOS differentiator, per your instruction) | `career_skills` rows for the member | See below. |
| Career Momentum | 20% | `applications`, `mock_interviews`, `calendar_events` | Weighted checklist, see below. |
| Goal Alignment / Direction | 25% | `career_compass_results.readiness_scores.careerDirection` | See §3.1. |

**Evidence Quality (30%) — exact computation.** Reuses the same
per-state weighting `scoreSkillEvidence()` already established in
`forwardDna/matching.ts` (`claimed = 0.5, demonstrated = 0.8, supported
= 1.0`) rather than inventing new arbitrary weights — one weighting
scheme for "how good is this evidence" across the whole app, not two.
Score = average weight across all of the member's tracked skills,
scaled to 0–100. Deliberately **read-only reconciled, not written**:
any skill present in the flat `member_profiles.skills[]` array but not
yet present in `career_skills` (i.e., the member has never opened
Forward DNA, so the lazy backfill in `syncSkillsFromProfile` hasn't run
yet) is treated as an implicit `claimed` for scoring purposes only —
this avoids unfairly zeroing out a member's Evidence Quality just
because they haven't visited a different page yet, without writing any
row anywhere as a side effect of computing a score. Zero skills of any
kind → 0.

**Career Momentum (20%) — exact computation.** A weighted checklist
(same shape as every other ForwardOS score), summing to 100 before
the 20% weight is applied:
- Has at least one active (non-rejected/closed/offer-accepted)
  application — 30
- Submitted at least one application in the last 30 days — 25
- Has an upcoming or recently-completed interview (real or mock) — 25
- Has read/responded to strategist messages (not sitting on unread) — 20

**Goal Alignment / Direction (25%) — see §3.1 for the audit that
produced this.** `career_compass_results.readiness_scores.careerDirection`
where `is_current = true`, used directly (already 0–100, no rescaling
needed). No current result → 0, with the explanation "Take the Career
Compass assessment" and a link to `/career-compass`. If
`primary_barrier` or `secondary_barrier` on that result equals
`'careerDirection'`, that fact is surfaced as explanatory context (not
an additional scoring factor) — "your own assessment flagged career
direction as a current barrier."

### 3.1 Goal Alignment / Direction — Data Richness Audit (performed before locking, per your instruction)

**Question asked:** does the existing Career Goals data
(`member_profiles.career_goals`, `target_role`, `target_timeframe`,
`strengths`, `motivators`) support a meaningful, honest, deterministic
score — or would scoring it invent precision that isn't there?

**Finding: no, for these specific fields.** Three problems, not one:
1. They're free text, optional, with no structure to score beyond
   presence/absence — a longer or more articulate `career_goals` entry
   isn't measurably "more aligned" than a short one without inventing
   a judgment call this codebase's own anti-fabrication discipline
   (established emphatically in the Career Vault spec) explicitly
   avoids everywhere else.
2. `target_role` + `target_timeframe` presence is **already** one of
   `calculateForwardDnaCompleteness()`'s six checks. Scoring it again
   here — even dressed up with keyword-overlap logic against skills or
   employment history — would double-count the same signal under two
   different names and inflate two pillars off one underlying fact.
3. Building a keyword-similarity heuristic between free-text goals and
   skills (the same *technique* `freshFitScore.ts` uses for job
   descriptions) would apply that technique to a fundamentally
   different, softer question — "is this person's stated goal aligned
   with their evidence" is a real judgment call, not a text-overlap
   fact, and is exactly the kind of invented precision you told me to
   avoid.

**Stronger candidate found instead:** `career_compass_results
.readiness_scores.careerDirection` — a real, structured, 0–100
dimension score produced by a dedicated questionnaire item
(`rf_career_direction`) already live in Career Compass's readiness
engine, already persisted per-user, already deterministic, never
currently read by anything outside the Career Compass plan-
recommendation flow.

**Why this isn't the same double-counting problem as the free-text
option:** Forward DNA Depth's Career-Compass-related check is
presence-only (`hasCareerCompassResult`, true/false — did they
complete the assessment at all). This pillar uses a *different,
graduated facet* of the same underlying source — the specific
direction sub-score, not "did they finish the quiz." That is the exact
same pattern already used and self-reviewed for Evidence Quality
(which reads `career_skills.state` distribution, a different facet
than Forward DNA Depth's own presence-only
`hasSkillEvidenceBeyondClaimed` check on the same table). One
precedent, applied consistently in two places — not two different
rules.

**Conclusion:** Goal Alignment / Direction stays a real pillar in v1,
grounded in `readiness_scores.careerDirection` instead of the
originally-assumed free-text fields. This is the "audit before
finalizing" your instruction required — the pillar survived the audit,
but its data source changed as a direct result of it.

## 4. ForwardOS Home — Architecture & Naming (Locked)

```
src/pages/DashboardPage.tsx                          - UPGRADED in place, not replaced
src/components/forwardScore/ForwardScoreWidget.tsx   - new hero widget
src/lib/forwardScore/score.ts                        - pure, deterministic composite function
src/lib/forwardScore/score.test.ts                   - unit tests, TDD
src/lib/forwardScore/index.ts                        - typed barrel export
```

- **"ForwardOS Home" is the user-facing name**, replacing "Dashboard"
  in the page heading and member nav label.
- **Route stays `/dashboard`.** No new route, no redirect scaffolding,
  no second page — per your instruction, existing URLs stay unless
  changing them is required, and it isn't. `DashboardPage.tsx` as a
  filename can stay too (renaming the file is a pure-refactor, zero-
  behavior-change task with no urgency; flagging it as optional
  cleanup, not doing it as part of this design).
- **Forward Score is the primary hero metric** — a new, prominent
  widget near the top of the page.
- **Search Readiness becomes a secondary operational card**, exactly
  as it displays today, just no longer implied to feed the hero number
  (it never did, structurally — this is a framing/positioning change,
  not a data change).
- **Proposed contextual-prominence rule** (this specific trigger
  condition wasn't dictated, so proposing one rather than guessing
  silently): Search Readiness's card gets a visually elevated
  treatment when the member has at least one active application or an
  upcoming interview — i.e., exactly the same two signals already
  computed for Career Momentum's checklist (§3), reused for a UI
  decision, not a second calculation. Rationale: that's the moment
  "does FreshlyForward have what it needs to help this search" stops
  being a hypothetical and starts being operationally live. Open for
  your adjustment — this is a UI heuristic, not a locked data
  contract.

## 5. Explainability & Framing Requirements (Locked)

**Hard requirement, enforced in copy review before ship:** Forward
Score must never be presented, in any UI copy, tooltip, or marketing
material, as:
- a measure of human worth
- a hiring probability
- a guaranteed salary indicator
- an employer-facing score
- an objective judgment of someone's career

**Design consequence:** `computeForwardScore()` returns a structured
breakdown, not just a number — mirroring the shape every prior
ForwardOS score already uses (`calculateSearchReadiness` returns
`missing`; `calculateForwardDnaCompleteness` returns `missing`;
`computeFreshFitScore` returns `breakdown`). Proposed shape:

```ts
interface ForwardScorePillarResult {
  key: 'forwardDnaDepth' | 'evidenceQuality' | 'careerMomentum' | 'goalAlignment'
  label: string
  score: number        // 0-100, this pillar only
  weight: number        // 0-1
  explanation: string   // what data produced this number, in plain language
  improvementLink: { label: string; to: string } | null
}

interface ForwardScoreResult {
  total: number          // 0-100, weighted composite
  pillars: ForwardScorePillarResult[]
}
```

Every pillar ships with a one-line "why" and, where applicable, a
one-line "what would help" link — same discipline as Search
Readiness's existing "Let's fix it" deep link
(`getReadinessFixLink`). Recommended header microcopy for the widget
itself: *"Forward Score reflects what ForwardOS can see in your
profile today — a snapshot to help you see where to focus next, not a
judgment."* (exact wording is a copy-review detail, not locking the
literal sentence — locking the *requirement* that some equivalent
disclaimer exists near the number).

## 6. Explicit Non-Goals (Locked)

- No AI/LLM anywhere.
- No score-history table, no trigger, no scheduled job, no persistence
  of Forward Score anywhere — computed on-the-fly on every read, same
  as its three predecessor scores. Historical tracking is explicitly
  deferred to a future project, after the v1 scoring model has been
  validated in production.
- No changes to `calculateSearchReadiness()`, its stored column, its
  badge trigger, any admin/strategist consumer, any database view, or
  any threshold. Zero lines of that code path touched.
- No changes to `calculateForwardDnaCompleteness()`.
- No new database migration of any kind — every input already exists
  in an already-queryable shape.
- No Career Vault schema, types, or queries referenced.
- No new plan/entitlement gating.
- No strategist/admin-facing Forward Score view in v1.
- No second dashboard route/page created to achieve the name change.

## 7. Draft Acceptance Criteria

- ForwardOS Home displays a single Forward Score (0–100) as the
  primary hero metric, computed live from exactly four pillars:
  Forward DNA Depth (25%), Evidence Quality (30%), Career Momentum
  (20%), Goal Alignment / Direction (25%).
- Search Readiness's score, badge trigger, and every admin/strategist
  consumer remain byte-for-byte unmodified, and Search Readiness is
  never read anywhere inside `computeForwardScore()` — enforced the
  same way Task 12 locked the Search Readiness field list: a cheap
  regression test asserting `forwardScore/score.ts` never imports
  `calculateSearchReadiness` or touches `search_readiness_score`.
- A second, equivalent regression test asserts `forwardScore/` never
  imports anything from a `careerVault` module or references
  `career_wins`/`career_win_capabilities`.
- Every pillar result includes a plain-language explanation and, where
  applicable, a link to the page that would improve it.
- No UI copy anywhere describes Forward Score using any of the five
  banned framings in §5.
- No new database migration exists anywhere in this project's diff.
- `tsc --noEmit` clean, full existing suite green, new module has its
  own unit tests (TDD) before being wired into ForwardOS Home.
- Route remains `/dashboard`; only the user-facing heading/nav label
  changes to "ForwardOS Home."

## 8. Locked Decisions Record (2026-09-01)

All decisions below are binding for v1, superseding the initial
draft's open questions:

1. **Search Readiness is excluded from the Forward Score calculation
   entirely.** It is not a weighted pillar, not a partial input, not
   referenced anywhere in `computeForwardScore()`. It remains its own
   metric, displayed as a secondary operational card on ForwardOS
   Home, answering a deliberately different question (§0).
2. **Four locked pillars and weights:** Forward DNA Depth 25%,
   Evidence Quality 30%, Career Momentum 20%, Goal Alignment /
   Direction 25%. Evidence Quality carries the highest weight because
   demonstrated, evidence-backed capability is a core ForwardOS
   differentiator.
3. **Goal Alignment / Direction is grounded in
   `career_compass_results.readiness_scores.careerDirection`**, not
   the free-text Career Goals fields — resolved by the audit in §3.1,
   performed before locking, as instructed.
4. **Deterministic, computed-on-the-fly for v1.** No score-history
   table, no database trigger, no scheduled calculation, no
   persistence of any kind. Historical tracking is explicit deferred
   future work, contingent on the v1 model being validated first.
5. **Zero modification** to `search_readiness_score`, its calculation,
   its badge trigger, any admin/strategist consumer, any database
   view, or any threshold.
6. **"ForwardOS Home" is the user-facing name**, replacing "Dashboard"
   in the UI. The existing `/dashboard` route and `DashboardPage.tsx`
   file are not renamed or duplicated to achieve this — upgrade in
   place.
7. **Search Readiness displays as a secondary operational card**, not
   part of the Forward Score calculation, with a proposed (not
   dictated, open to adjustment) contextual-prominence rule tied to
   active-application/interview signals already computed for Career
   Momentum.
8. **Forward Score must remain transparent and directional**, never
   framed as human worth, hiring probability, salary guarantee,
   employer score, or objective career judgment. Every pillar carries
   a plain-language explanation and, where applicable, an
   improvement link — enforced structurally via the
   `ForwardScoreResult`/`ForwardScorePillarResult` shape in §5, not
   left to be added later as an afterthought.

No further open decisions remain in this spec. Implementation planning
proceeds only after your approval of this document.

## 9. Consistency Self-Review (performed 2026-09-01, post-lock)

Performed before treating this revision as final, checking every place
the locked decisions could have left a stale or contradictory
statement elsewhere in the document — same discipline the Career Vault
spec applied in its own §20:

- **§1 audit table, Search Readiness row** — updated from "CONNECT,
  read-only" (initial draft's proposed pillar role) to "UNTOUCHED, NOT
  a Forward Score input" — confirmed no other section still calls it
  a "pillar" or "input" anywhere; §3's pillar table has exactly four
  rows, none of them Search Readiness.
- **§2 Career Vault Dependency** — re-checked against the new Evidence
  Quality weight (20% → 30%): the section describes *what table* is
  read, not how much it counts, so the weight change requires no
  wording change here. Confirmed no stale "20%" reference remains
  anywhere in the document (checked §1, §2, §3, §7, §8 — all now say
  30% or don't mention a number).
- **§3.1 vs. §1's audit table** — confirmed the `member_profiles`
  free-text row in §1 and the full audit in §3.1 tell the same story
  (thin data, already double-counted, stronger alternative found) at
  two levels of detail rather than contradicting each other.
- **Naming-collision risk, newly noticed during this self-review and
  worth flagging explicitly rather than silently fixing in copy
  later:** this app now has three different things with "readiness"
  in the name or concept — `search_readiness_score` (Search
  Readiness), Career Compass's internal `readinessEngine.ts` /
  `ReadinessResult` (job-search barrier readiness), and Forward
  Score's own product question is readiness-adjacent even though the
  metric itself isn't called that. None of these get renamed by this
  spec — but whoever writes ForwardOS Home's actual UI copy should be
  aware all three exist so a member never reads two different
  "readiness" numbers on one page and reasonably assumes they're the
  same thing. Flagging this the same way both prior specs flagged the
  Career-Vault-vs-Achievement-Vault naming risk: not fixed here,
  explicitly not silently ignored either.
- **§4 architecture block** — confirmed unchanged from the initial
  draft's module list; the pillar-definition changes in §3 don't
  require any new file, since Career Momentum, Evidence Quality, and
  Goal Alignment all read tables/columns the page-level data-fetching
  layer already touches today (`DashboardPage.tsx` for applications/
  interviews, `career_skills` reads already precedented in Forward
  DNA, and a new one-table read for `career_compass_results
  .readiness_scores` alongside the existing `career_compass_results`
  read `DashboardPage.tsx` already performs for its Career Compass
  card).
- **§6 Non-Goals** — re-verified "no new database migration" is
  actually true under the final pillar set: Forward DNA Depth,
  Evidence Quality, and Career Momentum were already migration-free in
  the initial draft; Goal Alignment's new basis
  (`readiness_scores.careerDirection`) is a column that already
  exists (confirmed directly against
  `20260830000000_career_compass_assessment_system.sql`), not a new
  one — so the "no migration" claim still holds under the revised
  design, not just the original one.

## 10. Final Locked Requirements (2026-09-01, second round)

Approved alongside sign-off on §8. These refine, not replace, the §8
decisions — no pillar, weight, or non-goal changed here.

**Visual direction.** Deep navy + focused green, premium/clean/high-
trust, restrained shadows, rounded cards, generous whitespace —
confirmed **not a new visual language**: `--navy: #071a31`,
`--green: #078a58` (identical hex to `--color-primary-600`),
`--shadow`, `--radius: 22px` already exist in `src/index.css` and are
already used elsewhere in this app (marketing pages, the Concierge
Editorial Dashboard pass). No new color tokens are introduced. Desktop
sidebar nav and mobile bottom nav are **already built** in
`MemberLayout.tsx` — ForwardOS Home renders inside that existing
shell, unchanged. Where the mockup implies data or a component this
branch doesn't have (Career Vault content, chiefly), the graceful-
degradation rule wins over visual fidelity — see the implementation
plan's Task 7 for the specific placeholder design (a muted "coming
soon" tile, zero queries against any Career-Vault-shaped table, no
link to a route that doesn't exist on this branch).

**Information hierarchy, locked:** Forward Score (hero) → Next Best
Move → Forward DNA Depth / Evidence Quality / Goal Alignment pillar
cards → Search Readiness and supporting career tools. Search Readiness
is useful but clearly secondary, both visually and in document order.

**Terminology, locked exactly:**
- **Search Readiness** — unchanged name, unchanged meaning:
  operational readiness for FreshlyForward to run an effective job
  search on the member's behalf.
- **Forward Score** — unchanged name: broader career-position
  intelligence, a snapshot, not a judgment.
- **Goal Alignment** — the pillar's locked label. Never "Career
  Direction Readiness." The mockup's "Your Direction" card title is
  treated as an acceptable synonym but **not adopted** — one label
  used consistently everywhere (type names, card headings, copy) to
  avoid exactly the kind of terminology drift §9's naming-collision
  finding already warned about. Enforced by an automated test in the
  implementation plan (Task 2), not left to copy-review discipline
  alone.
- Career Compass's internal `careerDirection` dimension score is an
  **input to** Goal Alignment, never itself exposed as a second
  headline "readiness" metric on ForwardOS Home.

**Next Best Move.** A deterministic recommendation layer, not a
chatbot — a fixed-priority rule table over the four pillar scores plus
one piece of context (whether the member has an active application),
mirroring the same fixed-priority tie-break discipline
`readinessEngine.ts`'s own `BARRIER_PRIORITY` already establishes
elsewhere in this codebase. Full rule table in the implementation
plan's Task 4. No recommendation requires a system that doesn't exist
today (e.g. "Add a Career Win" links to `/forward-dna`, not to a
Career-Vault-only route).

**Explainability enforcement.** Not just a written requirement —
automated: the implementation plan's Task 6 includes a test asserting
the rendered widget never contains any of the five banned framing
phrases, so a future copy edit can't silently reintroduce one.

**Career Vault dependency, reconfirmed.** Forward Score may read
`career_skills` only. No merge, cherry-pick, or duplication of Career
Vault code. Once Career Vault merges, Evidence Quality benefits
automatically with zero Forward Score code changes — unchanged
conclusion from §2.

**Search Readiness, reconfirmed.** No modification to its
implementation, database behavior, trigger, badge, calculation, views,
or strategist/admin dependencies. Read/display the existing value
only — unchanged conclusion from §6/§8.

**Existing dashboard, reconfirmed.** Upgrade `DashboardPage.tsx` in
place. No second competing dashboard. User-facing name: ForwardOS
Home. `/dashboard` routing stays for compatibility — unchanged
conclusion from §4/§8.

---

**Next step: this stops here for your approval, not implementation.**
The companion implementation plan
(`docs/superpowers/plans/2026-09-01-forwardos-home-forward-score.md`)
is written and ready for review alongside this spec. No code has been
written. Implementation begins only after you approve both documents.
