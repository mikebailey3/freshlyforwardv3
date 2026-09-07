/**
 * Shared, deterministic text-quality primitives.
 *
 * Extracted from linkedinOptimizer.ts (Resume Intelligence Phase 1) so the
 * same clichés/weak-openers/quantification checks aren't duplicated between
 * LinkedIn Optimizer and Resume Intelligence's content-strength and
 * quantification dimensions. No behavior changed during extraction --
 * ../linkedinOptimizer.test.ts (written against the pre-extraction file)
 * still passes unchanged against the post-extraction version that imports
 * from here.
 *
 * Same philosophy as freshFitScore: no LLM, no external calls, a fully
 * explainable rule-based heuristic a member can act on immediately.
 */

// Phrases recruiters see so often they've become noise -- flagging these
// isn't about being harsh, it's that they carry zero differentiating signal.
export const CLICHES = [
  'hardworking', 'hard-working', 'team player', 'results-driven', 'results driven',
  'go-getter', 'detail-oriented', 'detail oriented', 'self-starter', 'self starter',
  'think outside the box', 'synergy', 'passionate about', 'excellent communication skills',
  'dynamic professional', 'proven track record', 'highly motivated',
]

// Weak, passive bullet openers -- the classic resume/LinkedIn tell that
// someone described their job description instead of their impact.
export const WEAK_OPENERS = [
  'responsible for', 'duties included', 'duties include', 'worked on', 'worked with',
  'helped with', 'helped to', 'in charge of', 'tasked with', 'assisted with',
  'was responsible', 'my role', 'job duties',
]

// Rough keyword -> strong-verb mapping used to rewrite a weak bullet.
// Deliberately simple pattern matching (YAGNI) -- good enough to nudge a
// member toward action language without pretending to understand intent.
export const VERB_MAP: [RegExp, string][] = [
  [/\b(team|staff|employee|report)/i, 'Led'],
  [/\b(revenue|client|customer acquisition|deal)/i, 'Drove'],
  [/\b(process|system|workflow|procedure)/i, 'Streamlined'],
  [/\b(customer|support|service|complaint)/i, 'Resolved'],
  [/\b(budget|cost|expense|spend)/i, 'Managed'],
  [/\b(train|onboard|mentor|coach)/i, 'Trained'],
  [/\b(launch|project|initiative|rollout)/i, 'Launched'],
  [/\b(report|analysis|data|metric)/i, 'Analyzed'],
]

export function hasMetric(text: string): boolean {
  return /\d/.test(text) || /%/.test(text) || /\$/.test(text)
}

export function findCliches(text: string): string[] {
  const normalized = text.toLowerCase()
  return CLICHES.filter((c) => normalized.includes(c))
}

/** Strips a weak opener and prepends a context-appropriate strong verb. */
export function rewriteBullet(bullet: string): string {
  let text = bullet.trim()
  const lower = text.toLowerCase()

  for (const opener of WEAK_OPENERS) {
    if (lower.startsWith(opener)) {
      text = text.slice(opener.length).trim()
      break
    }
  }
  text = text.replace(/^(for|to|with)\s+/i, '')
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1)
  }

  const verb = VERB_MAP.find(([pattern]) => pattern.test(text))?.[1] || 'Delivered'
  const rewritten = text ? `${verb} ${text.charAt(0).toLowerCase()}${text.slice(1)}` : `${verb} [describe the work]`

  return hasMetric(rewritten)
    ? rewritten
    : `${rewritten} — [quantify it: e.g., "by 20%", "for 50+ clients", "saving 5 hrs/week"]`
}
