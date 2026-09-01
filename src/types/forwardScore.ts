/** Identifies one of the four pillars that make up the Forward Score composite. */
export type ForwardScorePillarKey =
  | 'forwardDnaDepth' | 'evidenceQuality' | 'careerMomentum' | 'goalAlignment'

/** The computed score, weight, and explanation for a single Forward Score pillar. */
export interface ForwardScorePillarResult {
  key: ForwardScorePillarKey
  label: string                // e.g. "Evidence Quality"
  score: number                 // 0-100, this pillar only
  weight: number                 // 0-1, e.g. 0.30
  explanation: string            // plain-language "why this number"
  improvementLink: { label: string; to: string } | null
}

/** The full Forward Score result: the weighted composite total plus its per-pillar breakdown. */
export interface ForwardScoreResult {
  total: number                  // 0-100, weighted composite
  pillars: ForwardScorePillarResult[]
}

/** Identifies which deterministic "next best move" rule matched for the current user. */
export type NextBestMoveKey =
  | 'add_career_win' | 'complete_forward_dna' | 'review_direction' | 'review_activity'

/** A single recommended action surfaced to the user based on their Forward Score inputs. */
export interface NextBestMove {
  key: NextBestMoveKey
  headline: string
  detail: string
  cta: { label: string; to: string }
}
