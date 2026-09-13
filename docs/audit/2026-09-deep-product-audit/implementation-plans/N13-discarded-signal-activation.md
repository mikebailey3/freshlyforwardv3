# Implementation Plan — N13: SPLIT (see N13a / N13b)

**This plan was split on 2026-09-12 per ChatGPT/owner review.** The original combined ticket mixed
two different complexity classes; do not use this file for implementation guidance. See:

- **`N13a-lifecycle-signal-activation.md`** — the immediate, high-value fix (X8a): wiring the three
  lifecycle signals `useForwardScore.ts` already computes but discards. IN PROGRESS.
- **`N13b-evidence-specific-next-best-move.md`** — naming a specific weak-evidence skill in copy
  (X4a). BLOCKED — requires its own architecture ruling on the canonical data path before any
  implementation begins.

Full split rationale is documented in N13a's "Split rationale" section.
