import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import type { MasterResumeEntryInput } from '@/lib/resumeIntelligence/masterResume/resumeEntryValidation'
import type { CertificationEntry, EducationEntry, EmploymentEntry } from '@/types'

interface MasterResumeBuilderProps {
  isExisting: boolean
  employment: EmploymentEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
  skills: string[]
  existingEntries: MasterResumeEntryInput[]
  summaryOverride: string | null
  busy: boolean
  onSave: (title: string, entries: MasterResumeEntryInput[]) => Promise<string | null> | void
  onSaveSummaryOverride: (overrideText: string | null) => Promise<string | null> | void
}

interface Selection {
  included: boolean
  overrideDescription: string | null
}

/**
 * Phase 4: builds/updates the member's Master Resume by selecting which
 * canonical Profile entries to include, in what order, with an optional
 * resume-specific description override for employment entries. Never
 * lets the member type free-form new career facts here -- every checkbox
 * corresponds to a `member_profiles` entry that already exists; adding a
 * brand-new fact still means adding it to the Career Profile first (or
 * confirming a parsed proposal canonically), never here.
 */
export function MasterResumeBuilder({
  isExisting, employment, education, certifications, skills, existingEntries,
  summaryOverride, busy, onSave, onSaveSummaryOverride,
}: MasterResumeBuilderProps) {
  const [title, setTitle] = useState('Master Resume')
  const [selections, setSelections] = useState<Record<string, Selection>>({})
  const [summaryDraft, setSummaryDraft] = useState(summaryOverride ?? '')

  useEffect(() => {
    setSummaryDraft(summaryOverride ?? '')
  }, [summaryOverride])

  useEffect(() => {
    const byKey = new Map(existingEntries.map((e) => [entryKey(e), e]))
    const next: Record<string, Selection> = {}
    for (const key of allKeys(employment, education, certifications, skills)) {
      const existing = byKey.get(key)
      next[key] = existing
        ? { included: existing.included, overrideDescription: existing.overrideDescription ?? null }
        : { included: true, overrideDescription: null }
    }
    setSelections(next)
    // Only re-derive defaults when the underlying Profile/existing selection actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employment, education, certifications, skills, existingEntries])

  const toggle = (key: string) =>
    setSelections((prev) => ({ ...prev, [key]: { ...prev[key], included: !prev[key]?.included } }))

  const setOverride = (key: string, value: string) =>
    setSelections((prev) => ({ ...prev, [key]: { ...prev[key], overrideDescription: value || null } }))

  const handleSave = () => {
    const entries: MasterResumeEntryInput[] = [
      ...employment.map((e, i): MasterResumeEntryInput | null =>
        e.id ? { entryKind: 'employment', canonicalEntryId: e.id, included: selections[`employment:${e.id}`]?.included ?? true, sortOrder: i, overrideDescription: selections[`employment:${e.id}`]?.overrideDescription ?? null } : null,
      ).filter((e): e is MasterResumeEntryInput => !!e),
      ...education.map((e, i): MasterResumeEntryInput | null =>
        e.id ? { entryKind: 'education', canonicalEntryId: e.id, included: selections[`education:${e.id}`]?.included ?? true, sortOrder: i } : null,
      ).filter((e): e is MasterResumeEntryInput => !!e),
      ...certifications.map((e, i): MasterResumeEntryInput | null =>
        e.id ? { entryKind: 'certification', canonicalEntryId: e.id, included: selections[`certification:${e.id}`]?.included ?? true, sortOrder: i } : null,
      ).filter((e): e is MasterResumeEntryInput => !!e),
      ...skills.map((value, i): MasterResumeEntryInput => ({
        entryKind: 'skill', skillValue: value, included: selections[`skill:${value}`]?.included ?? true, sortOrder: i,
      })),
    ]
    onSave(title, entries)
  }

  return (
    <div className="space-y-6">
      {!isExisting && (
        <label className="block">
          <span className="text-sm font-semibold text-ink">Master Resume title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
      )}

      <label className="block">
        <span className="text-sm font-semibold text-ink">Summary override (this Master only)</span>
        <textarea
          value={summaryDraft}
          onChange={(e) => setSummaryDraft(e.target.value)}
          placeholder="Leave blank to use your Career Profile's summary as-is."
          rows={3}
          className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onSaveSummaryOverride(summaryDraft.trim() || null)}
          className="mt-2 border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover"
        >
          Save summary override
        </button>
      </label>

      <EntrySection title="Employment" entries={employment.map((e) => ({ id: e.id, label: `${e.title || 'Untitled role'} — ${e.company || 'Unknown company'}`, description: e.description }))} kind="employment" selections={selections} onToggle={toggle} onOverride={setOverride} />
      <EntrySection title="Education" entries={education.map((e) => ({ id: e.id, label: `${e.degree || 'Degree'} — ${e.institution || 'Institution'}` }))} kind="education" selections={selections} onToggle={toggle} />
      <EntrySection title="Certifications" entries={certifications.map((e) => ({ id: e.id, label: e.name || 'Certification' }))} kind="certification" selections={selections} onToggle={toggle} />
      <SkillsSection skills={skills} selections={selections} onToggle={toggle} />

      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isExisting ? 'Save changes' : 'Create Master Resume'}
      </button>
    </div>
  )
}

