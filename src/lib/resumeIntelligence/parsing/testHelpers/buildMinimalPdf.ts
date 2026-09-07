/**
 * Test-only helper: builds a minimal, valid single-page PDF (one Type1
 * Helvetica font, one content stream placing each given line of text at
 * an explicit absolute position via the text matrix) entirely in memory,
 * with a correctly-offset xref table. Not used by production code.
 */
export interface MinimalPdfLine {
  text: string
  x: number
  y: number
}

export function buildMinimalPdf(lines: MinimalPdfLine[]): ArrayBuffer {
  const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  const contentOps = lines
    .map((l) => `BT /F1 12 Tf 1 0 0 1 ${l.x} ${l.y} Tm (${escape(l.text)}) Tj ET`)
    .join('\n')
  const stream = `${contentOps}\n`

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  // Buffer.from may return a view into Node's shared internal pool for
  // small buffers, so `.buffer` alone can include extra bytes beyond this
  // content -- slice to the exact range.
  const buf = Buffer.from(pdf, 'latin1')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}
