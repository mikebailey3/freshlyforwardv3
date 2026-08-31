import { useEffect, useRef, useState } from 'react'

/**
 * Tracks whether an element has scrolled into view, exactly once. Used to
 * trigger a single reveal animation the first time a section is seen,
 * rather than replaying every time it re-enters the viewport.
 *
 * Originally a one-off inline effect in LandingPage's "verdict" section;
 * pulled out here because HowItWorksPage needs the identical pattern once
 * per process step.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, visible] as const
}
