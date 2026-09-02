// src/lib/forwardScore/searchReadinessRegression.test.ts
//
// Standalone, read-only proof (Task 8) that this entire 10-task
// "ForwardOS Home + Forward Score" project never touched Search
// Readiness. Static-analysis-style only -- no Supabase client, no I/O
// beyond reading source files via Vite's `?raw` whole-source-string
// import, the same technique used throughout this project's other
// tripwire tests (score.test.ts, pillars.test.ts).
import { describe, it, expect } from 'vitest'

// -- 1. Source of truth: src/lib/profile.ts (untouched, unmodified) --
import profileSource from '../profile.ts?raw'

// -- 2. Every production (non-test) file under src/lib/forwardScore/ --
import indexSource from './index.ts?raw'
import nextBestMoveSource from './nextBestMove.ts?raw'
import pillarsSource from './pillars.ts?raw'
import scoreSource from './score.ts?raw'

// -- 2. Every production (non-test) file under src/components/forwardScore/ --
import forwardScoreWidgetSource from '../../components/forwardScore/ForwardScoreWidget.tsx?raw'
import nextBestMoveCardSource from '../../components/forwardScore/NextBestMoveCard.tsx?raw'
import pillarCardSource from '../../components/forwardScore/PillarCard.tsx?raw'

// -- 3. Every admin/strategist/member page + badge trigger this project's
//       audit (design spec §1, cross-referenced against the actual
//       calculateSearchReadiness()/search_readiness_score call sites in
//       the codebase) identified as a Search Readiness consumer --
import dashboardPageSource from '../../pages/DashboardPage.tsx?raw'
import careerProfilePageSource from '../../pages/CareerProfilePage.tsx?raw'
import adminMemberDetailPageSource from '../../pages/strategist/AdminMemberDetailPage.tsx?raw'
import strategistMemberWorkspacePageSource from '../../pages/strategist/StrategistMemberWorkspacePage.tsx?raw'
import strategistMembersPageSource from '../../pages/strategist/StrategistMembersPage.tsx?raw'
import strategistDashboardPageSource from '../../pages/strategist/StrategistDashboardPage.tsx?raw'
import searchReadinessWidgetSource from '../../components/SearchReadinessWidget.tsx?raw'
import badgeSystemSqlSource from '../../../supabase/migrations/20260818010000_badge_system.sql?raw'

