# FreshlyForward Autonomous Engineering — Setup Guide

## Goal

Set up FreshlyForward so Code Puppy works continuously on the approved roadmap, reports through the same Outlook email thread, and ChatGPT coordinates the next step hourly with minimal owner involvement.

## Step 1 — Download the operating prompt

Open/download:

`FreshlyForward_CodePuppy_Autonomous_Operating_Prompt.md`

This is the standing instruction set for Code Puppy.

## Step 2 — Paste the operating prompt into Code Puppy

Give Code Puppy the entire contents of the operating prompt once.

At the end, confirm this starting instruction remains:

> Start by verifying current Git state and completing the outstanding Opportunity Engine 2.0 fast-forward into `main` according to the previously approved instructions. Do not begin another project until that release operation has been verified.

## Step 3 — Keep Code Puppy on one Outlook thread

All FreshlyForward progress reports, blockers, database handoffs, and completion messages should stay in the same Code Puppy email thread.

Expected direction:

From:
`c0b0sty.s02638.us@wal-mart.com`

To:
`mikebaileyhimself@outlook.com`

Do not create a new thread for every task.

## Step 4 — Add the GitHub First Gate to the team charter

Open/download:

`FreshlyForward_GitHub_First_Gate.md`

Add its full contents to:

`FRESHLYFORWARD_AI_TEAM.md`

Recommended placement:

Immediately after:

`## Core Rules`

and before:

`## Initial Workstreams`

## Step 5 — Make the GitHub gate permanent in Code Puppy

The supplied operating prompt already contains the mandatory rule:

> Before every new major project, Ryan Mitchell must complete the GitHub First Gate and produce the required report before John approves implementation.

No additional change is needed if you use the supplied prompt.

## Step 6 — Let OE2 close first

Code Puppy should verify:
1. `origin/main` is the expected pre-merge SHA.
2. `origin/opportunity-engine-2-phase0` is the approved OE2 SHA.
3. The feature branch is a true fast-forward from `main`.
4. Local `main` is fast-forwarded without creating a merge commit.
5. `main` is pushed normally — never force-pushed.
6. Local `main` and `origin/main` match the approved OE2 SHA.
7. The feature branch is preserved.

Then Code Puppy reports completion in the same email thread.

## Step 7 — Allow automatic roadmap progression

After OE2 is verified, the team should proceed in order:

1. ForwardOS — Command Center 2.0
2. Career Vault 2.0 / Career Story Bank / Capability Intelligence
3. Resume Studio
4. Career Application CRM / Application Command Center
5. Opportunity Intelligence Expansion
6. Resume Import → Career Vault improvements
7. Interview Learning Loop
8. Offer Intelligence / Negotiation
9. Follow-Up Engine
10. Company Intelligence
11. Ghost Job / Repost Intelligence
12. Job Legitimacy Intelligence
13. cohesive UX/public-site improvements
14. full QA/security/performance hardening
15. launch-readiness verification

Before EACH major project:

`CURRENT-STATE AUDIT → GITHUB FIRST GATE → DESIGN → PLAN → IMPLEMENT`

## Step 8 — Do not answer routine engineering questions yourself

The team should resolve internally:
- code decisions
- architecture within approved boundaries
- test failures
- TypeScript/build problems
- QA findings
- security fixes
- accessibility
- normal dependency decisions
- UI decisions within the approved design system
- documentation
- ordinary commits and feature-branch work

Decision flow:

`Specialist → John Carter → Alex Morgan`

## Step 9 — Only owner-level issues should reach you

Escalate to Mike only for:
1. major new product direction not covered by the roadmap
2. material paid service/vendor commitments
3. destructive or irreversible actions
4. unresolved legal/licensing ambiguity
5. production deployment or production database actions requiring authorization

## Step 10 — Keep Supabase execution with ChatGPT

Code Puppy may prepare:
- forward-only migrations
- tests
- fixtures
- RLS assertions
- advisor expectations
- migration execution manifests

Code Puppy must NOT apply them.

Handoff flow:

`Feature Owner → John → Ethan → migration/tests/manifest → Olivia → STOP → ChatGPT`

## Step 11 — Code Puppy completion format

Each completion email should include:

### PROJECT
### STATUS
### BRANCH
### HEAD
### COMPLETED
### QUALITY GATE
### DATABASE
### OWNER DECISION
### NEXT

This lets the hourly coordinator understand exactly what happened and issue the next instruction.

## Step 12 — Your normal involvement

Once configured, your normal workflow becomes:

`Code Puppy works → emails status → hourly ChatGPT loop reads it → team determines next step → Code Puppy receives next instruction → development continues`

You intervene only for owner-level escalation.
