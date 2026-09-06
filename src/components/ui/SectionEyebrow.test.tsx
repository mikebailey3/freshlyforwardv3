import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionEyebrow } from './SectionEyebrow'

describe('SectionEyebrow', () => {
  it('renders its label text', () => {
    render(<SectionEyebrow>Career Intelligence</SectionEyebrow>)
    expect(screen.getByText('Career Intelligence')).toBeInTheDocument()
  })

  it('uses the primary accent color and eyebrow type scale', () => {
    render(<SectionEyebrow>Career Intelligence</SectionEyebrow>)
    const el = screen.getByText('Career Intelligence')
    expect(el.className).toContain('text-eyebrow')
    expect(el.className).toContain('text-primary-400')
  })
})
