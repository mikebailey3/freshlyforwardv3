import { useEffect } from 'react'

/**
 * Sets document.title and a single <meta name="description"> tag for the
 * lifetime of the calling component, restoring whatever was there before
 * on unmount. This is the full extent of Forward Profiles' SEO scope for
 * this project: no react-helmet, no SSR/prerendering, no Open Graph/Twitter
 * card injection -- this SPA has none of that infrastructure today (see
 * docs/superpowers/plans/2026-09-09-forward-profiles-implementation.md
 * section 8), and true social-link-unfurling would require a genuinely
 * separate SSR/edge-prerender project, deliberately out of scope here.
 */
export function usePageMeta(title: string, description: string | null): void {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    let createdMeta = false
    const previousContent = meta?.getAttribute('content') ?? null

    if (description) {
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'description')
        document.head.appendChild(meta)
        createdMeta = true
      }
      meta.setAttribute('content', description)
    }

    return () => {
      document.title = previousTitle
      if (createdMeta && meta) {
        meta.remove()
      } else if (meta && description) {
        meta.setAttribute('content', previousContent ?? '')
      }
    }
  }, [title, description])
}
