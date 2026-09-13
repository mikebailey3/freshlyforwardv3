# N3 — Member-Trust Correctness Pack

**Status:** in progress
**Domain owners:** John Carter (platform correctness/architecture, items 2/3/5/7),
Ethan Cole (security, items 1/2/3), Sarah Chen (UX/accessibility, items 4/6)
**Type:** defect-fix pack — no new product surface area, no schema changes, no new
external dependencies.

All seven items below were verified against current repository truth (read directly,
not assumed from the audit) before this plan was written. None are already
implemented under another name.

## Items

### 1. Unsafe `href` sink in `NotificationsPage.tsx` (security)
`notification.link` is rendered directly as an `<a href>` with no validation. The
canonical guard `isSafeHttpUrl` (`src/lib/url.ts`) already exists and is used in six
other places (`CareerProfilePage`, `JobMatchCard`, `MemberOpportunitiesPage`,
`PublicProfilePage`, `WhyWeAppliedPage`, `StrategistOpportunitiesPage`,
`StrategistOpportunityEnginePage`) — this is the one place in the app that was
missed. **Fix:** reuse `isSafeHttpUrl`, no new code.

### 2. False delivery provenance in `NoOpNotificationProvider` (security/data-integrity)
`NoOpNotificationProvider.send()` always returns `{ success: true }` and
`scripts/sendDigests.ts` writes a `match_digest_log` row on any `success: true`
result. The class docs already warn against pointing this at real member data, but
that warning is a comment, not a code-level guard — nothing stops a real run from
silently writing "delivered" rows for emails that were never sent. It also logs
`payload.toEmail` in cleartext to the console.
**Fix (code-level, not just docs):**
- Add a required `simulated: boolean` field to `NotificationSendResult`. Real
  providers (when chosen) report `simulated: false`; `NoOpNotificationProvider`
  reports `simulated: true`.
- `sendDigests.ts`: skip the `match_digest_log` insert whenever
  `sendResult.simulated` is true, and count those runs separately
  (`simulatedCount`) in the run summary instead of `sentCount`. This makes it
  structurally impossible for a no-op run to pollute real duplicate-suppression
  state, regardless of who runs the script or against which Supabase project —
  closing the gap a code comment can't close.
- Mask the email in the console log (e.g. `j***@example.com`) since this log line
  can run against real member data before a real provider exists.

### 3. Unauthenticated `/internal/design-system` route (security)
`App.tsx` mounts `DesignSystemShowcasePage` with no `ProtectedRoute` wrapper, unlike
the three admin-only routes immediately above it in the same file. **Fix:** wrap it
in the same `<ProtectedRoute roles={['admin']}>` pattern already used for
`/admin/members` and `/master-admin/feature-entitlements`. Zero new auth code.

### 4. Dead, unlabeled search box in `MemberLayout` header (UX/correctness/a11y)
The desktop header renders a `type="search"` input with a placeholder and a search
icon, but no `onChange`, no state, and no `aria-label` — it looks interactive but
does nothing, and a screen reader announces it as an unlabeled search field.
Building real global search is a new feature (out of scope for a correctness pack —
YAGNI). **Proposed fix:** remove the non-functional input; a missing affordance is
more honest than a broken one. Sarah has final call — see her review below.

### 5. `MessagesPage` "Unread" filter tab does nothing (correctness)
`filteredConversations` — `if (filter === 'unread') return !c.is_archived` is
byte-for-byte identical to the default/`all` branch. The per-conversation unread
count is already computed correctly elsewhere in the same file
(`messages.filter((m) => m.conversation_id === conv.id && m.sender_type !== 'member' && !m.is_read).length`)
but only used for the badge, never for the filter. **Fix:** hoist that computation
into a single `getUnreadCount(conv)` helper (memoized), reuse it for both the badge
and the `unread` filter branch (`!c.is_archived && getUnreadCount(c) > 0`).

### 6. No focus trap / no focus restoration in modal dialogs (accessibility, WCAG 2.2 AA)
Two `role="dialog"` components exist in the app: `AddCareerWinModal` and
`UpgradeModal` (`FeatureEntitlements.tsx`). Both correctly set `aria-modal="true"`
and close on Escape, but neither traps Tab focus inside the dialog (a keyboard user
can Tab straight through into the hidden page behind the overlay) nor restores
focus to the triggering element on close. No dialog/focus-trap library exists in
`package.json` — hand-rolling one small reusable hook fixes both dialogs at once
(DRY: one hook, two call sites, and it's ready for any future modal too) rather than
pulling in a new dependency for two use sites.
**Fix:** `src/hooks/useFocusTrap.ts` — on activation, remembers
`document.activeElement`, moves focus to the first focusable element in the dialog
container, traps Tab/Shift+Tab within the container's focusable elements, and
restores focus to the remembered element on cleanup. Applied to both dialogs.

### 7. No root error boundary (reliability/correctness)
No `ErrorBoundary` exists anywhere in `src/`. An uncaught render error anywhere in
the tree currently produces a blank white screen with no recovery path.
**Fix:** `src/components/ErrorBoundary.tsx` — a standard class-component boundary
wrapping `<App />` in `main.tsx`, rendering a calm, on-brand fallback ("Something
went wrong on our end" + reload button) instead of a blank page.
`console.error`s the caught error for local/dev visibility only — no new
error-tracking vendor is introduced (that would be a paid-vendor decision, out of
scope here).

## Explicitly out of scope for N3
- Building real global search (item 4's alternative to removal) — new feature,
  not a correctness fix.
- Choosing a real transactional email provider (item 2's underlying deferred
  decision) — separate, already-gated decision per the provider's own docs.
- Any Supabase migration or schema change — none of these seven items need one.
