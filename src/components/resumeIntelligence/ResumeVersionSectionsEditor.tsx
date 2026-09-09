import type { ResumeEditorAction, ResumeEditorEntry, ResumeEditorState } from '@/lib/resumeIntelligence/presentation/resumeEditorReducer'
import { DEFAULT_SECTION_LABELS, KNOWN_SECTION_KEYS } from '@/lib/resumeIntelligence/presentation/types'
import type { ResumeSectionKey } from '@/lib/resumeIntelligence/presentation/types'
import { RESUME_TEMPLATES } from '@/lib/resumeIntelligence/templates/registry'
import { SortableList } from './SortableList'
import type { SortableListItem } from './SortableList'
import type { MemberProfile } from '@/types'

const SECTION_TO_ENTRY_KIND: Record<ResumeSectionKey, ResumeEditorEntry['entryKind']> = {
  employment: 'employment',
  education: 'education',
  certifications: 'certification',
  skills: 'skill',
}

function labelForEntry(entry: ResumeEditorEntry, profile: MemberProfile): string {
  if (entry.entryKind === 'skill') return entry.skillValue ?? 'Unknown skill'
  if (entry.entryKind === 'employment') {
    const canonical = profile.employment_history.find((e) => e.id === entry.canonicalEntryId)
    return canonical ? `${canonical.title || 'Untitled role'} \u2014 ${canonical.company || 'Unknown company'}` : 'Employment entry no longer on your Profile'
  }
  if (entry.entryKind === 'education') {
    const canonical = profile.education.find((e) => e.id === entry.canonicalEntryId)
    return canonical ? `${canonical.degree || 'Degree'} \u2014 ${canonical.institution || 'Institution'}` : 'Education entry no longer on your Profile'
  }
  const canonical = profile.certifications.find((e) => e.id === entry.canonicalEntryId)
  return canonical ? canonical.name || 'Certification' : 'Certification no longer on your Profile'
}

interface ResumeVersionSectionsEditorProps {
  state: ResumeEditorState
  profile: MemberProfile
  dispatch: (action: ResumeEditorAction) => void
}

/**
 * Phase 5 completion — the actual visual editor: section visibility
 * (via per-entry include/exclude -- unchecking every entry in a section
 * hides it entirely, since a section with zero included entries is never
 * rendered, per `resumeViewModel.ts`), section ordering, entry ordering,
 * template selection, summary override, and per-employment-entry
 * description override, all driven by the pure `resumeEditorReducer`.
 * Never lets the member type a brand-new canonical fact here -- every
 * checkbox/override still resolves back to something already on the
 * Career Profile (same discipline as `MasterResumeBuilder`).
 */
export function ResumeVersionSectionsEditor({ state, profile, dispatch }: ResumeVersionSectionsEditorProps) {
  const sectionItems: SortableListItem[] = state.sectionOrder
    .filter((key): key is ResumeSectionKey => (KNOWN_SECTION_KEYS as string[]).includes(key))
    .map((key) => ({ id: key, label: DEFAULT_SECTION_LABELS[key] }))

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="text-sm font-semibold text-ink">Template</span>
        <select
          value={state.templateKey}
          onChange={(e) => dispatch({ type: 'setTemplateKey', templateKey: e.target.value })}
          className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink"
        >
          {RESUME_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-ink">Summary override (this version only)</span>
        <textarea
          value={state.summaryOverride ?? ''}
          onChange={(e) => dispatch({ type: 'setSummaryOverride', text: e.target.value || null })}
          placeholder="Leave blank to use your Career Profile's summary as-is."
          rows={3}
          className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink"
        />
      </label>

      <section>
        <h3 className="font-serif text-base font-semibold text-ink">Section order</h3>
        <p className="mt-1 text-xs text-ink-muted">Drag to reorder, or Tab to a section and use arrow keys. A section with every entry unchecked below is hidden from this resume entirely.</p>
        <div className="mt-2">
          <SortableList items={sectionItems} onReorder={(ids) => dispatch({ type: 'reorderSections', sectionOrder: ids })} />
        </div>
      </section>

      {state.sectionOrder.map((sectionKey) => {
        const key = sectionKey as ResumeSectionKey
        if (!(KNOWN_SECTION_KEYS as string[]).includes(key)) return null
        const entryKind = SECTION_TO_ENTRY_KIND[key]
        const entries = state.entries.filter((e) => e.entryKind === entryKind).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        if (entries.length === 0) return null

        return (
          <section key={key}>
            <h3 className="font-serif text-base font-semibold text-ink">{DEFAULT_SECTION_LABELS[key]}</h3>
            <div className="mt-2 space-y-2">
              {entries.map((entry) => (
                <div key={entry.entryId} className="border border-border bg-surface-card p-3">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={entry.included} onChange={() => dispatch({ type: 'toggleIncluded', entryId: entry.entryId })} className="mt-1" />
                    <span className="text-sm text-ink">{labelForEntry(entry, profile)}</span>
                  </label>
                  {entry.entryKind === 'employment' && (
                    <textarea
                      value={entry.overrideDescription ?? ''}
                      onChange={(e) => dispatch({ type: 'setOverrideDescription', entryId: entry.entryId, text: e.target.value || null })}
                      rows={2}
                      className="mt-2 w-full border border-border bg-surface-elevated px-2 py-1.5 text-xs text-ink"
                      placeholder="Resume-specific wording for this entry (your Career Profile is unchanged)"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-xs font-medium text-ink-muted">Reorder {DEFAULT_SECTION_LABELS[key].toLowerCase()}</p>
              <div className="mt-1">
                <SortableList
                  items={entries.map((e) => ({ id: e.entryId, label: labelForEntry(e, profile) }))}
                  onReorder={(ids) => dispatch({ type: 'reorderEntries', entryIds: ids })}
                />
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
