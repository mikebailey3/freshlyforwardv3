# FreshlyForward — Security & Privacy Review
**Audit phase:** Phase 18 / current-state security posture
**Reviewer:** Ethan Cole (Security & Privacy Lead)
**Mode:** Read-only inspection only; no migrations run, no production changes

## Scope and evidence notes
- Reviewed the repo’s actual routes, client auth/authorization flow, public/private projection code, notification pipeline, anonymous Career Compass write path, and all 46 Supabase migration files.
- I could **not** verify live production schema state from this repo. Where migrations are marked `NOT APPLIED` / `REVIEW-ONLY DRAFT` / `PREPARED FOR REVIEW`, I treat them as **repo intent**, not live DB truth.
- Existing app code already assumes some of those schema changes exist. That means live schema confirmation from ChatGPT / DB lead is required before relying on those paths.

## John Carter’s 5 flagged items — resolution / clarification

### 1) Six OE security-hardening migrations possibly unapplied
**Status:** **Unverified against live DB; repo shows them as review-only / not applied**

Evidence:
- `supabase/migrations/20260917000000_harden_get_job_match_snapshot.sql`
- `supabase/migrations/20260918000000_job_matches_column_security_and_rls_perf.sql`
- `supabase/migrations/20260919000000_oe_rls_performance_auth_uid.sql`
- `supabase/migrations/20260920000000_oe_fk_indexes.sql`
- `supabase/migrations/20260921000000_oe_table_grants_hardening.sql`
- `supabase/migrations/20260922000000_fix_market_intelligence_admin_jwt_claim.sql`
- plus a syntax-only follow-up: `20260923000000_fix_market_intelligence_admin_jwt_initplan_lint.sql`

These migrations harden:
- job match update integrity (`get_job_match_snapshot`, column-locked UPDATE policies)
- RLS performance (`auth.uid()` / `auth.jwt()` InitPlan rewrites)
- table grants (`REVOKE ALL` + minimal GRANTs)
- market intelligence admin checks (`auth.users` lookup -> JWT app_metadata claim)

**What needs ChatGPT / DB-lead confirmation:** whether production already has the corresponding schema/policy state. The app code assumes these protections in several places, but the repo itself cannot prove they are live.

### 2) `/internal/design-system` is publicly routed in `src/App.tsx` with no auth guard
**Status:** **Confirmed**

Evidence:
- `src/App.tsx` includes `path="/internal/design-system"` with no `ProtectedRoute`.
- The route is not in `publicRoutes`, but that only affects header/footer chrome. It does **not** enforce auth.

Risk:
- Low direct data risk; this is primarily unintended public exposure of an internal QA surface.
- If the page ever accumulates real member data or staff-only examples, this becomes a privacy issue immediately.

### 3) RLS is the de-facto API contract; `ProtectedRoute` is UX-only, not enforcement
**Status:** **Confirmed**

Evidence:
- `src/components/ProtectedRoute.tsx` only redirects or renders alternate UI.
- The app talks to Supabase directly from the client all over the codebase (`supabase.from(...)` in pages/hooks/libs).
- There is no backend API layer in front of that data path.

Blast radius if a client guard is bypassed:
- A bypassed route can expose the UI and initiate client requests, but real access still depends on Postgres RLS, grants, and RPC policy checks.
- Therefore, a route bypass is not automatically a data breach; it becomes one only if the underlying table/function policies are wrong.
- For privileged strategist/admin screens, the backend must still reject unauthorized reads/writes even if the component renders.

### 4) `NoOpNotificationProvider` may produce false-positive “sent” records
**Status:** **Confirmed**

Evidence:
- `src/lib/notifications/provider.ts`: `NoOpNotificationProvider.send()` always returns `{ success: true }` and logs a message.
- `scripts/sendDigests.ts` treats that as a successful send and still writes to `match_digest_log`.

Privacy/trust impact:
- The system can record a digest as “sent” even though no email was actually delivered.
- That creates a false communication audit trail and can suppress future digest delivery via duplicate suppression.
- `sendDigests.ts` also resolves recipient email addresses and the no-op provider logs recipient + subject, which is unnecessary PII leakage if anyone runs the script against real member data.

### 5) Anonymous Career Compass write path — abuse / rate-limit posture unconfirmed
**Status:** **Confirmed anonymous write path; no rate-limit / abuse control found**

Evidence:
- `src/lib/careerCompass/session.ts` uses `supabase.auth.signInAnonymously()` when no session exists.
- It writes to `career_compass_assessments` and `career_compass_results` from the client flow.
- I found no CAPTCHA, honeypot, throttling, or explicit abuse/rate-limit layer for this path in the inspected code.

Risk:
- The path is intentionally anonymous-first, but it is still a write surface.
- Without rate limiting, it is open to spam, storage abuse, and noisy data pollution.

## Current-state security / privacy review

### Overall posture
FreshlyForward’s **best security property** is that it uses explicit allow-lists and RLS-backed server-side projection for private data. The strongest examples are:
- public Forward Profiles read from `public_forward_profiles` view only
- privileged member profile fields blocked by trigger-based normalization
- admin/strategist checks keyed off `app_metadata` or server-side assignments, not client input

The weakest parts are:
- unverified OE hardening migrations
- one unsafe URL sink in Notifications UI
- the no-op digest pipeline creating false delivery history
- anonymous Career Compass lacking an abuse-control story
- dependency drift risk from floating `latest` versions

### Auth / authorization
Good:
- `src/context/AuthContext.tsx` does **not** trust `user_metadata` for authorization.
- Admin recognition uses `app_metadata.role`.
- Strategist status is derived from DB state (`strategist_assignments` / `is_strategist`), not a client field.

