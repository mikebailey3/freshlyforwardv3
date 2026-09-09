import type { ResumeViewModel } from './types'
import { resolveTemplate } from '../templates/registry'

/**
 * Phase 5 — the one reusable template renderer, driven entirely by the
 * template registry config + the normalized `ResumeViewModel`. This is
 * both the live preview AND the visual source-of-truth the PDF renderer
 * mirrors (same section order, same text) — never a second content path.
 * Deliberately plain: no canvas, no rasterized text, no multi-column CSS,
 * no progress-bar skill widgets (locked anti-patterns).
 */
export function TemplateRenderer({ viewModel }: { viewModel: ResumeViewModel }) {
  const template = resolveTemplate(viewModel.templateKey)

  return (
    <article
      data-testid="resume-preview"
      data-template={template.key}
      style={{ fontSize: `${template.bodyScale}rem`, maxWidth: '8.5in', margin: '0 auto', padding: '0.75in', background: 'white', color: '#1a1a2e' }}
    >
      <header>
        <h1 style={{ fontSize: `${1.6 * template.headingScale}rem`, margin: 0 }}>{viewModel.contact.fullName || 'Your Name'}</h1>
        <p style={{ margin: '4px 0' }}>
          {[viewModel.contact.email, viewModel.contact.phone, viewModel.contact.location].filter(Boolean).join(' | ')}
        </p>
      </header>

      {viewModel.summary && (
        <section style={{ marginTop: template.sectionSpacing }}>
          <h2 style={{ fontSize: `${1.1 * template.headingScale}rem` }}>Summary</h2>
          <p>{viewModel.summary}</p>
        </section>
      )}

      {viewModel.sections.map((section) => (
        <section key={section.key} style={{ marginTop: template.sectionSpacing }}>
          <h2 style={{ fontSize: `${1.1 * template.headingScale}rem` }}>{section.label}</h2>
          {section.key === 'skills' ? (
            <p data-testid={`section-${section.key}`}>{section.entries.map((e) => e.primaryText).join(', ')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }} data-testid={`section-${section.key}`}>
              {section.entries.map((entry) => (
                <li key={entry.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{entry.primaryText}{entry.secondaryText ? ` — ${entry.secondaryText}` : ''}</span>
                    {entry.dateRange && <span>{entry.dateRange}</span>}
                  </div>
                  {entry.description && <p style={{ margin: '2px 0 0' }}>{entry.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  )
}
