# Implementation Plan — N5: Application Command Center (adopt-don't-rebuild)

> ## CORRECTION AFTER REPO-TRUTH RECONCILIATION (2026-09-12, second pass)
> This plan's original §2 and §3.5 **understated existing substrate and contained two factual
> errors**, struck below rather than silently fixed:
> - ~~"`follow_up_date` exists as a single column on `applications` — no history, no reminder
>   engine."~~ **WRONG.** A real `follow_ups` table already exists (`20260802180911...sql`) with
>   working CRUD in `operations.ts`, a live `FollowUpsTab` in `StrategistMemberWorkspacePage.tsx`,
>   and an overdue rollup on `AdminDashboardPage.tsx`. What's missing is the **member-facing** view
>   and tighter application linkage — not the table or history.
> - ~~"Calendar events exist... but aren't wired to applications today."~~ **WRONG.**
>   `AddCalendarEventModal.tsx` already calls the `set_application_interview_date` RPC, and
>   `CalendarPage.tsx`/`InterviewsPage.tsx` already read `applications.interview_date`.
> - **New finding:** `strategist_reminders` exists with full RLS but **zero callers anywhere in
>   `src/`** — same dead-code category as `interview_prep`/`interview_feedback`. §3.5 below is
>   corrected to **adopt** this table, not build a fourth reminder model.
> - **Status changed: this moves from NOW to NEXT-1** (first item after the launch gate, not part
>   of it). Its "unlocks everything" justification weakened from 4 dependents to 2 (N6 and X3b only
>   — X1, X3a, and X4 turned out to be N5-independent or already live). It remains the right next
>   major build on its own merit — see `../11-recommendation-duplication-correction.md` §7 for the
>   full corrected reasoning.
>
> The rest of this plan (interview entity design, contacts, offer/rejection structure, FreshFit
> snapshot, strategist visibility) is unaffected and stands as originally written.

> ## FURTHER CORRECTION -- DOMAIN BOUNDARY WARNING (do not implement until resolved)
> ChatGPT/owner review flagged that **§3.1's proposed state machine
> (`Discovered → Saved → Preparing → Applied → Follow-up → Interview → Offer/Rejected/Withdrawn`)
> must not be automatically implemented as a single flat lifecycle directly on the `applications`
> table.** FreshlyForward already deliberately separates the **opportunities vocabulary**
> (`scraped_jobs`/`job_matches`/`opportunities` -- candidate leads sourced by Opportunity Engine,
> pre-commitment) from the **applications vocabulary** (`applications` -- a member has actually
> applied). `Discovered` and `Saved` are opportunity-side states that predate an `applications` row
> existing at all; collapsing them into one state machine on `applications` would erase that
> intentional boundary rather than respect it. This is exactly the "two unexplained opportunity
> vocabularies" problem N4 (product coherence pass, already listed as a hard dependency in §5 above)
> exists to resolve -- N5 must not quietly pre-empt that answer by baking a merged state machine into
> its own design. **Note: this correction message arrived truncated after "FreshlyForward already
> deliberately separates: opportunities" -- the exact intended continuation/wording has been
> requested from the owner and this banner will be updated once received.** Until N4 resolves the
> vocabulary question and John Carter re-reviews §3.1 against that resolution, treat §3.1 as **not
> approved for implementation as currently worded**. This plan remains NEXT-1/not-started regardless.

