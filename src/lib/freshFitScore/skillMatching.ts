import { scoreSkillEvidence, scoreScopeFit } from '@/lib/forwardDna/matching'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'
import type { EvidenceStatus } from './types'

// A broad, general-career skill dictionary (not tech-only, matches
// FreshlyForward's general career-concierge audience). Extend as needed.
// Preserved verbatim from the original freshFitScore.ts -- linkedinOptimizer.ts
// imports this directly and must keep working unchanged.
export const SKILL_KEYWORDS = [
  'communication', 'leadership', 'management', 'project management',
  'customer service', 'sales', 'marketing', 'accounting', 'bookkeeping',
  'budgeting', 'forecasting', 'analytics', 'data analysis', 'excel',
  'powerpoint', 'word', 'microsoft office', 'scheduling', 'logistics',
  'inventory', 'supply chain', 'operations', 'negotiation', 'recruiting',
  'onboarding', 'training', 'coaching', 'mentoring', 'public speaking',
  'writing', 'editing', 'social media', 'seo', 'content creation',
  'customer support', 'call center', 'crm', 'salesforce', 'quickbooks',
  'sql', 'python', 'javascript', 'java', 'html', 'css', 'react',
  'cloud computing', 'aws', 'azure', 'devops', 'cybersecurity',
  'network administration', 'help desk', 'troubleshooting',
  'nursing', 'patient care', 'clinical', 'medical billing', 'phlebotomy',
  'healthcare', 'compliance', 'regulatory', 'quality assurance',
  'quality control', 'manufacturing', 'warehouse', 'forklift',
  'construction', 'electrical', 'plumbing', 'hvac', 'welding',
  'retail', 'merchandising', 'point of sale', 'cash handling',
  'hospitality', 'food service', 'event planning', 'human resources',
  'payroll', 'benefits administration', 'legal', 'paralegal',
  'contract negotiation', 'procurement', 'vendor management',
  'strategic planning', 'business development', 'account management',
  'client relations', 'presentation', 'data entry', 'typing',
  'problem solving', 'critical thinking', 'time management',
  'organization', 'multitasking', 'teamwork', 'collaboration',
  'bilingual', 'spanish', 'graphic design', 'adobe photoshop',
  'video editing', 'ui/ux', 'agile', 'scrum', 'kanban',
]

/**
 * Exact-meaning synonyms for a canonical SKILL_KEYWORDS entry -- same
 * skill, different surface form ("js" vs "javascript"). A match here is
 * a CONFIRMED_MATCH, not a weaker "transferable" signal. Deliberately
 * small and hand-curated (YAGNI/in-house per the OSS research
 * conclusion) -- grow this list with real data, not a taxonomy import.
 */
const ALIAS_MAP: Record<string, string[]> = {
  javascript: ['js'],
  python: ['py'],
  sql: ['structured query language'],
  'project management': ['pm'],
  'microsoft office': ['ms office', 'msoffice'],
}

/**
 * Related-but-not-identical skills that reasonably transfer to a JD
 * requirement -- weaker evidence than an exact/alias match, classified
 * LIKELY_TRANSFERABLE. Also small and hand-curated; this is exactly the
 * kind of mapping a future O*NET/ESCO integration could deepen (see the
 * design spec's Phase 2 conclusion) without changing this module's
 * shape.
 */
