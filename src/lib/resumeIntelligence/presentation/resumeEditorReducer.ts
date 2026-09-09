import type { MasterResumeEntryInput } from '@/lib/resumeIntelligence/masterResume/resumeEntryValidation'

/**
 * Phase 5 — pure reducer for the Visual Resume Builder's local draft
 * state. Deliberately has ZERO Supabase/network code (business-logic/
 * rendering separation, per the brief) -- `useResumeEditorState.ts` wraps
 * this in `useReducer` and adds the explicit `save()` call. A hidden
 * entry is only ever marked `included: false` here -- it is never removed
 * from `state.entries`, so it can never be mistaken for a canonical
 * deletion; nothing in this module ever mutates the canonical Profile.
 */

export interface ResumeEditorEntry extends MasterResumeEntryInput {
  /** Present for employment/education/certification kinds; identical shape to MasterResumeEntryInput's own id fields, restated for clarity at the reducer boundary. */
  entryId: string
}

export interface ResumeEditorState {
  entries: ResumeEditorEntry[]
  sectionOrder: string[]
  templateKey: string
  summaryOverride: string | null
  /** True once the local draft differs from what was last loaded/saved. */
  dirty: boolean
}

export type ResumeEditorAction =
  | { type: 'load'; entries: ResumeEditorEntry[]; sectionOrder: string[]; templateKey: string; summaryOverride: string | null }
  | { type: 'toggleIncluded'; entryId: string }
  | { type: 'reorderEntries'; entryIds: string[] }
  | { type: 'reorderSections'; sectionOrder: string[] }
  | { type: 'setOverrideDescription'; entryId: string; text: string | null }
  | { type: 'setSummaryOverride'; text: string | null }
  | { type: 'setTemplateKey'; templateKey: string }
  | { type: 'markSaved' }

export const initialResumeEditorState: ResumeEditorState = {
  entries: [],
  sectionOrder: [],
  templateKey: 'ats_classic',
  summaryOverride: null,
  dirty: false,
}

export function resumeEditorReducer(state: ResumeEditorState, action: ResumeEditorAction): ResumeEditorState {
  switch (action.type) {
    case 'load':
      return { entries: action.entries, sectionOrder: action.sectionOrder, templateKey: action.templateKey, summaryOverride: action.summaryOverride, dirty: false }

    case 'toggleIncluded':
      return {
        ...state,
        entries: state.entries.map((e) => (e.entryId === action.entryId ? { ...e, included: !e.included } : e)),
        dirty: true,
      }

    case 'reorderEntries': {
      const order = new Map(action.entryIds.map((id, index) => [id, index]))
      return {
        ...state,
        entries: state.entries.map((e) => (order.has(e.entryId) ? { ...e, sortOrder: order.get(e.entryId) as number } : e)),
        dirty: true,
      }
    }

    case 'reorderSections':
      return { ...state, sectionOrder: action.sectionOrder, dirty: true }

    case 'setOverrideDescription':
      return {
        ...state,
        entries: state.entries.map((e) => (e.entryId === action.entryId ? { ...e, overrideDescription: action.text } : e)),
        dirty: true,
      }

    case 'setSummaryOverride':
      return { ...state, summaryOverride: action.text, dirty: true }

    case 'setTemplateKey':
      return { ...state, templateKey: action.templateKey, dirty: true }

    case 'markSaved':
      return { ...state, dirty: false }

    default:
      return state
  }
}