**Status:** PLANNED — not started (documentation only; no schema or product code created by this
audit). **Owner:** John Carter (architecture) + an Opportunity Engine / Career CRM delivery
specialist (Emily Foster is the charter's Career CRM Lead — she should own delivery).
**Collaborators:** Sarah Chen (lifecycle UX), Ethan Cole (RLS on every new entity — mandatory,
not optional), Nina Patel (E2E coverage).

## 0. Does this recommendation still hold after full reconciliation?

**Yes — re-confirmed.** This plan was written last, after every other specialist doc, the migration
reconciliation, the gap register, and the roadmap synthesis were complete, specifically so the
recommendation could be checked against the *whole* audit rather than any one specialist's view in
isolation. It holds for four independent reasons that all converge on the same answer:

1. **John (architecture):** the Career CRM classifies as an application tracker, not a CRM — no
   Contacts entity (class **E**, not started), Interviews are a filtered view of `applications` by
   status rather than their own entity (class **C**), Offers/Rejections are single free-text/status
   columns (class **C**) — see `01-repo-architecture-audit.md` §2.5.
2. **John (feedback loops):** the #1 missed intelligence loop in the entire product — outcomes never
   feeding FreshFit — is structurally blocked because there is nothing to attach a structured
   outcome *to*. Closing it (N6) is impossible without this first. See §18 Loop 1.
3. **Sarah (UX):** the member journey has no clear "what needs my action today" surface once an
   application exists — reinforcing the same gap from the usage side.
4. **Ryan (competitive research):** a shared job-search CRM/memory layer was the **#1 validated
   competitor-proven user problem** across Teal/Huntr/Careerflow/Simplify — but per the anti-copy
   rule, this plan is scoped to what FreshlyForward's canonical data uniquely enables (FreshFit at
   time of application, Vault-grounded evidence), not a copy of any competitor's CRM.

No new evidence gathered after Alex's roadmap doc contradicts this. It remains the single largest
NOW capability and the correct next major build.

## 1. Problem

Members can't tell what needs action today. Interviews can't have rounds, a scheduled date beyond
one field, or prep notes as first-class data. There is no "saved" state — only dismiss. Rejection
reasons and offer terms have nowhere structured to live, so nothing can learn from them. Contacts
(recruiters, hiring managers, referrals) don't exist at all.

## 2. Current state (what this builds on, not replaces)

- `applications` table + `src/lib/operations.ts` lifecycle helpers — status enum only, no
  first-class interview/offer/contact entities.
- `interview_prep` / `interview_feedback` tables exist with full RLS and typed CRUD in
  `src/lib/communication.ts:183-240` — **zero callers anywhere in `src/`.** `MockInterviewPage`
  bypasses them entirely for a plain text column.
- `career_notes` / `internal_notes` / `member_notes` / `member_visible_notes` split already exists
  and is well-considered (John, §2.6) — reuse this pattern, don't invent a new notes model.
- `follow_up_date` exists as a single column on `applications` — **CORRECTED: see banner above, a
  full `follow_ups` table + UI + admin rollup already exist; do not rebuild.**
- Calendar events exist (`/calendar`) and could host interview scheduling, but aren't wired to
  applications today. **CORRECTED: see banner above — already wired via `set_application_interview_date`.**
- `job_matches.promoted_opportunity_id` already bridges Opportunity Engine matches into the
  `opportunities` table — the Command Center should sit downstream of that bridge, not duplicate it.

## 3. Scope for V1 — design for the full lifecycle, ship the load-bearing parts