Watchouts:
- `ProtectedRoute` is only a UI gate; every sensitive table/function must remain RLS-protected.
- Any future authz change must keep relying on server-side claims/state, never client-controlled fields.

### RLS review across migrations
Strong patterns found:
- Public Forward Profile allow-list view, with no base-table anon exposure.
- Trigger-based protection for privileged `member_profiles` fields.
- Reserved roadmap event types are explicitly blocked from ordinary authenticated writes.
- OE hardening migrations show good intent: narrowed function EXECUTE, reduced grants, and claim-based admin checks.

High-risk gap:
- Several OE hardening files are explicitly marked review-only / not applied in the repo.
- Because app code already assumes them, live DB confirmation is mandatory before treating those protections as present.

### Public vs private data boundaries
Good boundaries:
- `/u/:username` is allow-list driven and intentionally strips private member fields.
- Career Vault evidence is explicitly not projected into public profile views.
- `memberOpportunityProfile` keeps private/internal scoring inputs internal to the Opportunity Engine / FreshFit path.

Areas to keep private by default:
- resume contents
- Career Vault evidence / confirmed capabilities
- Forward DNA evidence
- Career Compass raw answers and results
- strategist notes
- internal notification and digest history

### XSS / unsafe URL surface
Good:
- I did **not** find `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` in the inspected app code.
- Most user-influenced external links are protected with `isSafeHttpUrl()` and `rel="noopener noreferrer"`.

Issue:
- `src/pages/NotificationsPage.tsx` renders `href={notification.link}` with **no** safety check.
- Because `Notification.link` is a free-form string, this is an unsafe URL sink.
- It should be normalized/validated with the same `isSafeHttpUrl()` helper used elsewhere, or constrained to internal routes only.

### Secret handling / bundle exposure
Good:
- The client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, which is expected.
- `SUPABASE_SERVICE_ROLE_KEY` is kept in `process.env` for scripts, not the client bundle.
- I did not find committed secrets in the inspected files.

Concerns:
- `package.json` has several core dependencies pinned to `latest` (`react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `vite`, `typescript`, `@types/*`). That is a supply-chain / reproducibility risk.
- I did not run a CVE scanner here, so I am not claiming any specific package is vulnerable — only that the manifest is too loose for a security-sensitive app.

### Dependency security
Current posture is acceptable for a review-only audit, but the manifest should be tightened:
- Replace floating `latest` dependencies with pinned versions.
- Run a formal dependency audit before release if any package lock is regenerated.

### Member / strategist separation
Good:
- Strategist/admin routes are separated in the router and gated by role checks.
- Staff-only data paths still rely on backend policy, not route secrecy.
- Public profile and private member profile are structurally distinct.

Watchout:
- Staff separation only holds if the underlying RLS / function policies are correct. A UI bypass alone should not grant data access, but it can still expose attack surface if any policy is too broad.

## Expansion ideas — privacy/security implications only
Not a build decision; these are review notes if they ever come up.

### Private career data exposure risk
- Treat all resume, Career Vault, Forward DNA, Career Compass, and strategist notes as private by default.
- Only publish with an explicit allow-list and an explicit member-controlled toggle.

### Public profiles
- Current allow-list approach is the right pattern.
- Any expansion of public profile fields needs formal review because public exposure is deny-by-default.

### Resume contents
- Highly sensitive; avoid projecting raw resume text to public surfaces.
- Keep it member-scoped unless there is an explicit public-use case.

### Third-party job data trust boundaries
- Treat scraped job data and member-submitted URLs as untrusted input.
- Continue validating URLs before rendering them.

### Future external integrations (email / calendar)
- Require dedicated secrets handling, scoped tokens, and a reviewed server-side action path.
- Do not move provider secrets into client code.

### Future interview recording (audio/video)
- This would be a major new privacy surface.
- It would need explicit consent, retention rules, access controls, and probably a dedicated legal/privacy review.

### AI-provider data handling
- Keep grounding / provenance validation mandatory.
- Minimize data sent to any external AI provider.
- Do not send private career data without explicit purpose limitation and review.

### Analytics data collection
- There is currently no general analytics stack in the repo.
- If added later, default to minimal, aggregated, and non-sensitive event capture.

### Strategist/member data separation
- Maintain strict member-scoped RLS, explicit staff role checks, and no client-trusted authz inputs.
- Any staff convenience feature should be reviewed for overbroad visibility.

### Employer / recruiter-facing access model
- I am **not** approving or rejecting this idea here.
- If ever proposed, it would be a major new privacy surface and would require dedicated architecture + privacy review before implementation.

## High-severity / important findings to carry forward
1. **Unverified OE hardening migrations** — live DB state must be confirmed before relying on job match / market intelligence protections.
2. **Unsafe URL sink in NotificationsPage** — validate or constrain `notification.link` before rendering it.
3. **Anonymous Career Compass has no visible abuse controls** — add rate limiting / anti-abuse review if this stays public.
4. **NoOpNotificationProvider creates false delivery history** — safe only for non-production validation, not real member messaging.
5. **Floating `latest` dependencies** — tighten the manifest to reduce supply-chain drift risk.

## Summary
FreshlyForward has a generally strong privacy posture where it matters most: explicit allow-lists, server-side RLS, and private/public separation for member data. The biggest remaining issues are not broad design failures; they are a handful of concrete implementation risks: unverified schema hardening, one unsafe link sink, anonymous write abuse posture, false notification delivery logs, and loose dependency pinning.