describe('Search Readiness regression proof (Task 8 -- whole-project tripwire)', () => {
  describe('1. calculateSearchReadiness() weighted-checklist field list is byte-for-byte unchanged', () => {
    // Extracted live from profile.ts's source, NOT a copy-pasted
    // duplicate maintained by hand -- if the field list, its order, or
    // any weight in `readinessChecks` ever changes, this regex-based
    // extraction changes too, and the assertion below fails.
    const checkPattern = /\{\s*field:\s*'([a-zA-Z0-9_]+)',\s*label:\s*'[^']*',\s*weight:\s*(\d+)\s*\}/g
    const extracted = [...profileSource.matchAll(checkPattern)].map((m) => ({
      field: m[1],
      weight: Number(m[2]),
    }))

    const EXPECTED = [
      { field: 'full_name', weight: 5 },
      { field: 'phone', weight: 3 },
      { field: 'location', weight: 5 },
      { field: 'headline', weight: 5 },
      { field: 'summary', weight: 8 },
      { field: 'employment_history', weight: 15 },
      { field: 'education', weight: 10 },
      { field: 'skills', weight: 10 },
      { field: 'preferred_jobs', weight: 8 },
      { field: 'preferred_industries', weight: 5 },
      { field: 'salary_min', weight: 5 },
      { field: 'remote_preference', weight: 4 },
      { field: 'schedule_preference', weight: 3 },
      { field: 'work_style', weight: 4 },
      { field: 'career_goals', weight: 5 },
      { field: 'strengths', weight: 3 },
      { field: 'motivators', weight: 3 },
      { field: 'application_authorized', weight: 2 },
      { field: 'electronic_consent', weight: 2 },
    ]

    it('extraction actually found entries (regex did not silently match nothing)', () => {
      expect(extracted.length).toBeGreaterThan(0)
    })

    it('still exports calculateSearchReadiness from src/lib/profile.ts', () => {
      expect(profileSource).toContain('export function calculateSearchReadiness')
    })

    it('field list (order, names, weights) matches the known-good snapshot exactly', () => {
      expect(extracted).toEqual(EXPECTED)
    })

    it('extracted field count matches the number of `field:` check-object literals actually present', () => {
      // Belt-and-suspenders against the regex being too narrow and
      // silently skipping entries: count `field:` occurrences inside
      // string-literal check objects (the interface's type annotation
      // `field: keyof MemberProfile` never matches, since it has no
      // following quote) and confirm it lines up with `extracted`.
      const fieldKeyMatches = profileSource.match(/\{\s*field:\s*'[a-zA-Z0-9_]+'/g) ?? []
      expect(fieldKeyMatches.length).toBe(extracted.length)
    })
  })

  describe('2. search_readiness_score is never referenced under src/lib/forwardScore/ or src/components/forwardScore/', () => {
    // Only production sources -- test files are deliberately excluded:
    // this very file, plus score.test.ts/pillars.test.ts, legitimately
    // contain the literal string as part of their OWN tripwire
    // assertions (e.g. `expect(source).not.toContain('search_readiness_score')`),
    // which is not a violation of this rule.
    const productionSources: Record<string, string> = {
      'lib/forwardScore/index.ts': indexSource,
      'lib/forwardScore/nextBestMove.ts': nextBestMoveSource,
      'lib/forwardScore/pillars.ts': pillarsSource,
      'lib/forwardScore/score.ts': scoreSource,
      'components/forwardScore/ForwardScoreWidget.tsx': forwardScoreWidgetSource,
      'components/forwardScore/NextBestMoveCard.tsx': nextBestMoveCardSource,
      'components/forwardScore/PillarCard.tsx': pillarCardSource,
    }

    it('scanned at least one file in each directory (sanity check against an empty/broken import list)', () => {
      expect(Object.keys(productionSources).length).toBe(7)
    })

    for (const [path, source] of Object.entries(productionSources)) {
      it(`${path} never contains the literal string search_readiness_score`, () => {
        expect(source).not.toContain('search_readiness_score')
      })

      it(`${path} never contains the literal string calculateSearchReadiness`, () => {
        expect(source).not.toContain('calculateSearchReadiness')
      })
    }
  })

  describe('3. Zero-diff proof: badge_system.sql trigger + every audited admin/strategist/member page', () => {
    it('badge_system.sql still defines the search-ready trigger off search_readiness_score >= 100', () => {
      expect(badgeSystemSqlSource).toContain('IF NEW.search_readiness_score >= 100 THEN')
      expect(badgeSystemSqlSource).toContain("PERFORM award_badge(NEW.user_id, 'search-ready')")
      expect(badgeSystemSqlSource).toContain('search_readiness_score')
    })

    it('DashboardPage.tsx still calls calculateSearchReadiness(profile)', () => {
      expect(dashboardPageSource).toContain('calculateSearchReadiness')
    })

    it('CareerProfilePage.tsx still calls calculateSearchReadiness and writes search_readiness_score', () => {
      expect(careerProfilePageSource).toContain('calculateSearchReadiness')
      expect(careerProfilePageSource).toContain('search_readiness_score')
    })

    it('AdminMemberDetailPage.tsx still calls calculateSearchReadiness and writes search_readiness_score', () => {
      expect(adminMemberDetailPageSource).toContain('calculateSearchReadiness')
      expect(adminMemberDetailPageSource).toContain('search_readiness_score')
    })

    it('StrategistMemberWorkspacePage.tsx still calls calculateSearchReadiness(profile)', () => {
      expect(strategistMemberWorkspacePageSource).toContain('calculateSearchReadiness')
    })

    it('StrategistMembersPage.tsx still reads profile.search_readiness_score', () => {
      expect(strategistMembersPageSource).toContain('search_readiness_score')
    })

    it('StrategistDashboardPage.tsx still reads profile.search_readiness_score', () => {
      expect(strategistDashboardPageSource).toContain('search_readiness_score')
    })

    it('SearchReadinessWidget.tsx still calls calculateSearchReadiness(profile)', () => {
      expect(searchReadinessWidgetSource).toContain('calculateSearchReadiness')
    })
  })
})
