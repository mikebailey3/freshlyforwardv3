# ForwardOS Project 3 — ForwardOS Home + Forward Score — Design Audit (DRAFT)

**Status: DESIGN/AUDIT ONLY. Not approved. No migration written, no
schema applied, no implementation code changed.** This document is the
deliverable requested for review before any implementation work
begins, per the parent ForwardOS-initiative brief (Project 3 of 3,
named explicitly in `2026-08-31-forward-dna-design.md` §Purpose).

Branch: `forwardos-home-forward-score`, cut from `main` @ `76b86cb`.
Deliberately **not** based on, and does not merge, the unmerged
`career-vault-capability-engine` branch (Project 2), per explicit
instruction. Career Vault's own spec (§19, Scope Check) independently
lists **"Forward Score"** as an item it explicitly deferred out of
Project 2 — confirming this really is new, not-yet-designed ground,
not a duplicate of anything already decided elsewhere.

---

## 0. Product Principle (inherited, unchanged)

Same non-negotiable rule as Projects 1 and 2: every ForwardOS feature
must either add to Forward DNA or use Forward DNA to produce a better
outcome. Forward Score's entire premise is the second half of that
sentence — it is a *consumer* of existing signals, not a new source of
truth, and not a replacement for anything that already exists.

## 1. Existing-System Audit

