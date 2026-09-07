import type { ResumeFieldProvenance } from '@/types/resume'

/** Human-readable explanation derived FROM the structured provenance -- never a stored free-text field of its own. */
export function describeProvenance(p: ResumeFieldProvenance): string {
  const pageClause = p.page !== null ? `, page ${p.page}` : ''
  return `From the ${p.sectionKind} section${pageClause} — matched rule ${p.matchedRule} — source: "${p.sourceExcerpt}"`
}
