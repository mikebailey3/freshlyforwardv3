import { SKILL_KEYWORDS } from '@/lib/freshFitScore'
import { findCliches, hasMetric, rewriteBullet, WEAK_OPENERS } from '@/lib/textQuality'
import type { LinkedInProfileData } from '@/types'

/**
 * LinkedIn Optimizer — pure, deterministic profile-copy scoring.
 *
 * Same philosophy as freshFitScore.ts: no LLM, no external calls, a
 * fully explainable rule-based heuristic a member can act on immediately.
 * "Syncing" with LinkedIn means the member pastes their current content
 * here (LinkedIn's API doesn't grant third-party read access to profile
 * data, and scraping linkedin.com is a ToS violation this app won't do)
 * -- see the migration file for the full disclaimer.
 *
 * The cliché/weak-opener/quantification primitives live in
 * src/lib/textQuality/ (Resume Intelligence Phase 1) and are shared with
 * src/lib/resumeIntelligence/{contentStrength,quantification}.ts --
 * rather than each maintaining its own copy of the same heuristics.
 *
 * Weights (sum to 100):
 *   - headline     20pts
 *   - about        30pts
 *   - experience   30pts
 *   - skills       20pts
 */

export interface SectionResult {
  points: number
  maxPoints: number
  issues: string[]
  suggestion: string | null
}

export interface LinkedInOptimizerResult {
  score: number
  headline: SectionResult
  about: SectionResult
  experience: SectionResult
  skills: SectionResult
}

export { rewriteBullet } from '@/lib/textQuality'

export function generateHeadlineSuggestion(targetRole: string | null, skills: string[]): string {
  const role = targetRole?.trim() || 'Your Target Role'
  const topSkills = skills.slice(0, 2).join(' & ') || 'Your Top Skills'
  return `${role} | ${topSkills} | Helping [audience] achieve [outcome]`
}

function analyzeHeadline(headline: string, targetRole: string | null, skills: string[]): SectionResult {
  const issues: string[] = []
  let points = 0
  const text = headline.trim()

  if (!text) {
    return {
      points: 0,
      maxPoints: 20,
      issues: ['No headline set — this is the single most-viewed line on your profile, shown in every search result and comment you make.'],
      suggestion: generateHeadlineSuggestion(targetRole, skills),
    }
  }

  points += text.length >= 40 ? 8 : text.length >= 15 ? 4 : 0
  if (text.length < 40) issues.push('Headline is short — aim for 40-220 characters to use the full search-visible space.')

  const hasStructure = /[|•·]/.test(text)
  if (hasStructure) points += 6
  else issues.push('No separator (e.g. "|") — structured headlines ("Role | Specialty | Value") scan faster than a plain job title.')

  const cliches = findCliches(text)
  if (cliches.length > 0) {
    issues.push(`Generic phrase(s) found: "${cliches.join('", "')}" — these show up on thousands of profiles and add no signal.`)
  } else {
    points += 3
  }

  const normalized = text.toLowerCase()
  const mentionsRole = targetRole ? normalized.includes(targetRole.toLowerCase()) : false
  const mentionsSkill = skills.some((s) => normalized.includes(s.toLowerCase()))
  if (mentionsRole || mentionsSkill) points += 3
  else issues.push('Headline doesn\'t mention your target role or any listed skill — recruiters search by keyword.')

  return {
    points: Math.min(20, points),
    maxPoints: 20,
    issues,
    suggestion: issues.length > 0 ? generateHeadlineSuggestion(targetRole, skills) : null,
  }
}

