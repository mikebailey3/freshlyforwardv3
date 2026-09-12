# FreshlyForward — Roadmap & Prioritization Synthesis
**Phases 13, 14, 15, 21, 22, 23** · Author: Alex Morgan (CEO / Product Director) · Date: 2026-09-12
**Mode:** READ-ONLY / DOCUMENTATION-ONLY per owner instruction. No product code, no roster changes, no migrations.

## Inputs actually read before writing this

| Source | Author | What I took from it |
|---|---|---|
| `01-repo-architecture-audit.md` | John Carter | Classification table (A–F), duplication findings D-01…D-14, §17 architecture review, the blocking-work list |
| `02-ux-product-walkthrough.md` | Sarah Chen | P1/P2 findings, member/strategist journey verdicts, retention gaps |
| `03-competitive-oss-research.md` | Ryan Mitchell | 16-competitor matrix, 8 OSS candidates + classifications, the three validated market problems |
| `04-security-privacy-review.md` | Ethan Cole | 5 carried-forward findings, expansion-idea privacy constraints |
| `05-qa-testing-review.md` | Nina | Verified build/test output, NOT-READY release verdict and its 5 reasons |
| `06-seo-growth-review.md` | Jordan Lee | SPA crawlability block, Career Compass as the acquisition surface, the anti-programmatic-lander recommendation |
| `docs/FreshlyForward_Competitive_Intelligence_Registry.md` | — | TheLadders entry, anti-copy guardrail, escalation flags |
| `PRODUCT.md` | — | Positioning: premium, human-led concierge; explicitly not mass-apply |
| My two plans (roadmap redesign, ForwardOS Home) | Alex Morgan | Locked decisions I must not contradict |

**Confidence note.** I did not re-run the build or the test suite; I am relying on John's and Nina's independently-run, matching outputs (build clean, 219 files / 1429 tests green). Every claim below traces to one of the documents above. Where I am making a judgement rather than reporting evidence, I say so.

---

## The one sentence that governs this entire roadmap

**FreshlyForward's problem is not a shortage of features. It is a shortage of *verified* features.**

John classified large parts of the product as **C (PARTIAL)** and said explicitly that several of them "may actually be A" — they are C *only* because 22 of 46 migrations are marked NOT APPLIED and nobody can state what the live schema is. Nina independently reached NOT-READY. Sarah found the member journey conceptually sound with execution defects. Ryan found no competitor doing what we do, and no OSS worth adopting wholesale.

That is an unusual and genuinely good position: the hard part (a coherent canonical career model with provenance, evidence states, and AI-safety boundaries) is built. The cheap part (proving it, finishing it, telling the truth about it on screen) is not.

So this roadmap deliberately front-loads **completion and verification** over **new capability**, and I am going to defend that against the natural pull toward the exciting items. Building Interview Intelligence on top of an unverified schema would be building the second floor before confirming the first floor exists.

---

# Phase 13 — Feature opportunity discovery

Candidates assembled from the intersection of: what's PARTIAL in the repo, what members hit in Sarah's walkthrough, what the market validated in Ryan's matrix, and what the canonical chain can already feed. **Discovery only — nothing here is approved by appearing in this list.**

### From the brief (considered, not pre-approved)
1. **Career Passport** — reusable structured application answers derived from canonical data
2. **External Job Capture** — paste a URL, bring it into the Opportunity Engine
3. **Browser Extension** — capture from any job page
4. **Application Command Center** — full lifecycle Discovered → Saved → Preparing → Applied → Follow-up → Interview → Offer/Rejected/Withdrawn
5. **Interview Intelligence** — role/company-specific questions, STAR selection from Career Vault, mock interviews, scorecards, learning loop
6. **Networking CRM** — contacts, relationships, touch history
7. **Career Evidence Intelligence** — weak-evidence detection, accomplishment prompts
8. **Opportunity Intelligence Expansion** — more providers, freshness scoring, dedup, company/salary/geo intelligence
9. **Career Progress Analytics** — member-facing progress over time
10. **Job Search Autopilot** — recommended actions (explicitly *not* full-auto mass-apply)

