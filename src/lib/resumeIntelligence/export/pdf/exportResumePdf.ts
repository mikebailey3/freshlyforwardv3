// Stale duplicate -- real implementation moved to pdfExportImpl.tsx after
// discovering a .ts/.tsx same-basename resolver ambiguity (see that file's
// doc comment). This re-export keeps `import ... from './exportResumePdf'`
// working correctly regardless of which of .ts/.tsx the resolver picks.
// Both this file and exportResumePdf.tsx are safe to delete once cleanup
// is done -- flagged in the final report's cleanup list.
export * from './pdfExportImpl'
