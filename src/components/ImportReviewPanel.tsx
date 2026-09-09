import { useState } from 'react'
import type { ProposalRow } from '@/lib/resumeIntelligence/import/reviewProposals'
import type { ConfirmationDecision } from '@/types/resume'
import type { ResumeSectionKind } from '@/lib/resumeIntelligence/parsing/types'

/**
 * The Phase 3 Import Review workflow: a focused review of parsed resume
 * proposals, grouped the way a member thinks about their resume -- never
 * a resume editor. Decisions are reported one at a time via `onDecide`
 * (the caller persists incrementally, see recordProposalDecision), so
 * leaving/reloading never loses progress -- this component only renders
 * whatever `proposals` it's given.
 */

const SECTION_ORDER: ResumeSectionKind[] = ['contact', 'summary', 'employment', 'education', 'certifications', 'skills', 'unknown']

const SECTION_LABELS: Record<ResumeSectionKind, string> = {
  contact: 'Contact',
  summary: 'Summary',
  employment: 'Employment',
  education: 'Education',
  certifications: 'Certifications',
  skills: 'Skills',
  unknown: 'Other',
}

const DECISION_LABELS: Record<ConfirmationDecision, string> = {
  reject: 'Not correct, discard',
  accept_as_canonical: 'Yes, update my Career Profile',
  accept_edited_canonical: 'Update my Profile, let me fix the wording',
  keep_existing_canonical: 'No thanks, keep what’s on my Profile',
  use_as_resume_specific_only: 'Use this wording here only',
}

/**
 * Which decisions actually apply to a given proposal -- filters out
 * combinations the confirmation layer would always reject anyway
 * (keep_existing_canonical implies something already exists;
 * accept_as_canonical never applies to a purely presentational
 * resume-specific field).
 */
function availableDecisionsFor(row: ProposalRow): ConfirmationDecision[] {
  if (row.destination_kind === 'resume-specific') {
    return ['use_as_resume_specific_only', 'reject']
  }
  if (row.proposed_action === 'create') {
    return ['accept_as_canonical', 'accept_edited_canonical', 'reject']
  }
  return ['accept_as_canonical', 'accept_edited_canonical', 'keep_existing_canonical', 'use_as_resume_specific_only', 'reject']
}

function whatChangesText(row: ProposalRow, decision: ConfirmationDecision): string {
  if (decision === 'reject' || decision === 'keep_existing_canonical') return 'Your Career Profile is unchanged.'
  if (decision === 'use_as_resume_specific_only') return 'Used on this resume only — your Career Profile is unchanged.'
  return `This will update your Career Profile’s ${row.destination_field.replace(/_/g, ' ')}.`
}

interface ImportReviewPanelProps {
  proposals: ProposalRow[]
  onDecide: (row: ProposalRow, decision: ConfirmationDecision, editedValue?: string) => Promise<string | null> | void
}

export function ImportReviewPanel({ proposals, onDecide }: ImportReviewPanelProps) {
  const bySection = new Map<ResumeSectionKind, ProposalRow[]>()
  for (const row of proposals) {
    const kind = row.provenance_section_kind as ResumeSectionKind
    const list = bySection.get(kind) ?? []
    list.push(row)
    bySection.set(kind, list)
  }

  return (
    <div className="space-y-8">
      {SECTION_ORDER.filter((kind) => bySection.has(kind)).map((kind) => (
        <SectionGroup key={kind} kind={kind} rows={bySection.get(kind) ?? []} onDecide={onDecide} />
      ))}
    </div>
  )
}

function SectionGroup({ kind, rows, onDecide }: { kind: ResumeSectionKind; rows: ProposalRow[]; onDecide: ImportReviewPanelProps['onDecide'] }) {
  const pending = rows.filter((r) => r.status === 'pending')
  // Conservative bulk action: only proposals both still pending AND high
  // confidence are ever bulk-eligible -- medium/low confidence is never
  // pre-selected or bulk-actionable, and only for a destination bulk
  // acceptance actually makes sense (not resume-specific-only sections).
  const bulkEligible = pending.filter((r) => r.confidence === 'high' && r.destination_kind !== 'resume-specific')

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold text-ink">{SECTION_LABELS[kind]}</h3>
        {bulkEligible.length > 1 && (
          <BulkAcceptButton rows={bulkEligible} onDecide={onDecide} />
        )}
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <ProposalCard key={row.id} row={row} onDecide={onDecide} />
        ))}
      </div>
    </section>
  )
}

function BulkAcceptButton({ rows, onDecide }: { rows: ProposalRow[]; onDecide: ImportReviewPanelProps['onDecide'] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-medium text-primary-600 hover:underline"
      >
        Accept all {rows.length} high-confidence items
      </button>
      {expanded && (
        <div className="mt-2 border border-border bg-surface-subtle p-3 text-left text-xs text-ink-muted">
          <p className="font-medium text-ink">This will update your Career Profile with:</p>
          <ul className="mt-1 list-disc pl-4">
            {rows.map((r) => (
              <li key={r.id}>{r.destination_field.replace(/_/g, ' ')}: {r.candidate_value}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={async () => {
              for (const row of rows) await onDecide(row, 'accept_as_canonical')
              setExpanded(false)
            }}
            className="mt-3 rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
          >
            Confirm -- accept all {rows.length}
          </button>
        </div>
      )}
    </div>
  )
}

function ProposalCard({ row, onDecide }: { row: ProposalRow; onDecide: ImportReviewPanelProps['onDecide'] }) {
  const [showProvenance, setShowProvenance] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedValue, setEditedValue] = useState(row.candidate_value)

  if (row.status === 'reviewed') {
    return (
      <div className="border border-border bg-surface-subtle p-3 text-sm text-ink-muted">
        <span className="font-medium text-ink">{row.destination_field.replace(/_/g, ' ')}:</span> {row.candidate_value}
        <span className="ml-2 text-xs">({row.decision ? DECISION_LABELS[row.decision] : 'reviewed'})</span>
      </div>
    )
  }

  const decisions = availableDecisionsFor(row)

  return (
    <div className="border border-border bg-surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{row.destination_field.replace(/_/g, ' ')}</p>
          <p className="mt-1 text-sm text-ink">{row.candidate_value}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {row.confidence} confidence
        </span>
      </div>

      <button
        type="button"
        onClick={() => setShowProvenance((v) => !v)}
        className="mt-2 text-xs text-primary-600 hover:underline"
      >
        {showProvenance ? 'Hide source' : 'Why did we suggest this?'}
      </button>
      {showProvenance && (
        <p className="mt-1 border-l-2 border-border pl-2 text-xs text-ink-muted">
          Found in your uploaded document: “{row.provenance_source_excerpt}”
          {row.provenance_page ? ` (page ${row.provenance_page})` : ''}
        </p>
      )}

      {editing ? (
        <div className="mt-3 flex gap-2">
          <input
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            className="flex-1 border border-border bg-surface-elevated px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => onDecide(row, 'accept_edited_canonical', editedValue)}
            className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {decisions.map((decision) => (
            <button
              key={decision}
              type="button"
              title={whatChangesText(row, decision)}
              onClick={() => (decision === 'accept_edited_canonical' ? setEditing(true) : onDecide(row, decision))}
              className="border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover"
            >
              {DECISION_LABELS[decision]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
