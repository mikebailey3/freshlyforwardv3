import type { CareerWinInterpreter, InterpretedCareerWin } from './interpreter'

const CURRENCY_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:billion|bn|million|m|k)?\b/i
const PERCENTAGE_RE = /\b\d+(?:\.\d+)?\s?%/
const COUNT_RE = /\b(\d+)\s+(?:associates|employees|people|team members|direct reports|reports|clients|customers|stores|locations)\b/i

interface CategoryRule {
  pattern: RegExp
  category: string
}

// Order matters -- first match wins, most-specific-first.
const CATEGORY_RULES: CategoryRule[] = [
  { pattern: /\bdevelop(ed)?\s+\w+\s+(associates|employees|people|team)|\bmentor|\bcoach|\bpromot/i, category: 'Leadership / People Development' },
  { pattern: /\$|\bcost\b|\bbudget\b|\brevenue\b|\bsales\b|\bprofit\b|\bloss\b/i, category: 'Financial / Operational Impact' },
  { pattern: /\bprocess\b|\befficien|\bstreamlin|\bautomat/i, category: 'Process Improvement' },
  { pattern: /\binventory\b|\bstock\b|\bsupply chain/i, category: 'Operational Execution' },
]

function extractCurrency(statement: string): { value: number; raw: string } | null {
  const match = statement.match(CURRENCY_RE)
  if (!match) return null
  const raw = match[0]
  const numeric = raw.replace(/[^0-9.]/g, '')
  let value = Number(numeric)
  if (/billion|bn\b/i.test(raw)) value *= 1_000_000_000
  else if (/million|m\b/i.test(raw)) value *= 1_000_000
  else if (/k\b/i.test(raw)) value *= 1_000
  return Number.isFinite(value) ? { value, raw } : null
}

function extractPercentage(statement: string): { value: number; raw: string } | null {
  const match = statement.match(PERCENTAGE_RE)
  if (!match) return null
  const raw = match[0]
  const value = Number(raw.replace('%', '').trim())
  return Number.isFinite(value) ? { value, raw } : null
}

function extractCount(statement: string): { value: number; raw: string } | null {
  const match = statement.match(COUNT_RE)
  if (!match) return null
  return { value: Number(match[1]), raw: match[0] }
}

function inferCategory(statement: string): string | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(statement)) return rule.category
  }
  return null
}

export class DeterministicCareerWinInterpreter implements CareerWinInterpreter {
  interpret(statement: string): Promise<InterpretedCareerWin> {
    const category = inferCategory(statement)

    const currency = extractCurrency(statement)
    if (currency) {
      return Promise.resolve({ metricType: 'currency', metricValue: currency.value, metricRaw: currency.raw, category })
    }

    const percentage = extractPercentage(statement)
    if (percentage) {
      return Promise.resolve({ metricType: 'percentage', metricValue: percentage.value, metricRaw: percentage.raw, category })
    }

    const count = extractCount(statement)
    if (count) {
      return Promise.resolve({ metricType: 'count', metricValue: count.value, metricRaw: count.raw, category })
    }

    return Promise.resolve({ metricType: null, metricValue: null, metricRaw: null, category })
  }
}
