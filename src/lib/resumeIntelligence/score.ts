import type { ResumeFinding, ResumeFindingSeverity } from '@/types/resume'

/**
 * Shared, deterministic point-deduction scorer used by every scored
 * dimension (atsReadability, structuralQuality, contentStrength,
 * quantification). Starts at 100, deducts a fixed penalty per finding by
 * severity, clamps to [0, 100]. Kept in one place so every dimension's
 * score is derived the same explainable way instead of four divergent
 * formulas.
 */
const SEVERITY_PENALTY: Record<ResumeFindingSeverity, number> = {
  error: 25,
  warning: 10,
  info: 3,
}

export function scoreFromFindings(findings: readonly ResumeFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0)
  return Math.max(0, Math.min(100, 100 - penalty))
}
