// Thin re-export shim -- the real FreshFit implementation now lives in
// `src/lib/freshFitScore/` (decomposed into focused, independently
// tested modules: skillMatching, roleRelevance, careerDirection,
// compensation, location, confidence, recommendation, tiers, score).
//
// This file could not be deleted in this session (file deletion was
// explicitly blocked/rejected at the tool level, twice, even after the
// owner confirmed "retry the delete"). Node/TypeScript module
// resolution prefers an exact `freshFitScore.ts` file match over the
// sibling `freshFitScore/index.ts` directory, so as long as this file
// exists it must forward everything, otherwise every existing importer
// of `@/lib/freshFitScore` (opportunityEngine.ts, linkedinOptimizer.ts,
// scripts/syncFreshFitScores.ts) would silently resolve to this file and
// miss the v2 implementation entirely.
//
// Safe to delete manually once file-deletion works again -- nothing
// here is real logic, it's purely a forwarding shim.
export * from './freshFitScore/index'
