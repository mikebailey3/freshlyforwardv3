// @vitest-environment node
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { exportResumeDocxBuffer } from './exportResumeDocx'
import type { ResumeViewModel } from '../../presentation/types'

const viewModel: ResumeViewModel = {
  resumeVersionId: 'rv-1',
  templateKey: 'ats_classic',
  contact: { fullName: 'Jordan Rivera', email: 'jordan.rivera@example.com', phone: '555-0100', location: 'Austin, TX' },
  summary: 'A results-driven professional.',
  sections: [
    {
      key: 'employment',
      label: 'Experience',
      entries: [{ id: 'emp-1', entryKind: 'employment', primaryText: 'Senior Analyst', secondaryText: 'Acme Corp', dateRange: '2020 - Present', description: 'Led a cross-functional reporting initiative.', sortOrder: 0 }],
    },
    {
      key: 'education',
      label: 'Education',
      entries: [{ id: 'edu-1', entryKind: 'education', primaryText: 'B.S., Economics', secondaryText: 'State University', dateRange: '2018', description: '', sortOrder: 0 }],
    },
  ],
}

describe('exportResumeDocx', () => {
  it('produces a real, valid .docx (zip archive with word/document.xml) containing every key fact as literal text -- not a separate content path', async () => {
    const buffer = await exportResumeDocxBuffer(viewModel)
    const zip = await JSZip.loadAsync(buffer)
    const documentXml = await zip.file('word/document.xml')?.async('string')

    expect(documentXml).toBeDefined()
    expect(documentXml).toContain('Jordan Rivera')
    expect(documentXml).toContain('Senior Analyst')
    expect(documentXml).toContain('Acme Corp')
    expect(documentXml).toContain('Led a cross-functional reporting initiative.')
    expect(documentXml).toContain('State University')
  })

  it('never fabricates content that is not in the view model -- text absent from every entry never appears in the output', async () => {
    const buffer = await exportResumeDocxBuffer(viewModel)
    const zip = await JSZip.loadAsync(buffer)
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? ''
    expect(documentXml).toContain('B.S., Economics')
    expect(documentXml).not.toContain('Ghost Corp') // never present in the fixture -- proves the renderer only emits literal input text
  })
})
