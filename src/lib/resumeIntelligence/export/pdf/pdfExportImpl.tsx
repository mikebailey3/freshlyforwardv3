import { pdf } from '@react-pdf/renderer'
import type { ResumeViewModel } from '../../presentation/types'
import { ResumePdfDocument } from './ResumePdfDocument'

/**
 * Phase 5 (5.6/5.7) — the real PDF export implementation. Named
 * distinctly from `exportResumePdf.ts`/`.tsx` (both of which now just
 * re-export this) after discovering, during this pass's own tests, that
 * having both a `.ts` and `.tsx` file share a base name in this project's
 * resolver silently picks the `.ts` file even when the real code is in
 * the `.tsx` one -- a real module-resolution bug, not just a lint nit.
 * One unambiguous filename avoids it outright.
 */
export async function exportResumePdf(viewModel: ResumeViewModel): Promise<Blob> {
  return pdf(<ResumePdfDocument viewModel={viewModel} />).toBlob()
}

/**
 * Built on top of `exportResumePdf`'s `Blob` rather than `@react-pdf/
 * renderer`'s own `.toBuffer()` -- under this project's jsdom test
 * environment, `.toBuffer()` picks a code path that produced a corrupted
 * flate stream (discovered by this pass's own round-trip test failing to
 * reparse). `Blob.arrayBuffer()` is environment-agnostic (works under
 * jsdom and a real browser) and is what the round-trip export -> reparse
 * -> validate test, and any future server export route, should use.
 */
export async function exportResumePdfBuffer(viewModel: ResumeViewModel): Promise<Buffer> {
  const blob = await exportResumePdf(viewModel)
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
