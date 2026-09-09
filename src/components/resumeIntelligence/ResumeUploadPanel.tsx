import { useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'

interface ResumeUploadPanelProps {
  busy: boolean
  onUpload: (file: File) => Promise<string | null> | void
}

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt'

/**
 * Phase 4: the entry point into the whole workflow. Deliberately narrow
 * accept list -- matches the deterministic extractors this codebase
 * actually has (`resolveExtractor.ts`: PDF/DOCX/plain text). `.doc`/`.rtf`
 * are accepted elsewhere (onboarding's general document upload) but not
 * here, since Resume Intelligence has no extractor for them and would
 * otherwise silently produce an `unsupported_format` result.
 */
export function ResumeUploadPanel({ busy, onUpload }: ResumeUploadPanelProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) onUpload(file)
      }}
      className={`border-2 border-dashed p-8 text-center transition-all ${
        dragOver ? 'border-primary-500 bg-primary-950' : 'border-border bg-surface-elevated'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mx-auto flex flex-col items-center gap-3"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-950">
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary-600" /> : <Upload className="h-8 w-8 text-primary-600" />}
        </div>
        <p className="text-sm font-medium text-ink">{busy ? 'Scanning your resume…' : 'Click to upload or drag and drop your resume'}</p>
        <p className="text-xs text-ink-muted">PDF, DOCX, or TXT</p>
      </button>
    </div>
  )
}