| Existing capability | What it actually does | Disposition |
|---|---|---|
| `DashboardPage.tsx` (`/dashboard`) | The current member home: Search Readiness stat card, Applications/Interviews/Messages stat cards, strategist CTA, tip/motivation, upcoming events, "Recommended for You", "Your Progress This Week" (reuses `readiness.score` a second time as "Profile Completeness"), Career Compass summary card, Forward DNA summary card, Forward Feed preview, Quick Access Tools. | **UPGRADE, not replace.** This *is* "ForwardOS Home" already in substance, just not in name or in north-star framing. Per explicit instruction, this file gets evolved, not duplicated — no new `ForwardOSHomePage.tsx`. |
| `calculateSearchReadiness()` (`src/lib/profile.ts`) + `member_profiles.search_readiness_score` + badge trigger (`badge_system.sql`) + reads in `AdminMemberDetailPage`, `StrategistMemberWorkspacePage`, `StrategistDashboardPage`, `StrategistMembersPage` | Independent weighted-checklist profile-completeness score, 0–100. | **KEEP, completely untouched.** Per explicit instruction and per Forward DNA spec §8/Career Vault spec's own confirmed precedent, this stays its own metric forever until a separately-approved consolidation ticket — which this project is *not* that ticket, it is the thing that ticket was waiting on. Forward Score treats this as one **input**, never as something to rename, recompute differently, or hide. |
| `calculateForwardDnaCompleteness()` (`src/lib/forwardDna/completeness.ts`) | Independent weighted-checklist score over Career Compass/scope/responsibilities/skill-evidence/education/goals, 0–100. | **CONNECT, read-only.** A second input into Forward Score. Also untouched — no shared code path. |
| `career_skills` table (`state: 'claimed'\|'demonstrated'\|'supported'`) | Already the live evidence-quality signal. Already merged to `main` (Project 1). Already consumed by `scoreSkillEvidence()` (FreshFit) and by `hasSkillEvidenceBeyondClaimed` (Forward DNA completeness). Members can already move a skill off `claimed` today, manually, via `SkillEvidenceCard`'s 3-way toggle — with zero dependency on Career Vault. | **CONNECT.** This is the answer to the Career Vault dependency question — see §2 below. |
| Career Vault (`career_wins`, `career_win_capabilities`) | Unmerged branch. Automatically *upgrades* `career_skills.state` when a member confirms a capability — does not introduce any new score of its own (confirmed in its own spec §1: "no new Career-Vault-specific completeness signal is proposed"). | **DO NOT DUPLICATE OR REIMPLEMENT.** Explicit dependency, resolved by design in §2 — Forward Score never reads `career_wins`/`career_win_capabilities` directly, only the already-merged `career_skills` table those tables write into. |
| `applications`, `mock_interviews`, `calendar_events` tables (already read by `DashboardPage.tsx`) | Real activity/engagement data: active applications, submissions this week, interview prep status, upcoming events. | **CONNECT, read-only.** Candidate "momentum" pillar input — the one dimension none of the three existing completeness/readiness scores capture (they're all static-profile-shape checks; none measure whether the member is *actively doing anything* this week). |
| `career_compass_results` (`primary_archetype`, dimension scores) | Already surfaced as its own Dashboard card. | **CONNECT, read-only**, as a completion signal only (has-a-result vs. not), already double-counted safely — Forward DNA completeness already includes "Career Compass completed" as one of its own checks, so Forward Score doesn't need to read this table a second time; it inherits it transitively via the Forward DNA Depth pillar. |
| `useBadges` / Achievement Vault (`badges`, `member_badges`) | Separate gamification system, its own page (`/achievement-vault`), gated on its own trigger logic. | **KEEP, unrelated — do not fold in.** Same disambiguation already flagged by both prior specs ("Career Vault" vs. "Achievement Vault" naming risk). Forward Score is a readiness/momentum metric, not a badge; mixing the two would blur a distinction both prior specs went out of their way to protect. |
| `freshFitScore.ts` ("FreshFit") | Per-job match score, not a member-level score. Explicitly flagged "next-phase work" in both prior specs, never picked up. | **OUT OF SCOPE**, unchanged, for the third project running. Not touched here either — different question (job fit vs. member momentum), no shared inputs worth coupling. |
| Routing/layout conventions (`ProtectedRoute`, `MemberLayout`, flat routes, no `feature`/`requiredPlan` gate on core ForwardOS pages) | Established by Projects 1 and 2. | **CONNECT, follow verbatim.** Forward Score has no reason to be plan-gated — it's a read-only aggregation of data every member already has. |
| AI/LLM anywhere in `src/` | None. Every ForwardOS score to date (Search Readiness, Forward DNA completeness, Career Compass dimensions, FreshFit) is a deterministic weighted function. | **Confirmed absent, staying that way.** Forward Score is proposed as 100% deterministic — a pure function of already-computed inputs, same shape as its predecessors. No new precedent needed, no new risk introduced. |

## 2. The Career Vault Dependency — Explicitly Identified, Not Duplicated

This is the one place the brief specifically asked to slow down and be
honest rather than clever, so being explicit about the reasoning:

**Question:** Does Forward Score need anything that only exists on the
unmerged `career-vault-capability-engine` branch?

**Answer: No, and here's the exact mechanism why.** Career Vault's own
design spec (read directly, not assumed) states its capability
engine's *entire effect on the rest of the app* is to upgrade a row in
the already-merged `career_skills` table from `claimed` to
`demonstrated` — nothing else. It deliberately does not introduce a
second, parallel "evidence score." That table, and the tri-state
column on it, has existed on `main` since Project 1 and is already
readable today, with or without Career Vault merged.

So Forward Score's "Evidence Quality" pillar (§3) is designed to read
`career_skills` directly — a table already on this branch's base.
**Once Career Vault merges later, this exact same input gets richer
automatically** (more members will have skills at `demonstrated`,
backed by real narrative evidence) **with zero Forward Score code
changes required.** That is the "identify explicitly instead of
duplicating" resolution: no `career_wins` or `career_win_capabilities`
table, type, or query is defined or referenced anywhere in this
project. If a future iteration wants Forward Score to weight *how
many distinct pieces of evidence* back a skill (not just its state),
that would be a genuine, explicit, separately-scoped dependency on
Career Vault being merged first — flagged here as a clean v2 hook, not
built now.

## 3. Forward Score — Proposed Definition (needs your sign-off, not locked)

A single 0–100 composite, structurally identical in *shape* to
`calculateSearchReadiness()` / `calculateForwardDnaCompleteness()`
(weighted checklist/pillars → percentage), but composed of **other
scores and activity signals**, not raw profile fields — it's a
level up, not a third parallel copy of the same idea.

Proposed pillars (weights are a starting proposal for discussion, not
final):

| Pillar | Source (already exists) | Proposed weight | What it captures |
|---|---|---|---|
| Profile Readiness | `calculateSearchReadiness(profile).score` | 30 | Is your baseline profile complete enough to be found/considered at all? |
| Forward DNA Depth | `calculateForwardDnaCompleteness(...).score` | 25 | Do you have real scope/responsibilities/goals depth behind the basics? |
| Evidence Quality | `career_skills` state distribution (e.g. `% of skills at demonstrated/supported`) | 20 | Is your claimed skill list backed by anything, or just a word list? |
| Momentum | Applications submitted this week/month, interviews scheduled/completed, recency of any activity | 25 | Are you actually moving right now, this week — the one dimension none of the other three scores measure? |

Explicitly **not** proposed as inputs: badges/Achievement Vault
(different concept, §1), FreshFit (per-job, not per-member, §1), any
LLM/AI judgment call (house style is 100% deterministic).

**Open questions for you before this gets locked** (flagging rather
than guessing, same discipline as Career Vault's §19 Locked Decisions
process):
1. Do these four pillars feel right, or is a signal missing/wrong
   (e.g. should "time since last login" or badge count count toward
   Momentum)?
2. Are the proposed weights (30/25/20/25) reasonable, or should
   Momentum count for more/less relative to the three static-profile
   scores?
3. Computed on-the-fly (like its three predecessors) or stored with a
   trigger? Recommendation: **on-the-fly**, matching Forward DNA §6's
   own reasoning — nothing needs to filter/sort members by this
   server-side yet, so a stored column is unnecessary migration risk
   until proven otherwise.
4. Should Search Readiness's *existing* stat card on the dashboard be
   visually de-emphasized in favor of a new, more prominent Forward
   Score hero widget, or should they sit side-by-side at equal visual
   weight? (Either is compatible with "preserve Search Readiness as
   its own metric" — this is a visual-hierarchy question, not a data
   question.)

## 4. ForwardOS Home — Proposed Architecture (upgrade, not duplicate)

```
src/pages/DashboardPage.tsx                    - UPGRADED, not replaced
src/components/forwardScore/ForwardScoreWidget.tsx   - new hero widget
src/lib/forwardScore/score.ts                  - pure, deterministic composite function
src/lib/forwardScore/score.test.ts             - unit tests, same TDD discipline as every prior module
src/lib/forwardScore/index.ts                  - typed barrel export
```

Follows the exact `lib/careerCompass/` / `lib/forwardDna/` pattern
already established twice: a pure, unit-testable calculation module
with no Supabase calls inside it (the page/hook fetches the four
already-existing inputs and passes them in), consistent with every
prior ForwardOS scoring function.

**Dashboard changes proposed (additive, nothing removed):**
- New `ForwardScoreWidget` placed prominently near the top (above or
  beside the existing stat-card row) — a big-number hero treatment,
  since this is meant to be the north-star number the Forward DNA spec
  already anticipated.
- Existing Search Readiness stat card **stays exactly where it is**,
  unchanged in behavior — only its visual prominence relative to the
  new widget is an open question (§3, item 4).
- Existing Career Compass card, Forward DNA card, "Your Progress This
  Week" panel — all untouched. "Profile Completeness" inside that
  panel is Search Readiness re-displayed a second time already, today
  (pre-existing, not something this project introduces) — flagged only
  as a pre-existing minor redundancy, not something in scope to fix
  here unless you want it addressed opportunistically.
- **Naming question, explicitly not decided here:** does "ForwardOS
  Home" replace the "Dashboard" label in the member nav and page
  title, or does "Dashboard" stay as the user-facing name while
  "ForwardOS Home" remains an internal/architectural term? Both are
  compatible with "upgrade the existing dashboard" — this is a
  branding call for you, not a technical one.

## 5. Explicit Non-Goals (carried from Projects 1 & 2's own Scope Check discipline)

Not part of this project unless you tell me otherwise:
- No AI/LLM anywhere.
- No changes to `calculateSearchReadiness()`, its stored column, its
  badge trigger, or any admin/strategist page that reads it.
- No changes to `calculateForwardDnaCompleteness()`.
- No FreshFit redesign.
- No Career Vault schema, types, or queries referenced.
- No new plan/entitlement gating — free for every member, matching
  every prior ForwardOS page.
- No strategist/admin-facing Forward Score view in v1 (flagged as a
  plausible future nice-to-have, same pattern as Forward DNA §8 risk 4).

## 6. Draft Acceptance Criteria (for discussion, mirrors Projects 1 & 2's format)

- A member sees a single Forward Score (0–100) on the (upgraded)
  Dashboard, computed live from Profile Readiness, Forward DNA Depth,
  Evidence Quality, and Momentum.
- Search Readiness's existing score, badge trigger, and every
  admin/strategist consumer remain byte-for-byte unmodified.
- Forward DNA completeness remains byte-for-byte unmodified.
- Forward Score's calculation module has zero references to
  `career_wins` or `career_win_capabilities` (enforced the same way
  Task 12 locked down the Search Readiness field list — a cheap
  regression test asserting the import graph, not just a promise).
- No new database migration is required (Forward Score is computed
  entirely from existing tables/columns).
- `tsc --noEmit` clean, full existing suite green, new module has its
  own unit tests before being wired into the Dashboard (TDD, same
  discipline as every prior ForwardOS module).

---

**Next step, per your instruction: this stops here for your review.**
No component, hook, or scoring code has been written. Once you weigh
in on the four open questions in §3 and the naming question in §4,
I'll fold your answers into a locked spec (same `§19 Locked Decisions`
pattern Career Vault used) and only then move to an implementation
plan.
