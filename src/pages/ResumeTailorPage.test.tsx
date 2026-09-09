import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ResumeTailorPage } from './ResumeTailorPage'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const fetchTailoringContextMock = vi.fn()
const createTailoredResumeVersionMock = vi.fn()
vi.mock('@/lib/resumeIntelligence/tailoring/fetchTailoringContext', () => ({
  fetchTailoringContext: (...args: unknown[]) => fetchTailoringContextMock(...args),
}))
vi.mock('@/lib/resumeIntelligence/tailoring/createTailoredResumeVersion', () => ({
  createTailoredResumeVersion: (...args: unknown[]) => createTailoredResumeVersionMock(...args),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'jamie@example.com' } }),
}))

const baseContext = {
  opportunityId: 'opp-1',
  jobTitle: 'Senior Engineer',
  employer: 'Acme Co',
  jobText: 'Senior Engineer requires SQL and Leadership.',
  sourceResumeVersionId: 'master-1',
  sourceResumeTitle: 'Master Resume',
  canonicalSkills: ['SQL', 'Leadership'],
  includedResumeSkills: ['SQL'],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/resume-intelligence/tailor/opp-1']}>
      <Routes>
        <Route path="/resume-intelligence/tailor/:opportunityId" element={<ResumeTailorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResumeTailorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchTailoringContextMock.mockResolvedValue({ context: baseContext, error: null })
    createTailoredResumeVersionMock.mockResolvedValue({ newResumeVersionId: 'v-new', error: null })
  })

  it('shows an honest error rather than a fabricated fit breakdown when the context cannot be loaded', async () => {
    fetchTailoringContextMock.mockResolvedValue({ context: null, error: 'You need a Master Resume before you can tailor a version for this opportunity.' })
    renderPage()
    await waitFor(() => expect(screen.getByText(/You need a Master Resume/)).toBeInTheDocument())
  })

  it('classifies skills into already-included, safe-to-include, and honest gaps', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Already on this resume')).toBeInTheDocument())
    expect(screen.getByText('sql')).toBeInTheDocument()
    expect(screen.getByText('On your Career Profile, not yet included')).toBeInTheDocument()
    expect(screen.getByText('leadership')).toBeInTheDocument()
    expect(screen.queryByText('Honest gaps')).not.toBeInTheDocument()
  })

  it('reports skills in the job description that are on file nowhere as honest gaps -- never fabricated onto the resume', async () => {
    fetchTailoringContextMock.mockResolvedValue({
      context: { ...baseContext, jobText: 'Requires Python.', canonicalSkills: [], includedResumeSkills: [] },
      error: null,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Honest gaps')).toBeInTheDocument())
    expect(screen.getByText('python')).toBeInTheDocument()
  })

  it('creating a tailored resume calls createTailoredResumeVersion against the Master and navigates into the builder', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Create tailored resume')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Create tailored resume'))
    await waitFor(() => expect(createTailoredResumeVersionMock).toHaveBeenCalledWith('user-1', 'master-1', 'opp-1', expect.stringContaining('Senior Engineer')))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/resume-intelligence/builder/v-new'))
  })

  it('surfaces an error if creating the tailored version fails, without navigating away', async () => {
    createTailoredResumeVersionMock.mockResolvedValue({ newResumeVersionId: null, error: 'Could not create the duplicated version.' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Create tailored resume')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Create tailored resume'))
    await waitFor(() => expect(screen.getByText('Could not create the duplicated version.')).toBeInTheDocument())
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