### 3.1 Applications as real lifecycle entities
Promote the application record itself to carry an explicit lifecycle state machine:
`Discovered → Saved → Preparing → Applied → Follow-up → Interview → Offer / Rejected / Withdrawn`.
Define legal transitions explicitly (per Emily's own hard rule on state machines) and test the
illegal ones. "Saved" fills the confirmed gap that Opportunity Engine currently only supports
dismiss, not save.

### 3.2 Interview entities
Design decision to make explicitly (John's call at build time, not pre-decided here): **either**
(a) wire up the existing unused `interview_prep`/`interview_feedback` tables as the interview
entity's prep/feedback sub-records, or (b) supersede them with a new `interviews` table shaped for
real lifecycle needs (rounds, type: phone/technical/onsite/panel, scheduled date/time, interviewer
name(s), outcome, notes) and formally mark the old tables **F (legacy/superseded)** if they don't
fit. Given they already have full RLS and zero callers, reusing them is the cheaper option and
should be tried first — this plan does not mandate throwing them away.

### 3.3 Recruiter / hiring-manager / contact relationships
New `contacts` entity: name, role (recruiter / hiring manager / referral / other), company,
contact info, linked to one or more applications, with a lightweight interaction history (not a
full relationship CRM — that's LATER item L1). This closes John's class-**E** "Contacts — entirely
absent" finding.

### 3.4 Notes
Reuse the existing `internal_notes`/`member_notes`/`member_visible_notes` pattern already proven on
strategist surfaces — attach the same pattern to applications/interviews/contacts rather than
inventing a fourth note model.

### 3.5 Follow-ups and reminders (CORRECTED: adopt existing tables, don't rebuild)
A real `follow_ups` table, CRUD, strategist tab, and admin overdue rollup already exist — see the
correction banner above. The genuine remaining work is: (a) a **member-facing** follow-up view (today
it's strategist/admin-only), (b) tighter linkage from a follow-up to the specific application
lifecycle stage it belongs to, and (c) **adopting** the existing, fully-RLS'd but currently-uncalled
`strategist_reminders` table as the reminder engine rather than building a new one. Connect both to
the existing `calendar_events` (already wired to applications via `set_application_interview_date`)
for the actual reminder surface.

### 3.6 Offer / rejection / withdrawal outcomes
Structured records, not free text: offer terms (comp, start date, deadline to decide — enough to
support L2 Offer Intelligence later, not full comparison tooling now), rejection reason (from a
taxonomy, consistent with the existing `dismissalReasons` taxonomy pattern already proven in
Opportunity Engine), withdrawal reason.

### 3.7 Job + resume version relationships
`applications.resume_version_id` already exists as a foreign key — today it has exactly one
consumer (a title lookup). Make it load-bearing: the Command Center should show which resume
version was used for a given application as a first-class, visible fact, and this relationship is
the direct on-ramp for N6 (resume → outcome feedback loop).

### 3.8 FreshFit at time of application
Persist the FreshFit score **and its explanation/version** as it existed at the moment of
application (not a live-recomputed score), so a member/strategist can later see "this looked like a
78 when I applied" even if scoring weights change later. `job_matches.engine_version` already
establishes the precedent for versioned, point-in-time scoring — extend that pattern here rather
than inventing a new one.

### 3.9 Outcome feedback into future recommendations
This plan **creates the entities** outcome data needs to live in. It does **not** implement the
feedback wiring itself — that is N6, sequenced immediately after this, hard-dependent on these
entities existing. Do not scope N6's aggregation logic into this ticket.

### 3.10 Strategist visibility
Every entity above needs a strategist-parity view, consistent with the existing pattern where
strategist surfaces read the same tables members do (John confirmed no disconnected strategist
systems exist today — preserve that property; do not build a second, parallel data model for
strategists).

### 3.11 ForwardOS next-action integration
`nextBestMove.ts` already implements a priority ladder for the dashboard. The Command Center's
"what needs action today" surface should feed into and read from that existing system, not create
a second, competing "next action" concept.

### 3.12 Analytics / funnel metrics
Depends on N7 (Minimum Product Analytics) existing first for the event layer, but the Command
Center's structured, real transition data (not estimated) is exactly what makes funnel analytics
honest per Emily's hard rule: "funnel analytics must be computed from real recorded transitions,
never estimated." Design the entities so a later analytics pass can query real transition
timestamps directly.

### 3.13 Eventual email/calendar integration — designed for, not required for V1
Do not build email/calendar integration in V1 (that's X9 / a separate, owner-gated paid-vendor
decision per the roadmap). But: model the `contacts` and `interviews` entities so that an email
thread ID or calendar event ID can be attached later as an optional field, without a schema
rework. This is a "leave room" requirement, not a build requirement.

## 4. Explicit exclusions (do not build these here)

- No full networking/relationship CRM (LATER L1 — lite contacts only in this plan)
- No auto-apply or bulk actions of any kind, ever — this contradicts the locked "100% human-led"
  positioning
- No offer *comparison* UI (LATER L2 — this plan only structures the offer record)
- No email/calendar integration (X9 / separate owner decision)
- No opaque re-ranking or ML from outcome data (that boundary belongs to N6 anyway, and even there
  the explicit rule is no unexplainable scoring change)

## 5. Dependencies

- **N1** (schema reconciliation) — new entities are new schema; ChatGPT must execute any resulting
  migration, and John will not sign off on this design touching production until the existing
  uncertain OE/CRM schema state is resolved.
- **N4** (product coherence pass) — should land first so the Command Center isn't built on top of
  two unexplained opportunity vocabularies.

## 6. Architecture considerations (John's review required before build)

- New tables require RLS from day one — Ethan's review is mandatory before any migration is
  drafted, not after.
- Follow the existing provenance/versioning conventions already proven elsewhere in the codebase
  (`engine_version`, entry IDs in `src/lib/profile/entryIds.ts`) rather than inventing new patterns.
- Keep the state machine's legal transitions in one place, tested explicitly, per Emily's existing
  hard rule — this is the primary failure mode for lifecycle systems (silent invalid states).

## 7. Security considerations (Ethan's mandatory review, not optional)

- Every new entity (`contacts`, interview records, offer records, follow-up history) needs RLS
  scoped to the owning member plus their assigned strategist(s) — same pattern as `applications`
  today.
- Contact records will contain third-party personal data (recruiter/hiring-manager names, possibly
  emails/phone) about people who are not FreshlyForward members — Ethan should confirm this doesn't
  create an unreviewed data-collection-about-non-users question.
- FreshFit-at-time-of-application snapshots must not become a second, drifting source of truth that
  contradicts the live explainability guarantees Priya owns for the current score.

## 8. UX requirements (Sarah's sign-off required)

- One member-facing lifecycle surface — not a second competing "opportunities" page. Coordinate
  directly with N4's opportunity-vocabulary unification so members see one coherent model, not two.
- "What needs my action today" must integrate with `nextBestMove.ts`, not duplicate it.
- Accessibility bar (WCAG 2.2 AA) applies to every new surface, same as everywhere else.

## 9. Test expectations (Nina's release gate)

- State-machine transitions: test every legal transition and explicitly test that illegal
  transitions are rejected (Emily's stated primary failure mode).
- RLS regression tests for every new table, following the existing pattern
  (`resumeVersionRpcNullAuthzRegression.test.ts`, `jobMatchesPolicyRegression.test.ts` are the
  house style to match).
- At least one E2E path (part of N8) covering: discover → save → apply → schedule interview →
  record outcome, in a real browser, not just unit-level.

## 10. Acceptance criteria

- [ ] Applications carry an explicit, tested lifecycle state machine
- [ ] A real interview entity exists (reusing or formally superseding `interview_prep`/
      `interview_feedback` — decision documented either way)
- [ ] A `contacts` entity exists, linked to applications, with RLS reviewed by Ethan
- [ ] Structured offer and rejection-reason records exist (taxonomy-based, not free text)
- [ ] `resume_version_id` is a visible, load-bearing fact on every application
- [ ] FreshFit score + explanation is snapshotted at time of application, versioned
- [ ] Strategist parity view exists for every new entity — no second data model for staff
- [ ] "Needs action today" reads from/feeds `nextBestMove.ts`, not a new competing system
- [ ] Schema designed with optional fields to attach email/calendar identifiers later, without a
      rework — but no integration built in this pass
- [ ] Full RLS test coverage; Nina's release gate passes; Ethan's security review is green
- [ ] No migration executed by anyone other than ChatGPT, and only after N1 resolves the existing
      schema uncertainty for the tables this feature touches
