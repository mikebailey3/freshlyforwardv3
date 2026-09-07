/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Characterization test locking down that Search Readiness is untouched by
// the Career Vault project (spec section 12 / plan Global Constraints).
//
// Recovery note (2026-09-08): the original branch version of this test
// also re-asserted profile.ts's readinessChecks field list byte-for-byte.
// That assertion is now a duplicate -- src/lib/forwardScore's own
// searchReadinessRegression.test.ts (added independently on main after
// this branch was cut) already extracts and locks the identical
// field/weight list straight from profile.ts's source, more rigorously
// (via a stricter regex plus a count cross-check). Re-asserting the same
// snapshot here a second time would just be two copies of one fact to
// keep in sync forever, so only the assertion unique to this file --
// that profile.ts has no accidental coupling to the new careerVault
// module tree -- is kept.
describe('calculateSearchReadiness -- Career Vault non-regression', () => {
  it('src/lib/profile.ts never imports anything from the careerVault module tree', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'profile.ts'), 'utf-8')
    expect(source).not.toMatch(/careerVault/)
  })
})
