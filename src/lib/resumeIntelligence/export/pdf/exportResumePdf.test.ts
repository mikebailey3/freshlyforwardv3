// @vitest-environment node
// @react-pdf/renderer's server-side PDF generation (zlib-compressed
// content streams via pdfkit) produced a corrupted flate stream under
// this project's default jsdom test environment -- this file runs under
// plain Node instead, which is also a closer match to where a real export
// route would actually execute.
import { describe, it, expect } from 'vitest'
import { exportResumePdfBuffer } from './pdfExportImpl'
import { PdfDocumentExtractor } from '../../parsing/pdfExtractor'
import type { ResumeViewModel } from '../../presentation/types'

const viewModel: ResumeViewModel = {
  resumeVersionId: 'rv-1',
  templateKey: 'ats_classic',
  contact: { fullName: 'Jordan Rivera', email: 'jordan.rivera@example.com', phone: '555-0100', location: 'Austin, TX' },
  summary: 'A results-driven professional with a track record of delivery.',
  sections: [
    {
      key: 'employment',
      label: 'Experience',
      entries: [{ id: 'emp-1', entryKind: 'employment', primaryText: 'Senior Analyst', secondaryText: 'Acme Corp', dateRange: '2020 - Present', description: 'Led a cross-functional reporting initiative.', sortOrder: 0 }],
    },
    { key: 'skills', label: 'Skills', entries: [{ id: 'SQL', entryKind: 'skill', primaryText: 'SQL', secondaryText: '', dateRange: '', description: '', sortOrder: 0 }] },
  ],
}

describe('exportResumePdf (export -> reparse -> validate)', () => {
  it('produces real selectable text -- fed back through this repo\'s own PDF extractor, every key fact survives losslessly', async () => {
    const buffer = await exportResumePdfBuffer(viewModel)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

    const extracted = await new PdfDocumentExtractor().extract(arrayBuffer as ArrayBuffer, 'application/pdf')

    expect(extracted.fullText).toContain('Jordan Rivera')
    expect(extracted.fullText).toContain('jordan.rivera@example.com')
    expect(extracted.fullText).toContain('Senior Analyst')
    expect(extracted.fullText).toContain('Acme Corp')
    expect(extracted.fullText).toContain('Led a cross-functional reporting initiative.')
    expect(extracted.fullText).toContain('SQL')
  })

  it('never renders the resume body as an image -- the PDF has extractable text blocks, not zero text with an embedded raster', async () => {
    const buffer = await exportResumePdfBuffer(viewModel)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const extracted = await new PdfDocumentExtractor().extract(arrayBuffer as ArrayBuffer, 'application/pdf')
    expect(extracted.blocks.length).toBeGreaterThan(5)
  })
})
