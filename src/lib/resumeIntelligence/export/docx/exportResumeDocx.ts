import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import type { ResumeViewModel } from '../../presentation/types'

/**
 * Phase 5 (5.8) — DOCX export. `docx` (dolanmiu, MIT) generates a real,
 * standard-word-processor-editable `.docx` from the exact same
 * `ResumeViewModel` the PDF/preview use -- one content path, no separate
 * DOCX-only content ever maintained.
 */
export function buildResumeDocx(viewModel: ResumeViewModel): Document {
  const children: Paragraph[] = []

  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(viewModel.contact.fullName || 'Your Name')] }))
  children.push(new Paragraph({ children: [new TextRun([viewModel.contact.email, viewModel.contact.phone, viewModel.contact.location].filter(Boolean).join(' | '))] }))

  if (viewModel.summary) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Summary')] }))
    children.push(new Paragraph({ children: [new TextRun(viewModel.summary)] }))
  }

  for (const section of viewModel.sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.label)] }))

    if (section.key === 'skills') {
      children.push(new Paragraph({ children: [new TextRun(section.entries.map((e) => e.primaryText).join(', '))] }))
      continue
    }

    for (const entry of section.entries) {
      const titleLine = entry.secondaryText ? `${entry.primaryText} -- ${entry.secondaryText}` : entry.primaryText
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: titleLine, bold: true }),
            ...(entry.dateRange ? [new TextRun({ text: `  (${entry.dateRange})` })] : []),
          ],
        }),
      )
      if (entry.description) {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(entry.description)] }))
      }
    }
  }

  return new Document({ sections: [{ properties: {}, children }] })
}

export async function exportResumeDocx(viewModel: ResumeViewModel): Promise<Blob> {
  return Packer.toBlob(buildResumeDocx(viewModel))
}

export async function exportResumeDocxBuffer(viewModel: ResumeViewModel): Promise<Buffer> {
  return Packer.toBuffer(buildResumeDocx(viewModel))
}
