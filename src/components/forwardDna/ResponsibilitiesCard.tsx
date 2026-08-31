import { useState } from 'react'
import { X } from 'lucide-react'
import type { EmploymentEntry } from '@/types'
import type { CareerResponsibility } from '@/types/forwardDna'

interface ResponsibilitiesCardProps {
  entries: EmploymentEntry[]
  responsibilities: CareerResponsibility[]
  onAdd: (employmentEntryId: string, tag: string) => Promise<void>
  onRemove: (responsibilityId: string) => Promise<void>
}

export function ResponsibilitiesCard({ entries, responsibilities, onAdd, onRemove }: ResponsibilitiesCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-6">
      <h3 className="font-serif text-base font-semibold text-neutral-900">Responsibilities</h3>
      <p className="mt-1 text-xs text-neutral-500">What you were actually responsible for in each role.</p>
      <div className="mt-4 space-y-4">
        {entries.map((entry) => (
          <ResponsibilityRow key={entry.id} entry={entry} tags={responsibilities.filter((r) => r.employment_entry_id === entry.id)} onAdd={onAdd} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}

function ResponsibilityRow({
  entry,
  tags,
  onAdd,
  onRemove,
}: {
  entry: EmploymentEntry
  tags: CareerResponsibility[]
  onAdd: ResponsibilitiesCardProps['onAdd']
  onRemove: ResponsibilitiesCardProps['onRemove']
}) {
  const [newTag, setNewTag] = useState('')

  const handleAdd = async () => {
    if (!entry.id || !newTag.trim()) return
    await onAdd(entry.id, newTag.trim())
    setNewTag('')
  }

  return (
    <div className="border-l-2 border-primary-200 pl-4">
      <p className="text-sm font-semibold text-neutral-900">{entry.title} — {entry.company}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag.id} className="flex items-center gap-1 border border-primary-300 px-2.5 py-1 font-mono text-xs text-primary-700">
            {tag.tag}
            <button onClick={() => onRemove(tag.id)} aria-label={`Remove ${tag.tag}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add a responsibility" className="flex-1 border border-neutral-300 px-3 py-1.5 text-sm" />
        <button onClick={handleAdd} className="rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
          Add
        </button>
      </div>
    </div>
  )
}
