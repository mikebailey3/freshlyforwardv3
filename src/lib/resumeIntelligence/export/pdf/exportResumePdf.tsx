// Stale duplicate -- real implementation moved to pdfExportImpl.tsx after
// discovering a .ts/.tsx same-basename resolver ambiguity (this project's
// resolver picks exportResumePdf.ts over this file when both exist with
// the same base name, even though this one had the real code first).
// Safe to delete once cleanup is done -- flagged in the final report's
// cleanup list.
export * from './pdfExportImpl'