const TRANSFERABLE_MAP: Record<string, string[]> = {
  sql: ['data analysis', 'analytics', 'database'],
  'project management': ['scheduling', 'operations', 'logistics'],
  leadership: ['management', 'coaching', 'mentoring'],
  management: ['leadership', 'coaching', 'operations'],
  'customer service': ['customer support', 'call center', 'hospitality', 'retail'],
  'customer support': ['customer service', 'help desk', 'troubleshooting'],
  sales: ['customer service', 'business development', 'account management', 'negotiation'],
  'business development': ['sales', 'account management', 'client relations'],
  accounting: ['bookkeeping', 'budgeting', 'quickbooks'],
  bookkeeping: ['accounting', 'budgeting', 'data entry'],
  'data analysis': ['sql', 'analytics', 'excel'],
  analytics: ['data analysis', 'sql', 'excel'],
  'data entry': ['typing', 'bookkeeping', 'organization'],
  operations: ['logistics', 'supply chain', 'inventory', 'scheduling'],
  logistics: ['operations', 'supply chain', 'inventory', 'scheduling'],
  'supply chain': ['logistics', 'operations', 'inventory', 'procurement'],
  inventory: ['warehouse', 'logistics', 'supply chain'],
  warehouse: ['inventory', 'logistics', 'forklift'],
  training: ['coaching', 'mentoring', 'onboarding'],
  coaching: ['mentoring', 'training', 'leadership'],
  mentoring: ['coaching', 'training', 'leadership'],
  recruiting: ['onboarding', 'human resources', 'interviewing'],
  'human resources': ['recruiting', 'onboarding', 'payroll', 'benefits administration'],
  marketing: ['social media', 'content creation', 'seo', 'writing'],
  'social media': ['marketing', 'content creation', 'writing'],
  'content creation': ['writing', 'editing', 'social media', 'marketing'],
  writing: ['editing', 'content creation', 'communication'],
  'quality assurance': ['quality control', 'compliance', 'regulatory'],
  'quality control': ['quality assurance', 'compliance', 'manufacturing'],
  'help desk': ['customer support', 'troubleshooting', 'network administration'],
  troubleshooting: ['help desk', 'network administration', 'customer support'],
  'event planning': ['scheduling', 'logistics', 'organization', 'hospitality'],
  hospitality: ['customer service', 'food service', 'event planning'],
  'food service': ['hospitality', 'customer service', 'retail'],
  retail: ['customer service', 'merchandising', 'point of sale', 'sales'],
  'point of sale': ['retail', 'cash handling', 'customer service'],
  'cash handling': ['point of sale', 'retail', 'bookkeeping'],
  'contract negotiation': ['negotiation', 'procurement', 'vendor management'],
  'vendor management': ['procurement', 'contract negotiation', 'operations'],
  procurement: ['vendor management', 'supply chain', 'contract negotiation'],
  paralegal: ['legal', 'compliance', 'contract negotiation'],
  legal: ['paralegal', 'compliance', 'contract negotiation'],
  'strategic planning': ['business development', 'operations', 'management'],
  'account management': ['sales', 'client relations', 'customer service'],
  'client relations': ['account management', 'customer service', 'sales'],
}

/** A profile with fewer than this many total distinct skills on record
 * (flat + Forward DNA combined) doesn't have enough evidence to
 * confidently call an undetected skill a gap -- it's UNKNOWN instead.
 * Deliberately low (only a truly empty skill list counts as "sparse") --
 * per the "Unknown != Missing" principle a member should get the benefit
 * of the doubt only when FreshFit has *no* skill data at all, not merely
 * a short list; once a member has recorded anything, an undetected JD
 * skill is meaningful signal, not an evidence gap. */
const SPARSE_PROFILE_THRESHOLD = 1

function normalize(text: string): string {
  return (text || '').toLowerCase()
}

export function findSkillsInText(text: string, dictionary: string[] = SKILL_KEYWORDS): string[] {
  const normalized = normalize(text)
  return dictionary.filter((skill) => normalized.includes(skill))
}

/**
 * Classifies one JD-detected skill against everything FreshlyForward
 * knows about a member. "Unknown != Missing": a skill FreshFit can't
 * find anywhere is only ever a CONFIRMED_GAP when the member's profile
 * has enough other skill data on record to make that absence meaningful
 * -- otherwise it's UNKNOWN.
 *
 * Exported (OE 2.0 Phase 2) so `qualifications.ts`'s must-have hard
 * constraint reuses this exact classification logic instead of a
 * second copy -- "must-have vs. nice-to-have" is a question of *which*
 * skills to check, not a different way of checking them.
 */
export function classifySkill(
  jdSkill: string,
  flatSkills: string[],
  careerSkills: CareerSkill[],
  confirmedCapabilities: string[] = []
): EvidenceStatus {
  const normalizedFlat = new Set(flatSkills.map(normalize))
  const careerSkillNames = new Set(careerSkills.map((s) => normalize(s.skill_name)))
  // Career Vault's confirmed capabilities (career_win_capabilities,
  // status='confirmed') are the strongest possible evidence -- a
  // member-confirmed, capability-engine-reasoned skill promoted out of a
  // real Career Win. Treated as an additional confirmed_match source,
  // same tier as an exact flat/career-skill match (never weaker).
  const confirmedCapabilityNames = new Set(confirmedCapabilities.map(normalize))
  const exactSurfaceForms = [jdSkill, ...(ALIAS_MAP[jdSkill] ?? [])]

  if (
    exactSurfaceForms.some(
      (form) => careerSkillNames.has(form) || normalizedFlat.has(form) || confirmedCapabilityNames.has(form)
    )
  ) {
    return 'confirmed_match'
  }

  const transferableForms = TRANSFERABLE_MAP[jdSkill] ?? []
  if (
    transferableForms.some(
      (form) => normalizedFlat.has(form) || careerSkillNames.has(form) || confirmedCapabilityNames.has(form)
    )
  ) {
    return 'likely_transferable'
  }

  const totalDistinctSkills = new Set([...normalizedFlat, ...careerSkillNames, ...confirmedCapabilityNames]).size
  return totalDistinctSkills < SPARSE_PROFILE_THRESHOLD ? 'unknown' : 'confirmed_gap'
}

