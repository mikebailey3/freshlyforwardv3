// src/pages/ResumeIntelligencePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResumeIntelligencePage } from './ResumeIntelligencePage'
import type { ResumeWorkflowStage } from '@/lib/resumeIntelligence/workflow/resumeWorkflowStage'

const { mockAuthUser, mockAuthProfile, mockWorkflow } = vi.hoisted(() => ({
  mockAuthUser: { id: 'u1', email: 'jamie@example.com' },
  mockAuthProfile: { employment_history: [], education: [], certifications: [], skills: [], target_role: null },
  mockWorkflow: {
    loading: false,
    busy: false,
    error: null as string | null,
    stage: 'no_document' as ResumeWorkflowStage,
    snapshot: {
      hasMaster: false, proposals: [] as Record<string, unknown>[], latestResumeDocumentId: null as string | null,
      hasResumeDocument: false, hasImportAttempt: false, pendingProposalCount: 0, masterResumeVersionId: null as string | null,
    },
    versions: [] as unknown[],
    existingEntries: [] as unknown[],
    analysis: null,
    uploadAndImportResume: vi.fn(),
    decideProposal: vi.fn(),
    saveMasterResume: vi.fn(),
    promoteToMaster: vi.fn(),
    setSummaryOverride: vi.fn(),
    runAnalysis: vi.fn(),
    refresh: vi.fn(),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser, profile: mockAuthProfile, refreshProfile: vi.fn() }),
}))

vi.mock('@/hooks/useResumeWorkflow', () => ({
  useResumeWorkflow: () => mockWorkflow,
}))

function makeBuilder() {
  const result = { data: null, error: null }
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.gte = chain
  builder.limit = chain
  builder.update = chain
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  builder.then = (resolve: (value: typeof result) => void) => resolve(result)
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn().mockImplementation(() => makeBuilder()) },
}))

describe('ResumeIntelligencePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflow.loading = false
    mockWorkflow.error = null
    mockWorkflow.stage = 'no_document'
    mockWorkflow.snapshot = {
      hasMaster: false, proposals: [], latestResumeDocumentId: null,
      hasResumeDocument: false, hasImportAttempt: false, pendingProposalCount: 0, masterResumeVersionId: null,
    }
    mockWorkflow.analysis = null
  })

  it('renders the upload section and Master Resume builder when nothing exists yet', () => {
    render(<MemoryRouter><ResumeIntelligencePage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Resume Intelligence' })).toBeInTheDocument()
    expect(screen.getByText('1. Upload a resume (optional)')).toBeInTheDocument()
    expect(screen.getByText('3. Build your Master Resume')).toBeInTheDocument()
    expect(screen.queryByText('Analysis')).not.toBeInTheDocument()
  })

  it('shows the Import Review section once there are proposals to review', () => {
    mockWorkflow.snapshot = {
      ...mockWorkflow.snapshot,
      proposals: [{
        id: 'p1', source_document_id: 'doc-1', destination_kind: 'canonical-profile', destination_field: 'full_name',
        destination_array_index: null, candidate_value: 'Jamie Rivera', proposed_action: 'create', confidence: 'high',
        provenance_section_kind: 'contact', provenance_block_orders: [0], provenance_source_excerpt: 'Jamie Rivera',
        provenance_page: 1, provenance_matched_rule: 'X', status: 'pending', decision: null,
      }],
    } as typeof mockWorkflow.snapshot
    render(<MemoryRouter><ResumeIntelligencePage /></MemoryRouter>)
    expect(screen.getByText('2. Review what we found')).toBeInTheDocument()
  })

  it('shows Analysis and Resume Versions sections once a Master Resume exists', () => {
    mockWorkflow.snapshot = { ...mockWorkflow.snapshot, hasMaster: true, masterResumeVersionId: 'version-1' }
    mockWorkflow.stage = 'master_ready'
    render(<MemoryRouter><ResumeIntelligencePage /></MemoryRouter>)
    expect(screen.getByText('Update your Master Resume')).toBeInTheDocument()
    expect(screen.getByText('Analysis')).toBeInTheDocument()
  })

  it('shows a loading indicator while the workflow snapshot is loading', () => {
    mockWorkflow.loading = true
    render(<MemoryRouter><ResumeIntelligencePage /></MemoryRouter>)
    expect(screen.queryByRole('heading', { level: 1, name: 'Resume Intelligence' })).not.toBeInTheDocument()
    mockWorkflow.loading = false
  })

  it('surfaces a workflow error as an inline banner', () => {
    mockWorkflow.error = 'Something went wrong.'
    render(<MemoryRouter><ResumeIntelligencePage /></MemoryRouter>)
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    mockWorkflow.error = null
  })
})
