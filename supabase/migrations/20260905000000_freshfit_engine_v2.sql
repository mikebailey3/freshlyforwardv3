/*
# FreshFit 2.0 -- Engine Versioning

## Overview
Adds `engine_version` to `job_matches` so persisted matches can be
distinguished by which scoring engine computed them:
  - `1` = the original heuristic engine (src/lib/freshFitScore.ts, pre-2.0)
  - `2` = FreshFit 2.0's explainable, dimension-based engine
    (src/lib/freshFitScore/, see
    docs/superpowers/specs/2026-09-05-freshfit-2.0-explainable-scoring-design.md
    and the 2026-09-05 implementation plan)

This is purely additive -- no existing column changes, no data migration
of old rows (they default to `engine_version = 1` and are left alone).
`score_breakdown` stays the same jsonb column; v2 rows populate an
additional `v2` key inside it (see
src/lib/freshFitScore/score.ts::toScoreBreakdownPayload) without any
schema change required for that richer payload.

## Why this matters for the sync script rewrite
scripts/syncFreshFitScores.ts is moving from a single hard cutoff
(`MIN_SCORE_TO_STORE = 35`) to a smarter persistence policy: score every
active member x active job pair, keep a low noise floor, persist each
member's Top N regardless of the old cutoff, re-rank on every run, and
prune stale rows that fall out of the Top N -- but ONLY rows the sync
script itself owns (`engine_version = 2` and untouched: not dismissed,
not promoted). A member's dismissed or promoted matches, and any
`engine_version = 1` row left over from before this migration, are never
touched by the new pruning logic.

## Index
`idx_job_matches_member_engine` supports both the sync script's
per-member Top-N re-ranking query and the member-facing "top matches"
read, scoped to one engine version at a time.
*/

ALTER TABLE job_matches
  ADD COLUMN IF NOT EXISTS engine_version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_job_matches_member_engine
  ON job_matches(member_id, engine_version, fresh_fit_score DESC);

COMMENT ON COLUMN job_matches.engine_version IS
  '1 = original heuristic FreshFit engine, 2 = FreshFit 2.0 explainable engine. Determines which persistence/pruning rules apply and how score_breakdown should be interpreted.';
