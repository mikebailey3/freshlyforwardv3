# Recommendation Duplication Audit — Correction Report (Second Pass)

**Date:** 2026-09-12 (second pass, same day as initial audit publication) · **Trigger:** owner-identified
error — "Public ATS APIs replace Indeed scraping" was recommended as future work when
`scripts/scrapeCompanies.ts` already **is** that, and `.github/workflows/job-discovery-pipeline.yml`
confirms `scrapeIndeed.ts` is "intentionally never" run in the scheduled path. · **Method:**
independent re-verification against actual source code (not roadmap labels, plans, or doc comments)
by John Carter (architecture) and Alex Morgan (roadmap), each with their own grep/read evidence,
cross-checking each other. · **Scope:** documentation/roadmap correction only. No product code
changed. No migrations applied. No deploy. No destructive git action.

**This document does not replace `01-repo-architecture-audit.md` or `08-roadmap-and-prioritization.md`.
It corrects them. Per the "preserve historical truth" rule, the original documents remain unedited
except for pointer banners directing readers here — the original findings and reasoning stay on the
record.**

---

## 1. What triggered this and how bad it turned out to be

The owner's instinct was correct, and the problem was worse than the single example. Independent
re-verification found **three major misclassifications**, not one — plus four "docstring lie" defects
in the same class as the already-known D-05 dashboard bug, just one layer deeper (in library code,
not UI copy).

