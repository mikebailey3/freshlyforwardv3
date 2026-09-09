import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResumeExportButtons } from './ResumeExportButtons'
import type { ResumeViewModel } from '@/lib/resumeIntelligence/presentation/types'

const exportResumePdfMock = vi.fn()
const exportResumeDocxMock = vi.fn()

vi.mock('@/lib/resumeIntelligence/export/pdf/pdfExportImpl', () => ({
  exportResumePdf: (...args: unknown[]) => exportResumePdfMock(...args),
}))
vi.mock('@/lib/resumeIntelligence/export/docx/exportResumeDocx', () => ({
  exportResumeDocx: (...args: unknown[]) => exportResumeDocxMock(...args),
}))

const viewModel = { resumeVersionId: 'v-1', templateKey: 'ats_classic', contact: {}, summary: null, sections: [] } as unknown as ResumeViewModel

describe('ResumeExportButtons', () => {
  it('exports a PDF using the same viewModel the preview renders', async () => {
    exportResumePdfMock.mockResolvedValue(new Blob(['pdf']))
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:fake')
    global.URL.revokeObjectURL = vi.fn()
    render(<ResumeExportButtons viewModel={viewModel} fileBaseName="my-resume" />)
    fireEvent.click(screen.getByText('Export PDF'))
    await waitFor(() => expect(exportResumePdfMock).toHaveBeenCalledWith(viewModel))
  })

  it('reports an export failure honestly instead of silently doing nothing', async () => {
    exportResumeDocxMock.mockRejectedValue(new Error('DOCX build failed'))
    render(<ResumeExportButtons viewModel={viewModel} fileBaseName="my-resume" />)
    fireEvent.click(screen.getByText('Export DOCX'))
    await waitFor(() => expect(screen.getByText('DOCX build failed')).toBeInTheDocument())
  })
})
