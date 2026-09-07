export interface CapabilitySuggestion {
  skillName: string
  reason: string
}

export interface CapabilityRule {
  pattern: RegExp
  skillName: string
  reason: string
}

export const CAPABILITY_RULES: CapabilityRule[] = [
  {
    pattern: /\binventory\b|\bstock\b/i,
    skillName: 'Inventory Management',
    reason: 'Statement mentions inventory or stock.',
  },
  {
    pattern: /\$|\bcost\b|\bbudget\b|\brevenue\b|\bsales\b|\bprofit\b/i,
    skillName: 'Financial Performance',
    reason: 'Statement mentions a financial outcome (cost, budget, revenue, sales, or profit).',
  },
  {
    pattern: /\bsolv|\bfix(ed)?\b|\btroubleshoot/i,
    skillName: 'Problem Solving',
    reason: 'Statement describes solving or fixing a problem.',
  },
  {
    pattern: /\bprocess\b|\befficien|\bstreamlin|\bautomat|\boperation/i,
    skillName: 'Operational Execution',
    reason: 'Statement describes a process or operational change.',
  },
  {
    pattern: /\bdevelop(ed)?\s+\w+\s+(associates|employees|people|team)|\bmentor|\bcoach(ed)?|\bpromoted\b/i,
    skillName: 'People Development',
    reason: 'Statement describes developing, mentoring, coaching, or promoting others.',
  },
  {
    pattern: /\blead\w*|\bmanaged a team|\bsupervis/i,
    skillName: 'Leadership',
    reason: 'Statement describes leading, managing, or supervising others.',
  },
]

export function inferCapabilities(statement: string): CapabilitySuggestion[] {
  const suggestions: CapabilitySuggestion[] = []
  for (const rule of CAPABILITY_RULES) {
    if (rule.pattern.test(statement)) {
      suggestions.push({ skillName: rule.skillName, reason: rule.reason })
    }
  }
  return suggestions
}
