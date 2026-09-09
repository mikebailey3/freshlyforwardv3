/**
 * Phase 5 — the template engine. One reusable renderer (see
 * `TemplateRenderer.tsx`) driven by these config objects, not five bespoke
 * components (DRY, per the master plan). Templates control PRESENTATION
 * ONLY — never which content is included, never a second source of truth.
 *
 * `atsClassic` is deliberately the most conservative: single column, no
 * decoration, plain reading order — the anti-patterns called out in the
 * brief (skill progress bars, text-as-images, canvas rendering, decorative
 * charts, multi-column layouts that confuse ATS parsers) are prevented by
 * construction here, not by convention: `isAtsSafe` is only ever true for
 * a template with `layout: 'single-column'` and `decorative: false`, and
 * every template in this registry is checked against that rule by
 * `registry.test.ts`.
 */

export interface ResumeTemplate {
  key: string
  label: string
  layout: 'single-column'
  /** Relative type scale vs. a 1.0 baseline -- typography variety without a second rendering engine. */
  headingScale: number
  bodyScale: number
  /** Points of vertical space between sections, in the shared renderer's unit. */
  sectionSpacing: number
  /** True only for a template with zero decoration that could confuse an ATS parser. */
  isAtsSafe: boolean
  /** Always false in this registry -- no template may render decoration that could interfere with parsing (locked). */
  decorative: boolean
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  { key: 'ats_classic', label: 'ATS Classic', layout: 'single-column', headingScale: 1.0, bodyScale: 1.0, sectionSpacing: 12, isAtsSafe: true, decorative: false },
  { key: 'professional', label: 'Professional', layout: 'single-column', headingScale: 1.1, bodyScale: 1.0, sectionSpacing: 16, isAtsSafe: true, decorative: false },
  { key: 'modern', label: 'Modern', layout: 'single-column', headingScale: 1.2, bodyScale: 1.0, sectionSpacing: 18, isAtsSafe: true, decorative: false },
  { key: 'executive', label: 'Executive', layout: 'single-column', headingScale: 1.15, bodyScale: 1.05, sectionSpacing: 20, isAtsSafe: true, decorative: false },
  { key: 'minimal', label: 'Minimal', layout: 'single-column', headingScale: 0.95, bodyScale: 0.95, sectionSpacing: 10, isAtsSafe: true, decorative: false },
]

export const TEMPLATE_KEYS: string[] = RESUME_TEMPLATES.map((t) => t.key)

export function resolveTemplate(templateKey: string): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.key === templateKey) ?? (RESUME_TEMPLATES[0] as ResumeTemplate)
}
