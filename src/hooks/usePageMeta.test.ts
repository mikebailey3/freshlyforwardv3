import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { usePageMeta } from './usePageMeta'

function getMetaDescription(): HTMLMetaElement | null {
  return document.querySelector('meta[name="description"]')
}

describe('usePageMeta', () => {
  afterEach(() => {
    cleanup()
    document.title = ''
    getMetaDescription()?.remove()
  })

  it('sets document.title', () => {
    renderHook(() => usePageMeta('Jordan Rivera — FreshlyForward', 'Product Manager in Austin, TX.'))
    expect(document.title).toBe('Jordan Rivera — FreshlyForward')
  })

  it('creates a meta description tag when none exists', () => {
    renderHook(() => usePageMeta('Title', 'A description.'))
    const meta = getMetaDescription()
    expect(meta).not.toBeNull()
    expect(meta?.getAttribute('content')).toBe('A description.')
  })

  it('reuses an existing meta description tag instead of creating a duplicate', () => {
    const existing = document.createElement('meta')
    existing.setAttribute('name', 'description')
    existing.setAttribute('content', 'old')
    document.head.appendChild(existing)

    renderHook(() => usePageMeta('Title', 'new description'))

    expect(document.querySelectorAll('meta[name="description"]').length).toBe(1)
    expect(getMetaDescription()?.getAttribute('content')).toBe('new description')
  })

  it('restores the previous title and description on unmount', () => {
    document.title = 'Original Title'
    const existing = document.createElement('meta')
    existing.setAttribute('name', 'description')
    existing.setAttribute('content', 'original description')
    document.head.appendChild(existing)

    const { unmount } = renderHook(() => usePageMeta('Temporary Title', 'temporary description'))
    expect(document.title).toBe('Temporary Title')

    unmount()

    expect(document.title).toBe('Original Title')
    expect(getMetaDescription()?.getAttribute('content')).toBe('original description')
  })

  it('does not set a meta description when description is null, and leaves any existing one untouched', () => {
    const existing = document.createElement('meta')
    existing.setAttribute('name', 'description')
    existing.setAttribute('content', 'untouched')
    document.head.appendChild(existing)

    renderHook(() => usePageMeta('Title only', null))

    expect(getMetaDescription()?.getAttribute('content')).toBe('untouched')
  })
})
