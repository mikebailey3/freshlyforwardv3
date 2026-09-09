import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { exportResumePdf } from '@/lib/resumeIntelligence/export/pdf/pdfExportImpl'
import { exportResumeDocx } from '@/lib/resumeIntelligence/export/docx/exportResumeDocx'
import type { ResumeViewModel } from '@/lib/resumeIntelligence/presentation/types'

interface ResumeExportButtonsProps {
  viewModel: ResumeViewModel
  fileBaseName: string
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Phase 5 — the one export entry point the live builder page uses.
 * Shares the exact same `ResumeViewModel` the on-screen preview renders
 * (no second content path -- what the member sees is what gets
 * exported). Reports export failures honestly instead of silently
 * producing an empty/broken file.
 */
export function ResumeExportButtons({ viewModel, fileBaseName }: ResumeExportButtonsProps) {
  const [busyFormat, setBusyFormat] = useState<'pdf' | 'docx' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: 'pdf' | 'docx') => {
    setBusyFormat(format)
    setError(null)
    try {
      const blob = format === 'pdf' ? await exportResumePdf(viewModel) : await exportResumeDocx(viewModel)
      downloadBlob(blob, `${fileBaseName}.${format}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not export ${format.toUpperCase()}.`)
    } finally {
      setBusyFormat(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busyFormat !== null}
          onClick={() => handleExport('pdf')}
          className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover disabled:opacity-60"
        >
          {busyFormat === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export PDF
        </button>
        <button
          type="button"
          disabled={busyFormat !== null}
          onClick={() => handleExport('docx')}
          className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover disabled:opacity-60"
        >
          {busyFormat === 'docx' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export DOCX
        </button>
      </div>
      {error && <p className="text-xs text-error-300">{error}</p>}
    </div>
  )
}
