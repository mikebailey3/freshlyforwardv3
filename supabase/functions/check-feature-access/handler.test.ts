// supabase/functions/check-feature-access/handler.test.ts
//
// Regression coverage for the check-feature-access edge function,
// including the exploit that motivated this fix: an authenticated caller
// could previously supply `body.user_id` to probe ANOTHER user's
// entitlement state. `handler.ts` now derives the entitlement target
// exclusively from the verified JWT user -- test #2 below is the one
// that must fail against the pre-fix code and pass after (falsification
// performed manually, see PR/report notes).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// `handler.ts` reads three env vars via `Deno.env.get(...)` -- verbatim
// from the original index.ts logic. Stub a minimal global `Deno` so this
// module (which intentionally has no `jsr:` import / Deno types) can run
// under Node/Vitest. The actual values are irrelevant because
// `createClient` itself is mocked below.
vi.stubGlobal('Deno', { env: { get: (key: string) => `stub-${key}` } })

const { mockCreateClient, mockGetUser, mockRpc, mockFrom } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

// Same import must come after vi.mock (hoisted automatically by Vitest).
import { handleCheckFeatureAccess } from './handler'

interface BuilderResult {
  data: unknown
  error: unknown
}

/** Minimal chainable Supabase query-builder double, same convention as
 * src/pages/DashboardPage.test.tsx: every chain method returns itself,
 * and it's also thenable so both `await builder` and
 * `await builder.maybeSingle()` resolve. */
function makeBuilder(result: BuilderResult) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.maybeSingle = () => Promise.resolve(result)
  builder.then = (resolve: (value: BuilderResult) => void) => resolve(result)
  return builder
}

const USER_A = 'user-aaaa-1111'
const USER_B = 'user-bbbb-2222'

function makeRequest(body?: unknown, opts: { method?: string; withAuth?: boolean } = {}): Request {
  const headers: Record<string, string> = {}
  if (opts.withAuth ?? true) {
    headers.Authorization = 'Bearer test-jwt-token'
  }
  return new Request('http://localhost/check-feature-access', {
    method: opts.method ?? 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateClient.mockImplementation(() => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }))
  // Default: valid authenticated user, no tables queried unless a test
  // needs the 403/upgrade-metadata path.
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_A } }, error: null })
  mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }))
})

describe('check-feature-access handler', () => {
  it('checks the authenticated user\'s OWN feature: p_user_id equals the JWT-derived id', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const res = await handleCheckFeatureAccess(makeRequest({ feature_key: 'career_vault' }))

    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('has_feature_access', {
      p_user_id: USER_A,
      p_feature_key: 'career_vault',
    })
  })

  it('EXPLOIT: body.user_id set to a different user is ignored -- p_user_id is always the JWT user, never body.user_id', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    await handleCheckFeatureAccess(
      makeRequest({ feature_key: 'career_vault', user_id: USER_B })
    )

    expect(mockRpc).toHaveBeenCalledWith('has_feature_access', {
      p_user_id: USER_A,
      p_feature_key: 'career_vault',
    })
    expect(mockRpc).not.toHaveBeenCalledWith(
      'has_feature_access',
      expect.objectContaining({ p_user_id: USER_B })
    )
  })

  it('missing Authorization header -> 401 UNAUTHORIZED, RPC never called', async () => {
    const res = await handleCheckFeatureAccess(
      makeRequest({ feature_key: 'career_vault' }, { withAuth: false })
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('auth.getUser() returns an error -> 401 UNAUTHORIZED, RPC never called', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } })

    const res = await handleCheckFeatureAccess(makeRequest({ feature_key: 'career_vault' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('missing feature_key -> 400 MISSING_FEATURE_KEY', async () => {
    const res = await handleCheckFeatureAccess(makeRequest({}))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'feature_key is required', code: 'MISSING_FEATURE_KEY' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('has_feature_access resolves true -> 200 { has_access: true, feature_key }, unchanged shape', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const res = await handleCheckFeatureAccess(makeRequest({ feature_key: 'career_vault' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ has_access: true, feature_key: 'career_vault' })
  })

  it('has_feature_access resolves false -> 403 with full upgrade-metadata shape', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'features') {
        return makeBuilder({
          data: {
            display_name: 'Career Vault',
            upgrade_title: 'Unlock Career Vault',
            upgrade_body: 'Upgrade to track evidence-backed wins.',
            upgrade_cta: 'Upgrade now',
          },
          error: null,
        })
      }
      if (table === 'plan_features') {
        return makeBuilder({
          data: [{ plan_id: 'plan-1', membership_plans: { slug: 'career-growth', name: 'Career Growth' } }],
          error: null,
        })
      }
      return makeBuilder({ data: null, error: null })
    })

    const res = await handleCheckFeatureAccess(makeRequest({ feature_key: 'career_vault' }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      has_access: false,
      code: 'FEATURE_NOT_INCLUDED',
      feature_key: 'career_vault',
      required_plan: 'career-growth',
      feature_name: 'Career Vault',
      upgrade_title: 'Unlock Career Vault',
      upgrade_body: 'Upgrade to track evidence-backed wins.',
      upgrade_cta: 'Upgrade now',
    })
  })
})
