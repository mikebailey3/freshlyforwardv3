/*
# Career Compass Results — Persist Recommendation Reasons

## Overview
Adds a `reasons` column to `career_compass_results` so the results
page's slow-path (page refresh, re-entry via a stored assessmentId)
can show the exact same reasoning text the fast-path showed at
completion time, instead of an approximated reconstruction. Additive,
backward-compatible: existing rows (there are none yet in production)
would default to an empty array.
*/

ALTER TABLE career_compass_results
  ADD COLUMN IF NOT EXISTS reasons jsonb NOT NULL DEFAULT '[]'::jsonb;
