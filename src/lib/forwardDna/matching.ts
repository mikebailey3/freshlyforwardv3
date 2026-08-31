import type { CareerSkill, CareerScope } from '@/types/forwardDna'

const STATE_WEIGHT: Record<string, number> = { claimed: 0.5, demonstrated: 0.8, supported: 1 }

/**
 * Bonus points (0-15) for JD-detected skills the member has recorded as
 * Forward DNA evidence, weighted by how well-evidenced the skill is.
 * Additive on top of freshFitScore's existing skillsCoverage factor
 * (which only checks the flat skills[] list) -- a skill marked
 * 'demonstrated' or 'supported' earns extra credit beyond simply being
 * listed.
 */
export function scoreSkillEvidence(
  careerSkills: CareerSkill[],
  jdSkills: string[]
): { points: number; matched: string[] } {
  if (jdSkills.length === 0 || careerSkills.length === 0) return { points: 0, matched: [] }

  const byName = new Map(careerSkills.map((s) => [s.skill_name.toLowerCase(), s]))
  const matched: string[] = []
  let earned = 0

  for (const skill of jdSkills) {
    const evidence = byName.get(skill.toLowerCase())
    if (!evidence) continue
    matched.push(skill)
    earned += STATE_WEIGHT[evidence.state] ?? 0
  }

  const points = Math.round((earned / jdSkills.length) * 15)
  return { points: Math.min(15, points), matched }
}

const TEAM_SIZE_RE = /team of (\d+)|(\d+)\+?\s+(?:direct )?reports?/i
const BUDGET_RE = /\$\s?(\d+(?:\.\d+)?)\s?(million|m|k)\b/i

function parseScopeSignals(jobDescription: string): { teamSize: number | null; budgetCents: number | null } {
  const teamMatch = jobDescription.match(TEAM_SIZE_RE)
  const teamSize = teamMatch ? Number(teamMatch[1] ?? teamMatch[2]) : null

  const budgetMatch = jobDescription.match(BUDGET_RE)
  let budgetCents: number | null = null
  if (budgetMatch) {
    const amount = Number(budgetMatch[1])
    const unit = budgetMatch[2].toLowerCase()
    const dollars = unit.startsWith('m') ? amount * 1_000_000 : amount * 1_000
    budgetCents = Math.round(dollars * 100)
  }

  return { teamSize, budgetCents }
}

/**
 * Bonus points (0-10) when the JD implies a scope (team size / budget)
 * the member has evidence of having handled before, per their Forward
 * DNA career_scope entries. Best-effort regex extraction (YAGNI) -- a
 * JD with no detectable scope language scores 0 here, it never scores
 * negative or blocks a match.
 */
export function scoreScopeFit(careerScope: CareerScope[], jobDescription: string): number {
  if (careerScope.length === 0) return 0

  const { teamSize, budgetCents } = parseScopeSignals(jobDescription)
  if (teamSize === null && budgetCents === null) return 0

  const maxTeamSize = Math.max(0, ...careerScope.map((s) => s.team_size ?? 0))
  const maxBudgetCents = Math.max(0, ...careerScope.map((s) => s.budget_managed_cents ?? 0))

  let points = 0
  if (teamSize !== null && maxTeamSize >= teamSize) points += 5
  if (budgetCents !== null && maxBudgetCents >= budgetCents) points += 5

  return points
}