**Root cause (John Carter's diagnosis):** classifications were made from the *plan-document*
vocabulary rather than the *implementation*, and stale in-file doc comments were trusted over the
code beneath them. Concrete proof: `src/lib/resumeIntelligence/evidenceCoverage.ts:27` contains a
member-reachable string via `NullEvidenceCoverageProvider.unavailableReason` claiming **"Career
Vault does not exist yet"** — sitting 20 lines above a fully-implemented
`CareerVaultEvidenceCoverageProvider` that reads live `career_win_capabilities` data. The same false
string recurs at `resume.ts:104`, `memberOpportunityProfile.ts:55`, and `evidenceCoverage.test.ts:8`.

**Root cause (Alex Morgan's diagnosis, independently arrived at):** the original pass read
`docs/superpowers/plans/*` as statements of *intended* work when they were records of *shipped*
work — plans describe future tense by design, and describing a build in future tense remains true
in the file forever, even after the build ships. Nobody re-checked `src/` after the plan's own
target shipped.

**Both diagnoses point at the same fix — see the two new standing process rules in §2.**

---

## 2. New standing process rules (effective immediately)

**Rule 1 — "Grep-Before-Score."** No roadmap item may be scored, sequenced, or written into an
implementation plan until someone has grepped for its core runtime symbol in `src/` and `scripts/`
and recorded the literal result (`path:line` or "0 hits") **inside the item itself**. An item without
a recorded grep result is not scored — it is unscored and blocked. Plan documents, roadmap labels,
and TODO comments are never evidence of absence.

**Rule 2 — "Docstring Lies Are Bugs."** A code comment, docstring, or fallback-provider string that
asserts a shipped capability doesn't exist is not documentation debt — it is the exact same defect
class as D-05 (the dashboard's false "Career Vault — coming soon" card), one layer deeper. These are
filed as **defects** (see N12 below) and block release the same way D-05 does, especially when the
string is reachable by a member (as `evidenceCoverage.ts:27`'s is).

---

## 3. Recommendation Correction Matrix

| Audit Recommendation | Current Equivalent | Evidence | Actual State | True Missing Delta | Corrected Classification | Roadmap Action |
|---|---|---|---|---|---|---|
| **Public ATS APIs replace Indeed scraping** | `scrapeCompanies.ts` (Greenhouse/Lever/Ashby) | `.github/workflows/job-discovery-pipeline.yml:45,59`; `scrapeCompanies.ts` header | Shipped & scheduled in CI | None | **COMPLETE** | **DELETE** the recommendation — it's an as-built fact, not a roadmap item |
| **X1 External Job Capture** | `SubmitJobModal` → `submitMemberJob` | `OpportunityEnginePage.tsx:3,140`; `SubmitJobModal.tsx`; `jobSubmission.ts`; `opportunityEngine.ts:127-188`; `20260901000000_member_submitted_jobs.sql`; tested | Live end-to-end: member submits → same `computeFreshFitScore`/`buildMemberOpportunityProfile` as the scheduler → real scored `job_matches` row → existing strategist-only `promoteMatchToOpportunity` already applies, zero new code | Only automatic URL fetch/parse (today is manual entry only) | **PARTIAL-COMPLETE-EXISTING-SYSTEM** (core = COMPLETE) | **DELETE the project.** Core capability removed from roadmap entirely. Remaining delta → **HOLD** (see §5) |
| **X6 ATS Fit Feedback** | `atsReadability.ts` + `alignment.ts` + `analyzeTailoringFit.ts` | Dimension 1 of 6 in `resumeIntelligence/index.ts`; `FreshFitTargetRoleAlignmentProvider` (`useResumeWorkflow.ts:173`); `ResumeTailorPage.tsx:42`; template registry `isAtsSafe` + regression test | Live, member-visible, tested | Narrow parser-robustness on uploaded files only (date formats, heading recognition) | **COMPLETE-POLISH-ONLY** | **DELETE the project entirely.** Building a separate "ATS Fit" feature would create a competing-architecture failure. Log the narrow parser check as a backlog line inside the existing dimension |
| **X4 Career Evidence Intelligence** | `CareerVaultEvidenceCoverageProvider` + `evidenceQualityPillar` + `SkillEvidenceCard` | `evidenceCoverage.ts:57-165` (4 finding codes incl. `SKILL_WEAK_VAULT_EVIDENCE`); `useResumeWorkflow.ts:172`; tested | Live weak/missing-evidence detection + accomplishment prompts, already wired into Resume Intelligence | (a) name the specific weak skill in `nextBestMove`; (b) proactive surfacing outside Resume Intelligence; (c) coverage beyond skills into scope/responsibilities | **EXTENSION-OF-EXISTING-SYSTEM** | **RENAME** to "Evidence Prompting Extension." (a) → NOW (N13). (b) → NEXT. (c) → LATER (YAGNI, no evidence of demand) |
| **X8 Guided Next Actions** | `nextBestMove.ts` | `forwardScore/nextBestMove.ts`; `useForwardScore.ts:163-169` computes 3 signals then discards them before calling `getNextBestMove` | Live, deterministic, 3 CTA destinations; 3 real signals computed and thrown away | Widen the `context` object to use already-computed signals; offer/rejection actions need N5 | **EXTENSION-OF-EXISTING-SYSTEM** | **RENAME/SPLIT**: X8a (context widening) → NOW (N13, hours of work). X8b (offer/rejection actions) → NEXT, gated on N5 |
| **X5 Opportunity Intelligence Expansion** | ranking/dedup/liveness/exclusions/location modules | `ranking.ts`, `jobDeduplication.ts`, `scrapeCompanies.ts:87-195`, `exclusionRules.ts`, `location.ts`, `compensation.ts:117` | Freshness, dedup, ATS liveness sweep, ranking, location matching: **all already complete** | (a) Adzuna into liveness sweep; (b) UI for already-built `addExclusionRule`/`removeExclusionRule` (zero UI callers); (c) multi-currency salary comparison | **PARTIAL-COMPLETE-EXISTING-SYSTEM** | **RENAME** to "Opportunity Hygiene Completion." Shrinks to exactly 3 atomic NEXT items; delete "freshness scoring" and "dedup" from its description entirely |
| **X7 Strategist Console Upgrade** | 17 files / 240KB in `src/pages/strategist/` | `StrategistMemberWorkspacePage.tsx` (10 tabs incl. `CareerVaultTab`), `StrategistOpportunitiesPage.tsx`, `StrategistApplicationsPage.tsx`, `StrategistFridayReportsPage.tsx`, `AdminDashboardPage.tsx` | 10 of 15 originally-suggested capabilities already exist | URL-addressable tabs; batched loading; **Forward DNA / Career Compass / FreshFit score visibility in the member workspace (currently zero)** | **EXTENSION-OF-EXISTING-SYSTEM** | **RENAME** to "Strategist Canonical-Systems Visibility." The 3 visibility gaps are genuinely valuable (not polish); URL tabs/batching move to LATER |
| **N5 Application Command Center** | `applications` + `operations.ts` + `follow_ups` + `career_notes` + `why_we_applied` + `calendar_events` + `strategist_reminders` | `follow_ups`: 3 consumers incl. a live `FollowUpsTab` + admin overdue rollup (plan's "single `follow_up_date` column" claim was **wrong**); `calendar_events`: wired to applications via `set_application_interview_date` RPC (plan's "not wired to applications" claim was **wrong**); `strategist_reminders`: full RLS, **zero callers** | Substantially more substrate exists than either the original audit or the first-draft N5 plan credited | Interview rounds; structured offer/rejection entities; saved state; Career Vault/Forward DNA integration at the point of application | **PARTIAL-COMPLETE-EXISTING-SYSTEM** | **RESCOPE to "adopt-don't-rebuild."** Reuse `follow_ups`/`calendar_events`/`strategist_reminders` (adopt the idle one, don't rebuild). Moves from NOW to **NEXT-1** — see §6 |
| **N6 Outcome Learning Loop** | `member_feedback` (write-only) + `getFeedback()` (unused) | `opportunityEngine.ts:57-70`; `operations.ts:409-444` | Write side live; `getFeedback()` already exists but has zero UI callers | Read-back into FreshFit/gaps; structured outcomes | **NET-NEW (read side) over an existing write side** | Original ~35%-closed finding **holds**. Moves out of NOW alongside N5 (both gated on N5's schema) |
| **Saved Opportunities, Career Passport, Contacts/Networking-lite, Offer Intelligence, Product Analytics** | none | Confirmed 0 grep hits for each (`saved_opportunit*`, `passport`/`answer_library`, `contacts` table, structured offer entity, `trackEvent`/`posthog`/`segment`/`gtag`) | Genuinely absent | Everything | **NET-NEW** | **No correction — original classifications confirmed accurate.** One nuance added: an "Admin Analytics Dashboard" exists but is staff **operational/workload** analytics (overdue follow-ups, apps-by-status, strategist capacity), not member product-usage/funnel analytics — N7 remains genuinely at zero for the latter |
| **X9 Notification/Email Activation** | `NoOpNotificationProvider` + full pipeline | `notifications/provider.ts:56-60` + tests | Built, deliberately unplugged, false-"sent" hazard confirmed real | Real provider (owner-gated paid vendor) + fix false-"sent" | **COMPLETE-EXCEPT-OWNER-GATED-VENDOR** | No correction — confirmed accurate |
| **Interview infrastructure (`interview_prep`/`interview_feedback`)** | zero callers, independently re-verified | `communication.ts:183-240` | Built, RLS-complete, genuinely dead code | Any caller at all | **NET-NEW (surface) over built-but-unused schema** | No correction — original finding confirmed exactly. Split into X3a (wire existing tables, no N5 needed) / X3b (multi-round entity, needs N5) |
| **D-05 Dashboard "Career Vault — coming soon"** | `/career-vault` fully shipped | `DashboardPage.tsx:248-253,552-568` | Placeholder lies about a shipped feature | Swap the card | **COMPLETE (product) / BUG (UI)** | No correction — this is the one the original audit got right, and the model for N12 below |

---

## 4. New finding: "Shipped-But-Uncalled" is a pattern, not three incidents

Three separate capabilities are fully built, fully RLS-protected, and have **zero callers**:
`strategist_reminders`, `interview_prep`/`interview_feedback`, and
`addExclusionRule`/`removeExclusionRule`. This is a systemic habit of shipping substrate and never
landing the surface — and it is exactly the mechanism that caused this audit's errors, because
dead-but-shipped code reads as "missing" to a documentation-first reviewer and as "already built" to
a code-first one. Both readings are incomplete; the true state is "exists, unused, needs a decision."

**Ruling:** N11 (As-Built Documentation) gains a **Shipped-But-Uncalled Register**. Every entry is
either **adopted** (wired to a real UI/consumer) or **deleted** within two build cycles — no
indefinite third state. Going forward, no new table, RPC, or lib function merges without a caller in
the same change.

---

## 5. Corrected completion percentage

**Revised estimate: ~70% (band 67–73%),** up from the original ~60–65%.

| Domain | Original | Corrected | Why it moved |
|---|---|---|---|
| Resume System | ~80% | **~90%** | `atsReadability`, `alignment`, `analyzeTailoringFit`, and `evidenceCoverage` were all live and under-credited |
| Opportunity Intelligence | ~65% | **~78%** | Member-submission lane, freshness, dedup, liveness, ranking, location matching all complete |
| Career Intelligence | ~80% | **~85%** | Weak-evidence detection + prompting already exists via Resume Intelligence |
| Career CRM | ~40% | **~48%** | `follow_ups` is a real table with a real UI and admin rollup, not a single column |
| Human Services / Strategist | ~75% | **~80%** | 10-tab workspace, more complete than credited |
| Platform | ~50% | **~45–50% (unchanged)** | Analytics, SEO, E2E, error boundary, bundle size — every platform gap named in the original audit is real and untouched by this correction |
| Member Experience | ~65% | **~70% (unchanged)** | D-05 is real; this domain wasn't affected by the misclassifications |

**Important qualitative point, agreed by both reviewers:** every error found in this second pass ran
in the same direction — the product is further along than its own documentation says. Four
instances now (ATS/Indeed, X1, X6, X4), plus D-05, plus four stale docstrings. **Zero errors ran the
other way** (nothing was documented as shipped and found actually missing). That is a consistent,
directional bias with a known mechanism (plans written in future tense, never reconciled after
shipping) — not evidence that anything else in the audit should be assumed correct without
verification.

**Built vs. verified — a second, separate number that must not be collapsed into the first:**
~70% of the intended system is **built**. Whether the corresponding database schema is **live in
production** is a completely separate question, gated on N1, and this correction pass changes
nothing about that — see §7. Roughly **55–60% is currently verified** (built *and* confirmed live).
**N1 is the gap between those two numbers and remains the #1 blocker**, exactly as originally
stated. A moat that cannot be proven persisted is a claim, not a moat.

---

## 6. Corrected roadmap

### NEW BUCKET — COMPLETE, removed from active roadmap entirely
"Public ATS APIs replace Indeed scraping" · X1's core capture-to-scoring pipeline · X6 in its
entirety · X4's core detection/prompting · X5's freshness/dedup/liveness/ranking/location · X7's 10
already-built capabilities · X8's 3-signal computation layer · N5's `follow_ups`/`calendar_events`
substrate.

### DELETED entirely (not merely reclassified)
1. **X6 ATS Fit Feedback** — building it would create a competing-architecture failure
2. **X1 External Job Capture** (as a project) — the capability shipped; only a HOLD-gated remainder exists
3. **"Public ATS APIs replace Indeed scraping"** — the original trigger; it's an as-built fact now

### RENAMED / RESCOPED (same-ish remaining work, honest label)
- X4 Career Evidence Intelligence → **X4 Evidence Prompting Extension**
- X5 Opportunity Intelligence Expansion → **X5 Opportunity Hygiene Completion**
- X7 Strategist Console Upgrade → **X7 Strategist Canonical-Systems Visibility**
- X8 Guided Next Actions → **X8a Next-Best-Move Context Widening** / **X8b Lifecycle Actions**
- X3 Interview Intelligence v1 → **X3a Interview Data Activation** / **X3b Multi-Round Interview Entity**
- N5 Application Command Center → **N5 Application Command Center (adopt-don't-rebuild)**

### Rebuilt NOW (launch gate)
N1 Schema Reconciliation · N2 Dashboard Truth Fix · N3 Member-Trust Correctness Pack · N4 Product
Coherence Pass · N7 Minimum Product Analytics · N8 E2E Journey Coverage · N9 Bundle Code-Splitting ·
N10 Public-Route Prerendering · N11 As-Built Documentation Sweep (**widened** to cover every newly
COMPLETE item + the Shipped-But-Uncalled Register) · **N12 Documentation-Truth Defect Pack (NEW)** —
fix the four member-reachable "Career Vault does not exist yet" strings, same gate as D-05 ·
**N13 Discarded-Signal Activation -- SPLIT into N13a (Lifecycle Signal Activation, X8a, in
progress) and N13b (Evidence-Specific Next Best Move Integration, X4a, blocked on its own
architecture ruling)** -- see `implementation-plans/N13a-lifecycle-signal-activation.md` and
`implementation-plans/N13b-evidence-specific-next-best-move.md`. N13a remains the highest
value-per-hour
item on the board.

**Removed from NOW: N5 and N6.** Both remain real work, but N5's "everything depends on it"
justification weakened from 4 dependents to 2 (N6 and X3b) once X1/X3a/X4 were found already
live/cheap — a capability with 2 real dependents, neither launch-blocking, does not belong in a
launch gate.

### Rebuilt NEXT (ranked)
1. **N5 Application Command Center (adopt-don't-rebuild)** — see §7 for why it's still the pick
2. **X7 Strategist Canonical-Systems Visibility** — Forward DNA/Compass/FreshFit surfaced to strategists
3. **X3a Interview Data Activation** — wire the shipped-but-dead tables, no new schema, N5-independent
4. **X5a Adzuna → liveness sweep** (promotes to NOW immediately if Adzuna is ever scheduled in CI)
5. **X5b Exclusion-rule UI**
6. **X4c Proactive evidence surfacing** (outside Resume Intelligence)
7. **N6 Outcome Learning Loop** — highest-scoring item overall, needs N5
8. **X3b Multi-Round Interview Entity** — needs N5
9. **X8b Lifecycle Actions** — offer/rejection decisions, needs N5
10. **X2 Career Passport** — `[dependency unverified]`, see §8
11. **X9 Notification/Email Activation** — unchanged, owner-gated vendor decision

### LATER
X4d (evidence coverage beyond skills) · X5c (multi-currency salary comparison) · X7's URL-addressable
tabs + batched loading · L1 Networking Contacts (lite) · L2 Offer Intelligence (needs N5) · L3 Member
Progress Analytics · L4 Public Resource Pages · skill taxonomy · roadmap-milestone interview attribution

### HOLD
**X1 URL auto-fetch/parse (new)** — released only by N7 analytics showing real member abandonment at
the paste step, plus Ethan's mandatory SSRF review (a server-side fetcher of user-supplied URLs is a
new deployed surface with a real SSRF profile). This is the identical evidence bet already applied
to the browser extension — applying it to one and not the other would be incoherent. Also unchanged
from before: Browser Extension · new job providers · salary/company/geo intelligence · live
competitor re-verification · public Forward Profile indexability.

### REJECTED
Unchanged from the original audit, **plus X6 ATS Fit Feedback** (rejected as a project — capability
already shipped; building it would create a competing architecture).

---

## 7. Is N5 still the right next major build?

**Yes — confirmed by both reviewers, on a different and more honest argument than it had before.**

The old argument ("everything valuable in NEXT depends on it") is now false and has been struck — it
gates N6 and X3b only, not four items. It survives anyway, for three reasons:

1. **Career CRM is the only domain-sized hole left.** Post-correction: Resume 90%, Career Intelligence
   85%, Strategist 80%, Opportunity 78%, Career CRM 48%. Every other member-facing domain is in
   polish territory; Career CRM is not.
2. **One of its two remaining dependents is the single top-scoring item in the whole audit** (N6,
   highest moat contribution available). Dependency weight is about what's behind the gate, not how
   many items are.
3. **N5 is where the canonical chain terminates.** Forward DNA → Career Vault → Compass → FreshFit →
   Resume Intelligence all resolve into a member's application, and the application surface currently
   knows nothing about any of them — the same coherence gap X7 found on the strategist side, now
   found on the member side. This argument stands on its own merit, with zero borrowed dependency
   weight.

**What changed about N5 itself:** it moves from NOW to **NEXT-1** (first thing after the launch
gate, not part of the launch gate), and its implementation plan is corrected to **adopt, not
rebuild** `follow_ups`, `calendar_events`, and `strategist_reminders` — see the updated
`implementation-plans/N5-application-command-center.md`.

**What ships before/during N5, N5-independent:** X8a, X4a (both in N13, NOW), X3a, X5a/X5b, and
X7's visibility work are all days-scale and do not depend on N5. They ship in parallel while N1 runs
on ChatGPT's side and while N5 itself is being scoped/built. N5 is the next major *build*; it is not
the next *thing to ship* — those are different questions the original roadmap conflated.

---

## 8. Open item flagged for further verification

**X2 Career Passport's dependency on N5 is unverified and should not be assumed**, given that the
exact same assumed-dependency error just produced three misclassifications elsewhere. Career
Passport needs Career Vault (shipped), Resume Intelligence (shipped), and Forward DNA (shipped) —
no mechanism connecting it to the Application Command Center's schema has been identified. This is
flagged, not resolved: John Carter should run a grep-before-score pass on it specifically before it
is scheduled. If the dependency doesn't hold, X2 moves to NEXT-tier, N5-independent work and could
ship materially sooner.

---

## 9. Database verification — incorporating ChatGPT/DB-Lead's findings

**Important update since `07-migration-reconciliation.md` was published:** ChatGPT (Supabase/DB Lead,
the sole execution authority per charter rule 9) has verified directly against the connected
Supabase FreshlyForward project that:

- **36 remote migration-history records exist** (out of 46 local migration files)
- **The Opportunity Engine 2.0 migration chain is recorded remotely**, including the OE
  security-hardening migrations that were flagged as the highest-priority unverified set in
  `07-migration-reconciliation.md`
- **Corresponding OE tables exist remotely**

**Correction (per further ChatGPT/DB-Lead review): the safe verified statement is narrower than
the original wording above implied.** Do not claim "the entire Tier 1 list is confirmed" — that has
not been established, because no individual Tier 1 migration has yet been matched against remote
evidence one by one. What is actually verified is exactly the three bullet points above: 36 remote
migration-history records were observed, the OE 2.0 chain and its security-hardening migrations are
represented remotely, and corresponding OE objects/tables were observed. Remaining repo-vs-remote
reconciliation is still required before any Tier 1 item can be called closed. **This does not mean
N1 is closed.** Per the owner's explicit instruction:

- These migrations have **not** been reapplied, and must not be
- The statement "46/46 migrations unverified" in the original `07-migration-reconciliation.md` is
  **narrowed by this new evidence for the 36 with a remote history record** — but the remaining
  **task is repo-to-remote reconciliation**, and the methodology for that reconciliation is corrected
  below, **not blind trust that "recorded" means "fully reconciled and correct."**

**Reconciliation methodology correction:** do **not** require every current live object to "exactly
match" the historical migration file that originally created it. Later migrations can legitimately
modify that same object (add a column, tighten a policy, replace a function body), so a live object
differing from its *originating* file is expected, not drift. The correct check is: migration
history + the **cumulative intended end-state** across every migration touching that object, compared
against the object's actual current definition — and identify genuine drift from that final expected
schema/policy/function definition, not from any single historical snapshot. Do not mistake a
legitimate later migration for drift.
- The newly-surfaced **Supabase Security Advisor findings** from this verification pass are
  preserved for separate review and are **not** treated as resolved by this correction.

**Action:** `07-migration-reconciliation.md` and `implementation-plans/N1-schema-reconciliation.md`
are updated with pointer banners to this section. The exact enumeration of which 10 migrations lack
a remote record, and line-by-line content reconciliation for the 36 that have one, remains
outstanding work for ChatGPT/DB-Lead — this correction records the aggregate facts reported, not a
completed reconciliation.

---

## 10. Escalations — unchanged, plus one addition

All ten original owner escalations remain open and untouched by this correction. **One addition:**
if X1's URL auto-fetch/parse ever clears its HOLD status, it introduces a server-side fetcher of
user-supplied URLs — a new deployed surface with a genuine SSRF profile — and escalates for owner
sign-off **at that time**, not now.

---

## Sources / verification trail

Both John Carter and Alex Morgan performed independent, non-delegated source-code verification
(file paths and line numbers recorded above) before this document was written. No file outside
`docs/audit/` was modified in the production of this correction. No build or test suite was run,
because no code was changed — this correction makes no claim about build/test status beyond what
`05-qa-testing-review.md` already established.
