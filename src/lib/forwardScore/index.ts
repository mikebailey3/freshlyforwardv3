// src/lib/forwardScore/index.ts
export { computeForwardScore } from './score'
export type { ForwardScoreInputs } from './score'
export { getNextBestMove, PILLAR_PRIORITY } from './nextBestMove'
export type {
  ForwardScoreResult,
  ForwardScorePillarResult,
  ForwardScorePillarKey,
  NextBestMove,
  NextBestMoveKey,
} from '@/types/forwardScore'
