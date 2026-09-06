import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui'

export function LandingPage() {
  return (
    <main className="callsheet">
      {/* Layer 1: Career Operating System (identity) */}
      <section className="relative overflow-hidden bg-bg py-14 lg:py-24">
        <div className="shell relative grid items-center gap-12 lg:grid-cols-2">
          <div>
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

          {/* Approved North Star hero wallpaper (owner-supplied art direction,
              docs/superpowers/visual-review/81F4884C-BF73-440A-8E44-2ED0776F6C70.png,
              promoted to public/images/freshlyforward-hero-wallpaper.png).
              Replaces the retired CSS/SVG HeroProductVisual composition per
              owner-directed plan deviation -- see kennel decision log,
              2026-09-06. Masked radially so its edges dissolve into the
              section's own bg-bg navy rather than sitting in a bordered box;
              width/height match the source's intrinsic 1672x941 to prevent
              layout shift. Decorative (alt="") -- the real headline/copy/CTA
              carry the page's actual claims, not this illustration. */}
          <div className="relative mx-auto w-full max-w-2xl">
            <img
              src="/images/freshlyforward-hero-wallpaper.png"
              alt=""
              width={1672}
              height={941}
              className="h-auto w-full [mask-image:radial-gradient(ellipse_70%_70%_at_center,black_55%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_70%_70%_at_center,black_55%,transparent_100%)]"
            />
          </div>
        </div>
      </section>
    </main>
  )
}