const CLASSIFICATION_WEIGHT: Partial<Record<EvidenceStatus, number>> = {
  confirmed_match: 1,
  likely_transferable: 0.6,
  confirmed_gap: 0,
}

/**
 * True when a JD skill's match is specifically grounded in a Career
 * Vault confirmed capability -- FreshlyForward's strongest possible
 * skill evidence (a member-confirmed, capability-engine-reasoned skill
 * promoted out of a real Career Win, not just free-text the member
 * typed into a form). Reuses the exact same ALIAS_MAP/TRANSFERABLE_MAP
 * surface-form lookup `classifySkill` already does, rather than a
 * second parallel definition of "what counts as a match for this JD
 * skill." Used only for explainability (which matches to call out by
 * name in the dimension's explanation) -- never changes the score or
 * the EvidenceStatus itself.
 */
export function isGroundedInCareerVault(jdSkill: string, confirmedCapabilities: string[]): boolean {
  const confirmedCapabilityNames = new Set(confirmedCapabilities.map(normalize))
  const surfaceForms = [jdSkill, ...(ALIAS_MAP[jdSkill] ?? []), ...(TRANSFERABLE_MAP[jdSkill] ?? [])]
  return surfaceForms.some((form) => confirmedCapabilityNames.has(form))
}

export interface SkillsEvidenceResult {
  score: number
  evidence: string[]
  gaps: string[]
  unknowns: string[]
  /** Subset of `evidence` specifically grounded in a Career Vault confirmed capability (OE 2.0 Phase 2) -- for explanation copy only. */
  groundedByCareerVault: string[]
  legacyBreakdown: {
    skillsCoverage: number
    dnaSkillEvidence: number
    scopeFit: number
  }
}

/**
 * The "Skills & Evidence" dimension -- consolidates what used to be
 * three separate flat breakdown buckets (skillsCoverage, dnaSkillEvidence,
 * scopeFit) into one explainable, evidence-status-aware dimension, per
 * the design spec's Q1/Q3/5.2. `legacyBreakdown` still populates the old
 * three keys additively so existing readers of `score_breakdown` (e.g.
 * `buildWhyItMatches`) keep working unchanged.
 */
export function scoreSkillsDimension(
  flatSkills: string[],
  careerSkills: CareerSkill[],
  careerScope: CareerScope[],
  jobText: string,
  confirmedCapabilities: string[] = []
): SkillsEvidenceResult {
  const jdSkills = [...new Set(findSkillsInText(jobText))]

  const evidence: string[] = []
  const gaps: string[] = []
  const unknowns: string[] = []
  const groundedByCareerVault: string[] = []
  let weightedSum = 0
  let countedSkills = 0

  for (const jdSkill of jdSkills) {
    const status = classifySkill(jdSkill, flatSkills, careerSkills, confirmedCapabilities)
    if (status === 'confirmed_match' || status === 'likely_transferable') {
      evidence.push(jdSkill)
      if (isGroundedInCareerVault(jdSkill, confirmedCapabilities)) groundedByCareerVault.push(jdSkill)
    } else if (status === 'confirmed_gap') gaps.push(jdSkill)
    else unknowns.push(jdSkill)

    const weight = CLASSIFICATION_WEIGHT[status]
    if (weight !== undefined) {
      weightedSum += weight
      countedSkills++
    }
  }

  // No JD skills detected, or every detected skill is unknown -- neutral,
  // never penalized (same "no signal = neutral credit" philosophy the
  // original engine used throughout).
  const base = countedSkills === 0 ? 50 : Math.round((weightedSum / countedSkills) * 100)
  const scopeBonusPoints = scoreScopeFit(careerScope, jobText)
  const score = Math.min(100, base + scopeBonusPoints)

  const dnaEvidence = scoreSkillEvidence(careerSkills, jdSkills)
  const skillsCoverage =
    jdSkills.length === 0
      ? 25
      : Math.round((evidence.length / jdSkills.length) * 50)

  return {
    score,
    evidence,
    gaps,
    unknowns,
    groundedByCareerVault,
    legacyBreakdown: {
      skillsCoverage,
      dnaSkillEvidence: dnaEvidence.points,
      scopeFit: scopeBonusPoints,
    },
  }
}
