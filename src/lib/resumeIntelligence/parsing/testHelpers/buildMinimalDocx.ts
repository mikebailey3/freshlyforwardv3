import JSZip from 'jszip'

/**
 * Test-only helper: builds a minimal, valid .docx (a zip of a few required
 * OOXML parts) entirely in memory, so extractor tests need zero binary
 * fixtures checked into the repo. Not used by production code.
 */
export interface MinimalDocxParagraph {
  text: string
  bold?: boolean
}

export async function buildMinimalDocx(paragraphs: MinimalDocxParagraph[]): Promise<ArrayBuffer> {
  const zip = new JSZip()

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

  const body = paragraphs
    .map((p) => {
      const run = p.bold
        ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r>`
        : `<w:r><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r>`
      return `<w:p>${run}</w:p>`
    })
    .join('')

  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`)

  return zip.generateAsync({ type: 'arraybuffer' })
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
