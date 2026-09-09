import { TemplateRenderer } from '@/lib/resumeIntelligence/presentation/TemplateRenderer'
import type { ResumeViewModel } from '@/lib/resumeIntelligence/presentation/types'

/**
 * Phase 5 — live preview. Thin wrapper so the page/editor imports a
 * component from the usual `components/resumeIntelligence` location while
 * the actual rendering logic (shared with export-time snapshotting, if a
 * future PDF-from-screenshot path is ever needed) lives once, in
 * `TemplateRenderer`. Re-renders on every `viewModel` change -- no reload,
 * no separate "preview mode" data path.
 */
export function ResumePreview({ viewModel }: { viewModel: ResumeViewModel }) {
  return <TemplateRenderer viewModel={viewModel} />
}
