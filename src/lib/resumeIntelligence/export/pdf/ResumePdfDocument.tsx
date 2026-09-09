import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ResumeViewModel } from '../../presentation/types'
import { resolveTemplate } from '../../templates/registry'

/**
 * Phase 5 (5.6/5.7) — PDF export. `@react-pdf/renderer` (MIT) renders
 * real selectable/searchable text nodes -- never a raster/canvas
 * screenshot of the resume body (locked anti-pattern). Consumes the exact
 * same `ResumeViewModel` the live preview uses -- one content path, two
 * renderers. US Letter today; `page.size` is the one line to flip to A4
 * later (5.4's requirement that page sizing be structured for a clean A4
 * follow-up).
 */

const styles = StyleSheet.create({
  page: { padding: 54, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a2e' },
  name: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  contactLine: { fontSize: 9, marginBottom: 10 },
  sectionHeading: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4, borderBottom: '1pt solid #cccccc', paddingBottom: 2 },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  entryTitle: { fontFamily: 'Helvetica-Bold' },
  entryDate: { fontSize: 9 },
  description: { marginTop: 2 },
  skillsLine: { marginTop: 2 },
})

export function ResumePdfDocument({ viewModel }: { viewModel: ResumeViewModel }) {
  const template = resolveTemplate(viewModel.templateKey)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={[styles.name, { fontSize: 18 * template.headingScale }]}>{viewModel.contact.fullName || 'Your Name'}</Text>
        <Text style={styles.contactLine}>{[viewModel.contact.email, viewModel.contact.phone, viewModel.contact.location].filter(Boolean).join(' | ')}</Text>

        {viewModel.summary ? (
          <View style={{ marginTop: template.sectionSpacing }}>
            <Text style={[styles.sectionHeading, { fontSize: 12 * template.headingScale }]}>Summary</Text>
            <Text>{viewModel.summary}</Text>
          </View>
        ) : null}

        {viewModel.sections.map((section) => (
          <View key={section.key} wrap style={{ marginTop: template.sectionSpacing }}>
            <Text style={[styles.sectionHeading, { fontSize: 12 * template.headingScale }]}>{section.label}</Text>
            {section.key === 'skills' ? (
              <Text style={styles.skillsLine}>{section.entries.map((e) => e.primaryText).join(', ')}</Text>
            ) : (
              section.entries.map((entry) => (
                <View key={entry.id} style={styles.entryRow} wrap={false}>
                  <View>
                    <Text style={styles.entryTitle}>
                      {entry.primaryText}
                      {entry.secondaryText ? ` -- ${entry.secondaryText}` : ''}
                    </Text>
                    {entry.description ? <Text style={styles.description}>{entry.description}</Text> : null}
                  </View>
                  {entry.dateRange ? <Text style={styles.entryDate}>{entry.dateRange}</Text> : null}
                </View>
              ))
            )}
          </View>
        ))}

        {/* template.isAtsSafe is asserted true for every registry template by registry.test.ts -- this renderer never branches into a decorative/multi-column layout regardless of template. */}
      </Page>
    </Document>
  )
}
