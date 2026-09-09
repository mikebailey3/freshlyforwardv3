import { describe, it, expect } from 'vitest'
import { resumeEditorReducer, initialResumeEditorState } from './resumeEditorReducer'
import type { ResumeEditorEntry } from './resumeEditorReducer'

function loaded() {
  const entries: ResumeEditorEntry[] = [
    { entryId: 'emp-1', entryKind: 'employment', canonicalEntryId: 'emp-1', included: true, sortOrder: 0 },
    { entryId: 'emp-2', entryKind: 'employment', canonicalEntryId: 'emp-2', included: true, sortOrder: 1 },
  ]
  return resumeEditorReducer(initialResumeEditorState, { type: 'load', entries, sectionOrder: ['employment'], templateKey: 'ats_classic', summaryOverride: null })
}

describe('resumeEditorReducer', () => {
  it('starts clean (not dirty)', () => {
    expect(loaded().dirty).toBe(false)
  })

  it('toggling an entry only flips included -- never removes it (hiding is not deleting)', () => {
    const state = resumeEditorReducer(loaded(), { type: 'toggleIncluded', entryId: 'emp-1' })
    expect(state.entries).toHaveLength(2)
    expect(state.entries.find((e) => e.entryId === 'emp-1')?.included).toBe(false)
    expect(state.dirty).toBe(true)
  })

  it('reordering entries updates sortOrder without touching unrelated fields', () => {
    const state = resumeEditorReducer(loaded(), { type: 'reorderEntries', entryIds: ['emp-2', 'emp-1'] })
    expect(state.entries.find((e) => e.entryId === 'emp-2')?.sortOrder).toBe(0)
    expect(state.entries.find((e) => e.entryId === 'emp-1')?.sortOrder).toBe(1)
    expect(state.entries.find((e) => e.entryId === 'emp-1')?.canonicalEntryId).toBe('emp-1')
  })

  it('setting a resume-specific override never mutates canonical fields, only overrideDescription', () => {
    const state = resumeEditorReducer(loaded(), { type: 'setOverrideDescription', entryId: 'emp-1', text: 'New tailored bullet' })
    const entry = state.entries.find((e) => e.entryId === 'emp-1')
    expect(entry?.overrideDescription).toBe('New tailored bullet')
    expect(entry?.canonicalEntryId).toBe('emp-1')
  })

  it('markSaved clears the dirty flag without changing data', () => {
    const dirty = resumeEditorReducer(loaded(), { type: 'setTemplateKey', templateKey: 'modern' })
    expect(dirty.dirty).toBe(true)
    const saved = resumeEditorReducer(dirty, { type: 'markSaved' })
    expect(saved.dirty).toBe(false)
    expect(saved.templateKey).toBe('modern')
  })

  it('reordering sections stores the new order and marks dirty', () => {
    const state = resumeEditorReducer(loaded(), { type: 'reorderSections', sectionOrder: ['skills', 'employment'] })
    expect(state.sectionOrder).toEqual(['skills', 'employment'])
    expect(state.dirty).toBe(true)
  })
})