function analyzeAbout(about: string): SectionResult {
  const issues: string[] = []
  let points = 0
  const text = about.trim()

  if (!text) {
    return {
      points: 0,
      maxPoints: 30,
      issues: ['About section is empty — this is where recruiters decide if you\'re worth a closer look before your resume ever comes up.'],
      suggestion: 'Start with who you help and how (1-2 sentences), then 2-3 concrete achievements with numbers, and close with what you\'re looking for next.',
    }
  }

  if (text.length >= 800) points += 12
  else if (text.length >= 300) points += 7
  else issues.push('About section is short — LinkedIn gives you up to 2,600 characters; 3-5 short paragraphs (roughly 800+ characters) is the professional norm.')

  if (hasMetric(text)) points += 10
  else issues.push('No numbers found — quantify at least one achievement (e.g. "grew revenue 30%", "managed a team of 12").')

  const cliches = findCliches(text)
  if (cliches.length > 0) {
    issues.push(`Generic phrase(s) found: "${cliches.join('", "')}" — replace with a specific, provable detail instead.`)
  } else {
    points += 4
  }

  const hasCallToAction = /(reach out|connect|message me|let's talk|feel free to contact|get in touch)/i.test(text)
  if (hasCallToAction) points += 4
  else issues.push('No closing call-to-action — invite people to connect or message you.')

  return {
    points: Math.min(30, points),
    maxPoints: 30,
    issues,
    suggestion: issues.length > 0
      ? 'Lead with impact, back it with a number, close with an invitation to connect.'
      : null,
  }
}

function analyzeExperience(bulletsText: string): SectionResult {
  const bullets = bulletsText
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean)

  if (bullets.length === 0) {
    return {
      points: 0,
      maxPoints: 30,
      issues: ['No experience bullets added yet — paste a few lines from your LinkedIn Experience section (one per line).'],
      suggestion: null,
    }
  }

  let weakCount = 0
  let quantifiedCount = 0
  const weakBullets: string[] = []

  for (const bullet of bullets) {
    const lower = bullet.toLowerCase()
    const isWeak = WEAK_OPENERS.some((opener) => lower.startsWith(opener)) || /^i\s/i.test(bullet)
    if (isWeak) {
      weakCount++
      weakBullets.push(bullet)
    }
    if (hasMetric(bullet)) quantifiedCount++
  }

  const strongRatio = 1 - weakCount / bullets.length
  const quantifiedRatio = quantifiedCount / bullets.length

  const points = Math.round(strongRatio * 18 + quantifiedRatio * 12)

  const issues: string[] = []
  if (weakCount > 0) {
    issues.push(`${weakCount} of ${bullets.length} bullet(s) open with a weak/passive phrase (e.g. "Responsible for") instead of a strong action verb.`)
  }
  if (quantifiedCount < bullets.length) {
    issues.push(`${bullets.length - quantifiedCount} of ${bullets.length} bullet(s) have no number, %, or $ — quantified impact is far more credible than a duty description.`)
  }

  const suggestion = weakBullets.length > 0
    ? `Example rewrite: "${weakBullets[0]}" → "${rewriteBullet(weakBullets[0])}"`
    : null

  return { points: Math.min(30, points), maxPoints: 30, issues, suggestion }
}

function analyzeSkills(skills: string[]): SectionResult {
  const issues: string[] = []
  let points = 0
  const count = skills.filter(Boolean).length

  if (count === 0) {
    return {
      points: 0,
      maxPoints: 20,
      issues: ['No skills listed — profiles with 5+ skills get shown in significantly more recruiter searches.'],
      suggestion: null,
    }
  }

  if (count >= 15) points += 14
  else if (count >= 5) points += 8 + Math.round(((count - 5) / 10) * 6)
  else issues.push(`Only ${count} skill(s) listed — add at least 5 (LinkedIn allows up to 50) to show up in more searches.`)

  const recognized = skills.filter((s) => SKILL_KEYWORDS.some((k) => s.toLowerCase().includes(k)))
  if (recognized.length >= 3) points += 6
  else issues.push('Few of your skills match common recruiter search terms for your field — consider adding widely-searched keywords.')

  return { points: Math.min(20, points), maxPoints: 20, issues, suggestion: null }
}

export function computeLinkedInScore(
  profile: Pick<LinkedInProfileData, 'headline' | 'about' | 'experience_bullets' | 'skills' | 'target_role'>,
): LinkedInOptimizerResult {
  const headline = analyzeHeadline(profile.headline, profile.target_role, profile.skills)
  const about = analyzeAbout(profile.about)
  const experience = analyzeExperience(profile.experience_bullets)
  const skills = analyzeSkills(profile.skills)

  const score = headline.points + about.points + experience.points + skills.points

  return { score, headline, about, experience, skills }
}