function entryKey(entry: MasterResumeEntryInput): string {
  return entry.entryKind === 'skill' ? `skill:${entry.skillValue}` : `${entry.entryKind}:${entry.canonicalEntryId}`
}

function allKeys(employment: EmploymentEntry[], education: EducationEntry[], certifications: CertificationEntry[], skills: string[]): string[] {
  return [
    ...employment.filter((e) => e.id).map((e) => `employment:${e.id}`),
    ...education.filter((e) => e.id).map((e) => `education:${e.id}`),
    ...certifications.filter((e) => e.id).map((e) => `certification:${e.id}`),
    ...skills.map((s) => `skill:${s}`),
  ]
}

interface EntrySectionProps {
  title: string
  kind: 'employment' | 'education' | 'certification'
  entries: { id?: string; label: string; description?: string }[]
  selections: Record<string, Selection>
  onToggle: (key: string) => void
  onOverride?: (key: string, value: string) => void
}

function EntrySection({ title, kind, entries, selections, onToggle, onOverride }: EntrySectionProps) {
  if (entries.length === 0) return null
  return (
    <section>
      <h3 className="font-serif text-base font-semibold text-ink">{title}</h3>
      <div className="mt-2 space-y-2">
        {entries.filter((e) => e.id).map((entry) => {
          const key = `${kind}:${entry.id}`
          const selection = selections[key]
          return (
            <div key={key} className="border border-border bg-surface-card p-3">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={selection?.included ?? true} onChange={() => onToggle(key)} className="mt-1" />
                <span className="text-sm text-ink">{entry.label}</span>
              </label>
              {onOverride && (
                <textarea
                  value={selection?.overrideDescription ?? entry.description ?? ''}
                  onChange={(e) => onOverride(key, e.target.value)}
                  rows={2}
                  className="mt-2 w-full border border-border bg-surface-elevated px-2 py-1.5 text-xs text-ink"
                  placeholder="Resume-specific wording for this entry (your Career Profile is unchanged)"
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SkillsSection({ skills, selections, onToggle }: { skills: string[]; selections: Record<string, Selection>; onToggle: (key: string) => void }) {
  if (skills.length === 0) return null
  return (
    <section>
      <h3 className="font-serif text-base font-semibold text-ink">Skills</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {skills.map((skill) => {
          const key = `skill:${skill}`
          const included = selections[key]?.included ?? true
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              className={`border px-3 py-1.5 text-xs font-medium ${included ? 'border-primary-600 bg-primary-950 text-primary-300' : 'border-border text-ink-muted'}`}
            >
              {skill}
            </button>
          )
        })}
      </div>
    </section>
  )
}