### Surfaced by the audit itself (not in the brief, and several matter more)
11. **Schema Reconciliation Ledger** — definitive applied/not-applied state for all 46 migrations (John §17.5, Ethan #1, Nina)
12. **Dashboard Truth Fix** — the dashboard currently tells members "Career Vault — coming soon" about a *shipped* feature (D-05)
13. **Member-Trust Correctness Pack** — unread filter lies, attachment can silently fail, modal has no focus trap, unsafe URL sink (Sarah P1/P2 + Ethan)
14. **Product Coherence Pass** — two readiness numbers (D-01), two opportunity vocabularies (D-04)
15. **Outcome Learning Loop** — rejections/offers/interview results are dead-end columns; FreshFit learns nothing from what actually happened (John §3.1)
16. **Saved Opportunities** — there is dismiss, but no save (John 2.2)
17. **Minimum Product Analytics** — currently zero instrumentation (John §17.14)
18. **E2E Journey Coverage** — no Playwright specs exist (Nina)
19. **Bundle Code-Splitting** — 3.6MB single chunk + 1.6MB pdfjs on the marketing homepage (John §17.9)
20. **Public-Route Prerendering** — the precondition for any SEO work at all (Jordan P1)
21. **OE 2.0 As-Built Doc** — the plan that code cites as the authority for locked thresholds does not exist (D-06)
22. **Strategist Console Upgrade** — URL-addressable tabs, batched loads, prefilled Friday drafts (Sarah P2)
23. **Notification / Email Provider Activation** — pipeline built, deliberately unplugged, currently logs false "sent" records (John §17.17, Ethan #4)
24. **ATS Fit Feedback (narrow)** — the single validated capability from Ryan's OSS scan with a clean home in Resume Intelligence
25. **Offer Intelligence** — structured offer comparison; `offer_details` is one free-text column today
26. **Public Resource Pages (small set)** — Jordan's five editorial candidates, explicitly not programmatic landers

---

# Phase 14 — The CareerOS test

Seven questions, applied honestly. A candidate has to earn its place; "it's a good idea" is not a passing grade.

## Passed — build these

### Application Command Center
- **Real problem?** Yes. John: "Career CRM is an application tracker, not a CRM." Interviews are a *filtered view of applications by status* — one interview per application, no rounds. Offers and rejections are single free-text/enum columns.
- **Strengthens CareerOS?** Yes — it is the missing spine between Opportunity Engine and every downstream learning loop.
- **Uses canonical intelligence?** Yes: `applications`, `opportunities`, `job_matches`, FreshFit scores, strategist authorization states all already exist.
- **Improves another system?** Yes, decisively — it is the **precondition** for Outcome Learning, Interview Intelligence, and Offer Intelligence. Nothing downstream can be built on a status enum.
- **Repeat use?** Yes, it is the highest-frequency member surface in the product.
- **Better than a standalone competitor because of shared data?** Yes. Huntr and Teal have a tracker the member fills in. Ours is populated by a strategist doing real work, scored by FreshFit, and grounded in Career Vault evidence. Same UI category, categorically different content.
- **Worth the complexity?** Yes. This is the single best complexity-to-unlock ratio in the whole audit.

### Outcome Learning Loop
- **Real problem?** Yes, and it's the one John called "the biggest missed intelligence loop in the product — the data is *right there*."
- **Moat?** Highest of any candidate. Six months of *outcomes* attached to scored opportunities is something no competitor and no ChatGPT session can reconstruct.
- **Complexity?** Moderate, and entirely additive to the Command Center. **Hard dependency:** it cannot exist before structured rejection reasons and interview rounds exist.

### Career Passport
- **Real problem?** Yes — validated by Ryan (Ladders' reusable application info; Simplify/Huntr autofill) and structurally native to us.
- **Uses canonical intelligence?** This is the purest expression of the canonical chain in the entire candidate list. Career Vault evidence + Forward DNA states + master resume entries → reusable, provenance-tracked structured answers.
- **Better because of shared data?** Overwhelmingly. A competitor's autofill replays text you typed. Ours composes answers from *evidence-state-weighted* career facts with provenance. That difference is the product.
- **Strategist leverage?** Very high — it is the thing that makes hand-crafted applications faster without making them generic.
- **Caveat I'm imposing:** Passport must reuse the existing `validateGroundedProposal` / anti-fabrication discipline. A Passport that invents answers destroys the brand promise faster than any feature could build it.

### Career Evidence Intelligence
- **Real problem?** Yes. Forward DNA has a claimed → demonstrated → supported state machine and Career Vault has capability inference, but nothing proactively tells a member *which* claims are weak.
- **Improves another system?** Yes — directly raises Forward Score's evidenceQuality pillar (weight .30), FreshFit confidence, and resume grounding. It makes three existing systems better without adding a fourth.
- **Complexity?** Low-to-moderate. The state data already exists; this is largely surfacing and prompting.

### Interview Intelligence v1
- **Real problem?** Yes. Ryan found four competitors in this space; Sarah found mock interviews are an island; John found "no connection to applications, interviews, or gap intelligence — despite gap intelligence knowing exactly which skills a member keeps missing."
- **Better because of shared data?** Yes, and this is the clearest "only we can do this" case in the audit: **STAR story selection from the member's own Career Vault wins, targeted at the specific role they actually applied to, informed by the gaps FreshFit already identified.** Final Round AI cannot do that; it has no vault and no application history.
- **Scoped hard:** v1 is question sets + Vault-grounded STAR selection + strategist-visible scorecards. **Not** a chatbot. **Not** audio/video (Ethan: major new privacy surface requiring consent/retention/legal review — that's a separate owner decision, deliberately out of v1).
- **Dependency:** needs a real interview entity. Blocked on the Command Center.

### External Job Capture
- **Real problem?** Yes — validated across Simplify, Careerflow, career-ops, and it is the natural member behavior ("I found this myself, what do you think?").
- **Strengthens CareerOS?** Yes: a member-found URL enters the same FreshFit scoring and the same strategist review path as an engine-found job. One pipeline, two entry points.
- **Reuses existing systems?** Yes — `jobSubmission.ts` already exists, `jobNormalization` and `jobDeduplication` are A-grade and tested.
- **Security note carried from Ethan:** member-submitted URLs are untrusted input. Validation is non-negotiable, not a polish item.

### Opportunity Intelligence Expansion (scoped)
- Freshness scoring, dedup hardening, and folding Adzuna into the liveness sweep (D-03) all pass: they fix a *real data-quality asymmetry* (Adzuna postings can be 45 days stale vs ~18h for ATS sources) using existing machinery.
- **New providers and salary/company/geo intelligence do not pass yet** — see RESEARCH/HOLD. Adding providers before we know whether anyone uses the engine is guessing, and the Adzuna licensing question is still owner-deferred.

### Guided Next Actions (the honest version of "Autopilot")
- `nextBestMove.ts` already exists and works. Extending it to span the full application lifecycle — with member-visible reasoning — passes every test: real problem, uses canonical data, improves the dashboard, repeat use, and it is *on-brand* in a way automation is not.
- **This is what I am approving instead of Autopilot.** See rejections.

### Strategist Console Upgrade
- Lower member value, but the highest **strategist leverage** score in the list, and strategist throughput is literally the unit economics of a concierge business. Sarah's P2s (URL-addressable tabs, batched loads) plus prefilled Friday report drafts.

## Rejected — and why

I am rejecting these explicitly, on the record, so nobody re-proposes them without new evidence.

| Rejected | Why |
|---|---|
| **Job Search Autopilot (full-auto mass-apply)** | **Rejected on positioning, not feasibility.** PRODUCT.md's differentiator is "100% human-led, hand-crafted applications, explicitly not AI mass-applying," positioned by name against mass-application services. Building auto-apply would not be a feature; it would be a repudiation of the wedge. The brief already flagged this needs a deliberate trust/compliance decision — I am not making that decision, I am rejecting it within current strategy and **flagging any future reconsideration as owner escalation** (new major product direction). The underlying pain is real; Guided Next Actions is the on-brand answer. |
| **Browser Extension** | **Rejected for now — YAGNI, and the wrong shape of bet.** It is a separate distribution channel, a separate review/store process, a separate security surface, and a permanent maintenance tax, all to save a copy-paste. External Job Capture delivers ~80% of the value at ~15% of the cost. Revisit only if capture volume proves the paste step is a real drop-off point — and we cannot know that today because we have zero analytics. |
| **Full Networking CRM** | **Rejected at full scope; a narrow contacts capability survives to LATER.** Contacts are genuinely absent (John: class E). But a real relationship CRM — pipelines, sequences, enrichment — is a second product with its own data model and its own maintenance burden. Ryan found *no public evidence* Ladders even has this. High maintenance, unproven demand, low strategic value at full scope. |
| **Generic AI career chatbot** | **Rejected outright.** A disconnected AI wrapper. It would compete with our own strategists, dilute the human-led promise, and make claims our anti-fabrication architecture exists specifically to prevent. This is the canonical example of what the CareerOS test is designed to catch. |
| **Adopting OpenResume** | **Rejected — license.** AGPL-3.0 on a hosted proprietary service. Ryan classified it REJECT; I am ratifying that as a product decision, not just an engineering one. Useful as a UX benchmark only. |
| **Porting JobNavigator / career-ops architecture** | **Rejected as architecture, retained as inspiration.** Charter rule 2 and 3: upgrade FreshlyForward, never replace it with an external platform. Both are Python/CLI-shaped and automation-first. Ryan's classifications (ADAPTABLE / INSPIRATION ONLY) stand. |
| **Programmatic role/industry SEO landers** | **Rejected.** Jordan recommended against it and asked for a product call: here it is. Mass thin content contradicts "fewer, better" (Product Principle 2) and would cheapen a premium concierge brand. A small set of genuinely useful resource pages is the approved shape. |
| **Recruiter / employer-facing side** | **Not rejected — escalated.** Ryan and the Ladders registry both flag dual-sided monetization as a genuinely different business model. Ethan flags it as a major new privacy surface. This is a new-major-product-direction question and **not mine to decide.** Owner escalation. |
| **Interview audio/video recording** | **Out of v1 scope; escalate if ever proposed.** Ethan: needs explicit consent, retention rules, access controls, and probably dedicated legal/privacy review. |
| **State-management library / backend API layer / schema merge of `opportunities` + `job_matches`** | **Rejected as motion, not progress** — ratifying John's explicit YAGNI list. I will not let a roadmap turn into a refactor program. |
| **Premium-tier gating of core canonical-chain features (Ladders/Apply4Me pattern)** | **Escalated, not decided.** The registry already flags this as owner review. Entitlements infrastructure exists; whether to *use* it to gate core chain features is a pricing/strategy decision above my seat. |

---

# Phase 15 — Moat analysis

## What FreshlyForward can know about a member after six months that nothing else can

A generic job board knows what you clicked. A resume tool knows one document. A ChatGPT session knows what you pasted into it, and forgets. After six months on FreshlyForward, the system holds:

1. **Evidence-graded skills, not claimed skills.** Forward DNA's claimed → demonstrated → supported state machine with `STATE_WEIGHT`, reconciled across four sources with written, tested precedence rules (D-08). Nobody else distinguishes "I can do X" from "here is the win that proves X."
2. **A vault of specific accomplishments with inferred capabilities and provenance.** `career_win_capabilities` with confirmed/pending/rejected states and `inference_reason`. This is the raw material for resumes, Passport answers, and STAR stories — and it is a real asset that compounds.
3. **A longitudinal record of what they were actually shown and why.** Every `job_match` carries an explainable six-dimension FreshFit breakdown, a confidence value, an `engine_version`, and a rank highlight. Six months of that is a scored, versioned history of fit.
4. **What they rejected and what rejected them** — *once the Outcome Learning Loop exists.* Today this is the gap. Rejection reasons, offer outcomes, and interview results are dead-end columns, so the richest signal in the system is being thrown away daily.
5. **Recurring gap intelligence.** `recurringGaps.ts` already aggregates which qualifications a member keeps missing. Six months of that is a career-development plan that writes itself.
6. **Human judgement, recorded.** Strategist notes, `why_it_matches`, `potential_concerns`, authorization decisions, and every Friday report. This is the genuinely unreplicable layer: a trained human's reasoning about *this specific person*, accumulated and attached to canonical data. No LLM has this. No job board has this.
7. **Career direction over time.** Career Compass readiness scores and archetype, re-taken as the member evolves.
8. **Provenance for nearly every derived fact** (John §17.13). We can explain where a claim came from. That is rare, and it is the foundation of trust in a premium service.

## The investments that deepen the moat (ranked by moat contribution)

1. **Outcome Learning Loop** — converts six months of *activity* into six months of *evidence about what works for this person*. Largest single moat gain available. Currently a dead end.
2. **Career Passport** — turns the vault from a record into an asset the member actively reuses, which drives them to *improve* it, which deepens the data, which improves everything downstream. A genuine compounding loop.
3. **Interview Intelligence** — the only feature where "we know your wins AND the specific role AND your recurring gaps" produces something a standalone tool structurally cannot imitate.
4. **Career Evidence Intelligence** — directly raises the quality of the moat's raw material rather than just consuming it.
5. **Application Command Center** — not a moat by itself; it is the *substrate* the three above are written on.
6. **Minimum analytics** — an indirect but real moat investment: we currently cannot tell which parts of the moat members actually touch.

**Moat risk to state plainly:** the moat is made of data the product currently cannot prove is persisted correctly, because 22 migrations are of unknown live status. A moat you cannot verify is a claim, not a moat. That is why N1 is sequenced first despite a middling priority score.

---

# Phase 21 — Scoring

**Scale:** 1–10 each. **Risk is inverted** (10 = lowest risk) so that higher is better across every column and the weighted sum is directionally honest.

**Weights (my judgement, stated openly so they can be argued with):** Member Value ×2.0, CareerOS Synergy ×1.5, Data/Moat ×1.5, Competitive Differentiation ×1.25, Retention ×1.25, Strategist Leverage ×1.0, Technical Feasibility ×1.0, Time-to-Value ×1.0, Revenue ×0.75, Risk(inv) ×0.75. Member Value is double-weighted deliberately: novelty must not outrank usefulness, which is an explicit requirement of this phase.

| Project | MV | CD | SYN | RET | REV | SL | TF | TTV | MOAT | Risk(inv) | Priority |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| N6 Outcome Learning Loop | 8 | 10 | 10 | 8 | 7 | 8 | 6 | 4 | 10 | 6 | **8.0** |
| X3 Interview Intelligence v1 | 9 | 8 | 9 | 8 | 8 | 9 | 6 | 5 | 9 | 6 | **8.0** |
| X4 Career Evidence Intelligence | 8 | 8 | 10 | 8 | 5 | 8 | 7 | 7 | 9 | 8 | **8.0** |
| N5 Application Command Center | 9 | 7 | 9 | 9 | 7 | 9 | 6 | 5 | 9 | 6 | **7.9** |
| X2 Career Passport | 8 | 8 | 10 | 7 | 6 | 9 | 6 | 6 | 9 | 7 | **7.8** |
| X1 External Job Capture | 9 | 7 | 9 | 8 | 6 | 8 | 6 | 6 | 8 | 6 | **7.6** |
| X8 Guided Next Actions | 8 | 6 | 9 | 9 | 6 | 7 | 7 | 7 | 7 | 7 | **7.5** |
| X5 Opportunity Intel Expansion (scoped) | 8 | 6 | 8 | 7 | 5 | 7 | 7 | 6 | 7 | 6 | **6.9** |
| X7 Strategist Console Upgrade | 6 | 6 | 7 | 6 | 7 | 10 | 8 | 8 | 5 | 8 | **6.9** |
| N4 Product Coherence Pass | 8 | 5 | 8 | 7 | 4 | 6 | 8 | 8 | 4 | 8 | **6.7** |
| N1 Schema Reconciliation Ledger | 6 | 3 | 9 | 4 | 5 | 7 | 8 | 9 | 7 | 9 | **6.6** |
| X6 ATS Fit Feedback (narrow) | 7 | 5 | 7 | 6 | 6 | 6 | 7 | 7 | 5 | 7 | **6.3** |
| L1 Networking Contacts (lite) | 6 | 5 | 7 | 6 | 5 | 7 | 7 | 6 | 6 | 7 | **6.2** |
| X9 Notification / Email Activation | 7 | 3 | 6 | 9 | 6 | 6 | 7 | 7 | 4 | 6 | **6.1** |
| L3 Member Progress Analytics | 6 | 5 | 7 | 7 | 4 | 5 | 7 | 6 | 6 | 8 | **6.1** |
| L2 Offer Intelligence | 7 | 6 | 6 | 5 | 6 | 7 | 5 | 5 | 6 | 6 | **6.0** |
| N7 Minimum Product Analytics | 4 | 3 | 6 | 5 | 6 | 7 | 8 | 8 | 6 | 7 | **5.7** |
| N3 Member-Trust Correctness Pack | 8 | 3 | 4 | 6 | 3 | 4 | 9 | 9 | 2 | 9 | **5.6** |
| N2 Dashboard Truth Fix (D-05) | 7 | 2 | 5 | 5 | 3 | 3 | 10 | 10 | 2 | 10 | **5.5** |
| N9 Bundle Code-Splitting | 7 | 4 | 4 | 5 | 6 | 3 | 9 | 9 | 2 | 9 | **5.5** |
| N11 OE 2.0 As-Built Doc (D-06) | 3 | 2 | 7 | 2 | 2 | 5 | 10 | 9 | 5 | 10 | **5.2** |
| N8 E2E Journey Coverage | 5 | 2 | 5 | 4 | 4 | 5 | 8 | 7 | 3 | 9 | **4.9** |
| N10 Public-Route Prerendering | 5 | 6 | 4 | 3 | 8 | 2 | 6 | 6 | 4 | 7 | **4.9** |
| L4 Public Resource Pages (small set) | 4 | 4 | 3 | 3 | 7 | 3 | 8 | 7 | 3 | 8 | **4.6** |

*(Weights and inputs above are reproducible arithmetic; a throwaway calc script was used and removed rather than left in `scripts/` — the repo already carries a D-11 finding about abandoned tmp scripts and I am not adding to it.)*

### Reading the scores honestly

**The score is an input to the sequence, not the sequence.** Three deliberate overrides:

- **N2 Dashboard Truth Fix scores 5.5 and ships first anyway.** The product currently makes a false statement to paying members about a feature that exists. Cost: hours. There is no defensible ordering where a 7.9-scoring feature outranks removing a lie from the dashboard.
- **N1 Schema Reconciliation scores 6.6 and gates everything above it.** Low differentiation, low retention, unglamorous — and John will not sign off on any OE/Resume completion claim without it. A high-scoring feature built on unverified schema is unverifiable work.
- **N10 Prerendering scores 4.9 and stays in NOW.** Low member value by construction (members are already logged in), but it is the sole precondition for an entire growth function. Jordan cannot deliver anything without it. Deferring it doesn't save cost; it just idles a specialist.

---

# Phase 22 — Roadmap

## NOW — finish before launch

Not "everything we'd like." These are the items where shipping without them means shipping something unverified, untrue, or untested.

| # | Project | Rationale |
|---|---|---|
| N1 | **Schema Reconciliation Ledger** | 22/46 migrations unknown; gates every C-classification. DB Lead (ChatGPT) only, per charter rule 9. |
| N2 | **Dashboard Truth Fix (D-05)** | Members are told a shipped feature doesn't exist. Includes correcting the test that pins the wrong state. |
| N3 | **Member-Trust Correctness Pack** | Unread filter that doesn't filter; attachments that silently fail; modal with no focus trap; unlabeled dead search box; unsafe URL sink in Notifications. |
| N4 | **Product Coherence Pass (D-01, D-04)** | Two readiness numbers on one dashboard; two opportunity vocabularies with no explanation. Decided below. |
| N5 | **Application Command Center** | The one genuinely major *capability* in NOW. Everything valuable in NEXT depends on it. |
| N7 | **Minimum Product Analytics** | We are about to prioritize a roadmap with zero usage data. Thin, privacy-respecting event layer only. |
| N8 | **E2E Journey Coverage** | Nina's release gate. Core member journey has never been verified in a browser. |
| N9 | **Bundle Code-Splitting** | 3.6MB chunk + 1.6MB pdfjs on the marketing homepage. Highest-ROI technical fix in the audit; also a precondition for N10 being worth anything. |
| N10 | **Public-Route Prerendering** | Unblocks the entire organic-growth function. Public routes only. |
| N11 | **OE 2.0 As-Built Doc (D-06)** | Locked thresholds currently cite a plan file that does not exist. Governance, not polish. |
| N6 | **Outcome Learning Loop** | Highest-scoring item in the audit, and it only needs the Command Center's schema. Sequenced last in NOW because of that dependency — see Phase 23. |

### Two product decisions I am making now, inside approved strategy

**D-01 — resolved.** `calculateSearchReadiness` is renamed to **Profile Completeness**; **Forward Score owns "readiness."** It is literally a 19-field completeness checklist; calling it readiness alongside a richer evidence-aware score is a member-facing coherence failure. This is a rename plus copy, no logic change, and it does not touch the ForwardOS locked decision that the two scores stay separate — it *clarifies* it. Ratifies John's recommendation.

**D-04 — resolved.** Keep both tables (John is right that machine-discovered candidates and human-curated opportunities genuinely differ). **Unify the member-facing vocabulary into one surface** with two clearly-labelled sources: "Found for you" (engine) and "Chosen by your strategist" (curated). Do not merge schemas. The member should never have to learn our internal data model to understand their own opportunities.

## NEXT — high-impact post-foundation

| # | Project | One-line case |
|---|---|---|
| X1 | **External Job Capture** | Member-found jobs enter the same scoring and strategist review path as engine-found ones. |
| X2 | **Career Passport** | The purest expression of the canonical chain; makes hand-crafted applications faster without making them generic. |
| X3 | **Interview Intelligence v1** | Vault-grounded STAR selection against the specific role. The clearest "only we can do this" in the audit. |
| X4 | **Career Evidence Intelligence** | Weak-evidence detection; raises Forward Score, FreshFit confidence, and resume grounding at once. |
| X8 | **Guided Next Actions** | The on-brand answer to Autopilot. Extends existing `nextBestMove` across the lifecycle. |
| X7 | **Strategist Console Upgrade** | Highest strategist-leverage item; strategist throughput is the unit economics of a concierge business. |
| X5 | **Opportunity Intel Expansion (scoped)** | Freshness scoring, dedup hardening, Adzuna into the liveness sweep (D-03). New providers explicitly excluded. |
| X6 | **ATS Fit Feedback (narrow)** | One validated capability from the OSS scan, with a clean home in Resume Intelligence. Not a resume-optimization SaaS. |
| X9 | **Notification / Email Provider Activation** | Pipeline is built and deliberately unplugged. Provider choice is an owner decision (paid vendor). |

## LATER — strategic expansion, not urgent

- **L1 Networking Contacts (lite)** — contacts + touch history attached to applications. Explicitly not a relationship CRM.
- **L2 Offer Intelligence** — structured offer comparison; depends on the Command Center's offer entity.
- **L3 Member Progress Analytics** — member-facing "how far have I come," honest only once outcome data exists.
- **L4 Public Resource Pages** — Jordan's five editorial pieces, authored properly, after prerendering.
- **Skill taxonomy / entity promotion** — only when a real need appears (John's YAGNI note stands).
- **Interview attribution & completed-state for Roadmap milestones** — deferred follow-ups already documented in my roadmap plan; they need a migration to be truthful.

## RESEARCH / HOLD — needs more evidence before it can be scored fairly

- **Browser Extension** — hold until capture analytics prove the paste step is a real drop-off. Cannot be known today.
- **New job providers beyond the current four** — hold until analytics show engine usage; Adzuna licensing is separately owner-deferred.
- **Salary / company / geo intelligence** — genuinely useful (Ryan: Levels.fyi, Glassdoor), but every credible source implies a paid data vendor. Research the sourcing question before scoping the feature.
- **Live competitor re-verification** — Ryan's matrix and the Ladders entry are both medium-confidence because browser tooling failed. Re-check before any decision leans on a specific competitor's pricing or feature set.
- **Public Forward Profile indexability** — a privacy and consent question (Jordan + Ethan), not a growth question. Needs Ethan's review before it becomes a roadmap item.

## REJECTED — investigated and deliberately declined

Full reasoning in Phase 14. Summary: **full-auto mass-apply** (repudiates the positioning), **browser extension at this time** (YAGNI; capture covers 80% at 15% of cost), **full Networking CRM** (second product, unproven demand), **generic AI career chatbot** (disconnected wrapper, competes with our own strategists), **OpenResume adoption** (AGPL), **porting JobNavigator/career-ops architecture** (charter rules 2–3), **programmatic SEO landers** (contradicts "fewer, better"), **state-management library / backend API layer / schema merge** (motion, not progress).

---

# Phase 23 — Build sequence

Sequenced by **real dependency**, then by priority within each tier. The rule applied: *if X unblocks Y, X ships first even if Y scores higher.*

```
TIER 0 (parallel, no dependencies, days not weeks)
  N1 Schema Reconciliation ──┐   N2 Dashboard Truth Fix
  N11 OE 2.0 As-Built Doc    │   N3 Member-Trust Correctness Pack
                             │   N9 Bundle Code-Splitting
TIER 1 (needs N1)            │
  N4 Product Coherence ──────┤   N7 Minimum Analytics
  N8 E2E Coverage ───────────┤   N10 Prerendering (needs N9)
TIER 2 (needs N1 + N4)       │
  N5 Application Command Center ◄┘
TIER 3 (needs N5)
  N6 Outcome Learning Loop · X3 Interview Intelligence v1 · X8 Guided Next Actions
TIER 4 (needs N5 + evidence layer)
  X1 External Capture · X2 Career Passport · X4 Evidence Intelligence · X7 Strategist Console
```

### Why this order and not score order
- **N1 first** because John will not sign off on any OE/Resume completion claim without it, and five NOW items touch schema he cannot currently vouch for.
- **N2/N3/N9 in parallel** because they are small, independent, and each removes something actively harming member trust or performance. There is no reason to queue them behind anything.
- **N4 before N5** because building a full lifecycle surface on top of two unexplained opportunity vocabularies bakes the confusion into a bigger surface.
- **N5 before N6/X3** because rejection reasons, interview rounds, and offers must be *entities* before anything can learn from them. This is the single most important sequencing constraint in the document.
- **N9 before N10** because prerendering a 3.6MB bundle produces crawlable HTML attached to a poor experience — the SEO win would be immediately undercut by Core Web Vitals.

---

## NOW / NEXT project definitions

### N1 — Schema Reconciliation Ledger
- **Objective:** a definitive applied/not-applied ledger for all 46 migrations, plus explicit confirmation of whether the 6 OE security-hardening migrations are live.
- **User problem:** indirect but severe — members may be relying on protections and persistence that exist only in repo intent.
- **Evidence:** John §17.5 and §1.5 (22 files marked NOT APPLIED); Ethan finding #1; Nina ("no test can tell us what is actually applied").
- **Builds on:** existing `supabase/migrations/` and the static text-based regression tests.
- **Scope:** read live schema, diff against the 46 files, produce the ledger, flag divergences. Forward-only migration-application tests against a fresh DB (Nina's suggestion) may be added as repo-side work.
- **Exclusions:** no migrations executed against production without owner approval; no schema changes as part of this task.
- **Dependencies:** none. **Owner:** ChatGPT (Supabase/DB Lead) — charter rule 9, exclusively. **Collaborators:** John (review), Ethan (security confirmation), Nina (test strategy).
- **Member impact:** none directly; unblocks everything else and converts several C classifications to A or to real work items.

### N2 — Dashboard Truth Fix (D-05)
- **Objective:** remove the false "Career Vault — coming soon" placeholder and replace it with a real Career Vault preview card.
- **User problem:** the dashboard tells paying members a shipped feature doesn't exist.
- **Evidence:** John D-05 (`DashboardPage.tsx:248-253,552-568`); Nina confirmed `DashboardPage.test.tsx` actively pins the wrong state.
- **Builds on:** shipped `/career-vault` route and `src/components/careerVault/`.
- **Scope:** replace the card; update the test so it no longer enshrines the stale state.
- **Exclusions:** no wider dashboard redesign. **Note:** `DashboardPage.tsx` and `src/components/forwardScore/**` are locked surfaces under my roadmap-redesign plan; this is a deliberate, scoped exception to fix an untruth, not an opening to redesign the page.
- **Dependencies:** none. **Owner:** front-end delivery. **Collaborators:** Sarah (copy/preview design), Nina (test correction).
- **Member impact:** immediate; removes the single most visible untruth in the product.

### N3 — Member-Trust Correctness Pack
- **Objective:** fix the five defects where the UI misrepresents state or fails silently.
- **User problem:** members can miss strategist messages, believe a file was attached when it wasn't, get trapped behind a modal, and click a search box that does nothing.
- **Evidence:** Sarah P1 ×3 (search, focus trap, unread filter), P2 (attachment); Ethan (unsafe `notification.link` sink).
- **Builds on:** `MessagesPage`, `AddCareerWinModal`, `MemberLayout`, `NotificationsPage`, existing `isSafeHttpUrl()`.
- **Scope:** real unread computation; blocking attachment errors; focus trap + focus restore; label or remove the global search; apply `isSafeHttpUrl()` to notification links.
- **Exclusions:** no global search *feature* build — labelling or removal only. Building search is a separate, unscored project.
- **Dependencies:** none. **Owner:** front-end delivery. **Collaborators:** Sarah (a11y sign-off), Ethan (URL sink verification).
- **Member impact:** high for trust, low for novelty. Exactly the right trade before launch.

### N4 — Product Coherence Pass (D-01, D-04)
- **Objective:** one readiness number with a clear meaning; one opportunity vocabulary with two labelled sources.
- **User problem:** two competing 0–100 scores on one dashboard, and two pages whose difference is never explained.
- **Evidence:** John D-01, D-04; Sarah's flagged items.
- **Builds on:** Forward Score, `calculateSearchReadiness`, `/opportunities`, `/opportunity-engine`.
- **Scope:** rename Search Readiness → Profile Completeness across member-facing copy; unify opportunity presentation with source labelling.
- **Exclusions:** **no change to `calculateSearchReadiness`'s calculation, its column, its badge trigger, or any admin/strategist consumer** — the ForwardOS locked decision and its regression suite stand. No schema merge of `opportunities`/`job_matches`.
- **Dependencies:** N1 (touches surfaces whose schema state is unconfirmed). **Owner:** Sarah (naming/IA) + front-end delivery. **Collaborators:** John (regression-suite implications).
- **Member impact:** the product stops contradicting itself. Cheap, high clarity.

### N5 — Application Command Center
- **Objective:** promote the application lifecycle from status enum to first-class entities: Discovered → Saved → Preparing → Applied → Follow-up → Interview → Offer → Rejected/Withdrawn.
- **User problem:** members can't tell what needs action; interviews can't have rounds; there's no "saved"; rejection reasons and offers have nowhere structured to live.
- **Evidence:** John 2.2/2.5 (interviews are a filtered view; contacts class E; "no saved concept at all"; offers/rejections single columns); Sarah Phase 6; Ryan (job-search CRM = validated market problem #1).
- **Builds on:** `applications`, `operations.ts`, `opportunities`, `job_matches`, strategist authorization model.
- **Scope:** real interview entity (rounds, type, date, notes); structured rejection reasons; structured offer record; saved state; follow-up history; one member lifecycle surface; strategist parity view.
- **Exclusions:** no contacts/networking (LATER). No auto-apply, ever. No offer *comparison* UI yet (L2). No email/calendar integration (X9 / separate).
- **Dependencies:** N1, N4. Requires new schema → **ChatGPT executes any migration, nobody else.** **Owner:** John (architecture) + delivery specialist. **Collaborators:** Sarah (lifecycle UX), Ethan (RLS on new entities), Nina (E2E).
- **Member impact:** the highest-frequency surface in the product finally matches how a real search works — and it is the foundation for three NEXT features.

### N6 — Outcome Learning Loop
- **Objective:** close the loop from application outcomes back into FreshFit, gap intelligence, and Forward Score.
- **User problem:** the product doesn't get smarter about a member from what actually happens to them.
- **Evidence:** John §3.1 finding #1 — "the biggest missed intelligence loop in the product — the data is *right there*."
- **Builds on:** N5's structured outcomes, `recurringGaps.ts`, `freshFitScore/confidence.ts`, `engine_version` on `job_matches`.
- **Scope:** capture structured outcomes; aggregate into member-level signal; feed gap intelligence and strategist context; expose honestly to the member.
- **Exclusions:** **no opaque personalized re-ranking in v1.** FreshFit's explainability is a core asset; any outcome-driven scoring change must remain explainable and versioned. No cross-member ML.
- **Dependencies:** N5 (hard). **Owner:** John + Opportunity Engine specialist. **Collaborators:** Ethan (aggregation privacy), Nina.
- **Member impact:** the difference between a tool that records your search and a system that learns from it. Largest moat gain available.

### N7 — Minimum Product Analytics
- **Objective:** a thin, privacy-respecting event layer answering "which surfaces do members actually use?"
- **Evidence:** John §17.14 ("You are about to plan major product expansion with zero usage data"); Ethan's constraint: minimal, aggregated, non-sensitive.
- **Scope:** a small named event set on core surfaces; aggregate reporting. **Exclusions:** no third-party analytics SDK without owner approval (potential vendor commitment); no PII in events; no session recording.
- **Dependencies:** none technically; do it early so NEXT is informed by data. **Owner:** John. **Collaborators:** Ethan (mandatory review).

### N8 — E2E Journey Coverage · N9 — Bundle Code-Splitting · N10 — Public-Route Prerendering · N11 — OE 2.0 As-Built Doc
Scoped exactly as Nina, John, and Jordan specified; owners Nina, John, John+Jordan, and John respectively. N9 before N10. N10 covers public routes only and explicitly excludes `/u/:username` indexing pending Ethan's privacy review.

### X1 — External Job Capture
- **Objective:** paste a job URL; it enters the Opportunity Engine like any other candidate.
- **Evidence:** Ryan (Simplify/Careerflow/career-ops capture pattern); `jobSubmission.ts` already exists.
- **Builds on:** `jobNormalization` (A), `jobDeduplication` (A), FreshFit, strategist review.
- **Scope:** URL submission, validated fetch/parse, normalization, dedup against existing jobs, FreshFit scoring, strategist visibility.
- **Exclusions:** no browser extension. No bulk import. No scraping of sources whose ToS forbid it.
- **Dependencies:** N5. **Owner:** Opportunity Engine specialist. **Collaborators:** Ethan (untrusted input — mandatory), John.

### X2 — Career Passport
- **Objective:** reusable, provenance-tracked structured answers to common application questions, composed from canonical data.
- **Builds on:** Career Vault wins/capabilities, Forward DNA evidence states, master resume entries, `validateGroundedProposal`.
- **Scope:** answer library with canonical-source links, member review/approval, strategist reuse during application prep.
- **Exclusions:** **no auto-submission into third-party forms.** No AI-generated answers without the existing grounding validator passing. No answers not traceable to canonical evidence.
- **Dependencies:** N5, X4 preferred. **Owner:** Resume Intelligence / Career Vault specialist. **Collaborators:** Ethan, Sarah, John.

### X3 — Interview Intelligence v1
- **Objective:** role-specific question sets, Vault-grounded STAR story selection, strategist-visible scorecards.
- **Builds on:** N5's interview entity, Career Vault wins, `recurringGaps`, existing `/mock-interviews` (currently an island).
- **Exclusions:** **no audio/video recording** (Ethan: major new privacy surface → owner escalation if ever proposed). No AI interviewer replacing the human coach. No question content copied from competitors (registry guardrail).
- **Dependencies:** N5 (hard). **Owner:** delivery specialist. **Collaborators:** Sarah, Ethan, Alex (coaching-model fit).

### X4 — Career Evidence Intelligence
- **Objective:** proactively detect weak evidence and prompt the member for the accomplishment that would strengthen it.
- **Builds on:** Forward DNA `STATE_WEIGHT`, `capabilityEngine`, Career Vault, Forward Score evidenceQuality pillar.
- **Exclusions:** no fabricated accomplishments; prompts only, never auto-written wins. Anti-fabrication suite applies unchanged.
- **Dependencies:** N1. **Owner:** Career Vault / Forward DNA specialist. **Collaborators:** Sarah, John.

### X5 / X6 / X7 / X8 / X9
Scoped in the NEXT table above; each inherits the exclusions already stated in Phase 14. X9's provider choice is an owner decision (paid vendor) and must also fix the `NoOpNotificationProvider` false-"sent" hazard before any real sends.

---

# Owner escalations — flagged, not decided

Per my hard rules, these are above my seat. I am recording them here rather than resolving them.

1. **Full-auto mass-apply / Autopilot.** Rejected within current strategy because it contradicts the locked positioning in PRODUCT.md. Any reconsideration is a **new major product direction + locked-decision change** and needs the owner.
2. **Recruiter / employer-facing side of the marketplace.** Flagged by Ryan, the Ladders registry, and Ethan. **New major product direction** with a significant privacy surface.
3. **Premium-gating core canonical-chain features** (the Ladders/Apply4Me pattern). Pricing and packaging strategy; **owner decision.**
4. **Email/notification provider selection (X9)** and **any third-party analytics SDK (N7)** — **material paid vendor commitments.**
5. **Salary / company / geo data sourcing** — every credible source implies a **paid data vendor**; research before scoping.
6. **Adzuna licensing tier and member-facing attribution** — already owner-deferred and on record in the kennel; still unresolved, still blocks scheduling Adzuna and blocks unrestricted commercial reliance. **Unresolved legal/licensing ambiguity.**
7. **Interview audio/video recording** — if ever proposed: consent, retention, access control, probable legal review.
8. **Public Forward Profile indexability** — privacy/consent decision requiring Ethan, then the owner.
9. **Any production deployment or live database change arising from this roadmap** — owner approval, always. N1 is a *read* of live state; applying any migration is a separate approval.
10. **Deleting the abandoned tmp scripts and duplicate screenshots (D-10, D-11)** — charter rule 7 requires owner approval for deletion. Should be batched into one cleanup request, not done quietly.

---

## Closing judgement

The temptation after an audit this thorough is to green-light the exciting list: Passport, Interview Intelligence, Autopilot. I am explicitly not doing that. The audit's clearest finding is that this product is **further along than it can currently prove**, and the fastest route to a credible launch is to finish and verify what exists, fix the places where the UI is untrue, and build exactly one major new capability — the Application Command Center — because three of the four highest-value NEXT features are structurally impossible without it.

The moat is real, it is already partly built, and the single largest thing standing between FreshlyForward and a defensible six-month data advantage is that we currently throw away every outcome the moment it happens.

**One new feature in NOW. Everything else is finishing what we started.**
