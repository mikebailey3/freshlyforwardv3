import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui'

export function LandingPage() {
  return (
    <main className="callsheet">
      {/* Layer 1: Career Operating System (identity) */}
      <section className="relative overflow-hidden bg-bg py-14 lg:py-28">
        {/* Ambient glow tying the wallpaper into the section background -- built from the
            existing semantic palette only (--color-primary-900 via color-mix), not a new
            color system, per owner direction. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_65%_at_78%_45%,color-mix(in_srgb,var(--color-primary-900)_40%,transparent),transparent_72%)]"
        />

        {/* Approved North Star hero wallpaper (owner-supplied art direction,
            docs/superpowers/visual-review/81F4884C-BF73-440A-8E44-2ED0776F6C70.png,
            promoted to public/images/freshlyforward-hero-wallpaper.png).

            Desktop: positioned against the *section* itself (not the text grid) so it
            bleeds to the viewport edge and reads as background scenery rather than a
            boxed illustration next to the copy. object-position + scale zoom into the
            dashboard so the Forward Score and Top Opportunity card stay readable at
            normal viewing distance -- cropping outer scenery is intentional, per owner
            direction. A solid-bg-bg gradient overlay (CSS, not image editing) fades the
            left and bottom edges into the page so there's no visible rectangular
            boundary; the ambient glow above shows through where it fades. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[48%] right-0 hidden lg:block">
          <img
            src="/images/freshlyforward-hero-wallpaper.png"
            alt=""
            width={1672}
            height={941}
            className="h-full w-full scale-110 object-cover object-[60%_46%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-bg)_0%,var(--color-bg)_10%,transparent_62%),linear-gradient(to_bottom,transparent_50%,var(--color-bg)_100%),linear-gradient(to_top,transparent_88%,var(--color-bg)_100%)]" />
        </div>

        <div className="shell relative z-10">
          <div className="lg:max-w-[46%]">
            <p className="font-mono text-eyebrow font-semibold uppercase tracking-[0.13em] text-primary-400">
              A brighter career ahead
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-5xl lg:text-6xl">
              Change the way you move your <span className="text-primary-400">career forward.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
              FreshlyForward is your career operating system: it understands your experience, shows you which
              opportunities actually fit, and gives you a clear next move -- with real strategists supporting you
              where judgment matters most.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/signup">
                Get started free <ArrowRight size={18} />
              </LinkButton>
              <LinkButton to="/how-it-works" variant="secondary">
                See how it works
              </LinkButton>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2" aria-label="Platform highlights">
              <span className="text-sm font-medium text-ink-muted">Personalized for your career</span>
              <span className="text-sm font-medium text-ink-muted">AI-powered career intelligence</span>
              <span className="text-sm font-medium text-ink-muted">Human strategists when you need them</span>
            </div>
          </div>

          {/* Mobile/tablet: compact wallpaper strip beneath the copy -- the desktop bleed
              treatment above only applies at lg: and up. */}
          <div aria-hidden="true" className="relative mt-10 h-[300px] sm:h-[380px] lg:hidden">
            <img
              src="/images/freshlyforward-hero-wallpaper.png"
              alt=""
              width={1672}
              height={941}
              className="h-full w-full scale-110 object-cover object-[56%_45%]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_58%,var(--color-bg)_100%),linear-gradient(to_top,transparent_85%,var(--color-bg)_100%)]" />
          </div>
        </div>
      </section>
    </main>
  )
}
