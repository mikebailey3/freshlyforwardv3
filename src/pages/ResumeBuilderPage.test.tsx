import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ResumeBuilderPage } from './ResumeBuilderPage'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const { mockEditor, mockAI } = vi.hoisted(() => ({
  mockEditor: {
    loading: false,
    notFound: false,
    busy: false,
    error: null as string | null,
    state: { entries: [], sectionOrder: ['employment', 'education', 'certifications', 'skills'], templateKey: 'ats_classic', summaryOverride: null, dirty: false },
    dispatch: vi.fn(),
    versionMeta: { id: 'v-1', title: 'Master Resume', isMaster: true, templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, derivedFromResumeVersionId: null, targetOpportunity: null as { id: string; jobTitle: string; employer: string } | null, entries: [] as unknown[] },
    viewModel: null as unknown,
    save: vi.fn().mockResolvedValue(null),
    duplicate: vi.fn().mockResolvedValue({ newResumeVersionId: 'v-2', error: null }),
    archive: vi.fn().mockResolvedValue(null),
    promoteToMaster: vi.fn().mockResolvedValue(null),
    reload: vi.fn(),
  },
  mockAI: {
    suggestions: [] as unknown[],
    busy: false,
    error: null as string | null,
    unavailableMessage: null as string | null,
    requestSuggestion: vi.fn(),
    decide: vi.fn(),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'jamie@example.com' }, profile: { employment_history: [], education: [], certifications: [], skills: [] } }),
}))
vi.mock('@/hooks/useResumeEditorState', () => ({ useResumeEditorState: () => mockEditor }))
vi.mock('@/hooks/useAIResumeSuggestions', () => ({ useAIResumeSuggestions: () => mockAI }))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/resume-intelligence/builder/v-1']}>
      <Routes>
        <Route path="/resume-intelligence/builder/:resumeVersionId" element={<ResumeBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResumeBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEditor.loading = false
    mockEditor.notFound = false
    mockEditor.error = null
    mockEditor.versionMeta = { id: 'v-1', title: 'Master Resume', isMaster: true, templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, derivedFromResumeVersionId: null, targetOpportunity: null, entries: [] }
  })

  it('shows a loading spinner while the version is loading', () => {
    mockEditor.loading = true
    renderPage()
    expect(screen.queryByText('Master Resume')).not.toBeInTheDocument()
  })

  it('shows an honest not-found message rather than a fabricated page when the version does not exist/is not owned', () => {
    mockEditor.notFound = true
    renderPage()
    expect(screen.getByText(/was not found, does not belong to your account/)).toBeInTheDocument()
  })

  it('shows the Master Resume badge and explanatory copy for the Master', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Master Resume' })).toBeInTheDocument()
    expect(screen.getByText('Master Resume', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/never change what is stored here/)).toBeInTheDocument()
  })

  it('shows the target-opportunity banner for a tailored (non-Master) version', () => {
    mockEditor.versionMeta = { ...mockEditor.versionMeta, isMaster: false, targetOpportunity: { id: 'opp-1', jobTitle: 'Senior Engineer', employer: 'Acme Co' } }
    renderPage()
    expect(screen.getByText('Tailored for Senior Engineer at Acme Co')).toBeInTheDocument()
    expect(screen.getByText(/never changes your Career Profile/)).toBeInTheDocument()
  })

  it('clicking Save changes calls editor.save', async () => {
    renderPage()
    fireEvent.click(screen.getByText('Save changes'))
    await waitFor(() => expect(mockEditor.save).toHaveBeenCalledTimes(1))
  })

  it('surfaces a save error inline rather than silently failing', async () => {
    mockEditor.save = vi.fn().mockResolvedValue('Could not save.')
    renderPage()
    fireEvent.click(screen.getByText('Save changes'))
    await waitFor(() => expect(screen.getByText('Could not save.')).toBeInTheDocument())
  })

  it('duplicating requires a title and navigates to the new version on success', async () => {
    renderPage()
    fireEvent.click(screen.getByText('Duplicate'))
    expect(mockEditor.duplicate).not.toHaveBeenCalled()
    expect(screen.getByText('Give the duplicate a title first.')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Title for the duplicate'), { target: { value: 'My Copy' } })
    fireEvent.click(screen.getByText('Duplicate'))
    await waitFor(() => expect(mockEditor.duplicate).toHaveBeenCalledWith('My Copy'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/resume-intelligence/builder/v-2'))
  })

  it('archiving requires an explicit confirm step before calling editor.archive', async () => {
    renderPage()
    fireEvent.click(screen.getByText('Archive'))
    expect(mockEditor.archive).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Confirm archive'))
    await waitFor(() => expect(mockEditor.archive).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/resume-intelligence'))
  })

  it('a non-Master version offers "Set as Master"; the Master itself does not', () => {
    renderPage()
    expect(screen.queryByText('Set as Master')).not.toBeInTheDocument()
    mockEditor.versionMeta = { ...mockEditor.versionMeta, isMaster: false }
    renderPage()
    expect(screen.getByText('Set as Master')).toBeInTheDocument()
  })
})
