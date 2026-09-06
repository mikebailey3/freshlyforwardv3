import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Compass,
  FileText,
  Layers,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { LinkButton, SectionHeader } from '@/components/ui'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MetricCard } from '@/components/homepage/MetricCard'
import { FreshFitBadge } from '@/components/homepage/FreshFitBadge'
import { ProfileStrengthCard } from '@/components/homepage/ProfileStrengthCard'
import { ForwardScoreCard } from '@/components/homepage/ForwardScoreCard'

/** The four-step journey for the Positioning section. Each step points at a
 * real route/feature (Career Compass, Forward DNA, Opportunity Engine,
 * Applications) -- no invented product names. */
const JOURNEY_STEPS = [
  {
    number: '01',
    verb: 'Understand',
    icon: Compass,
    description:
      "Career Compass maps your direction, strengths, and readiness -- so you start from clarity, not guesswork.",
    to: '/career-compass',
    label: 'Take the Career Compass',
  },
  {
    number: '02',
    verb: 'Build',
    icon: Layers,
    description:
      'Forward DNA turns your experience, skills, and evidence into a structured profile the system can actually use.',
    to: '/forward-dna',
    label: 'See Forward DNA',
  },
  {
    number: '03',
    verb: 'Discover',
    icon: Search,
    description:
      'The Opportunity Engine surfaces roles scored by FreshFit -- not keyword matches, but opportunities that actually fit.',
    to: '/opportunity-engine',
    label: 'Explore the Opportunity Engine',
  },
  {
    number: '04',
    verb: 'Advance',
    icon: TrendingUp,
    description:
      'Track applications, watch your Forward Score climb, and know your next move -- with strategist support when judgment matters.',
    to: '/applications',
    label: 'See how progress is tracked',
  },
]

/** Sample FreshFit tier legend -- same four tiers as the real Opportunity
 * Engine (src/lib/freshFitScore/tiers.ts), never a separate scale. */
const FRESHFIT_TIER_EXAMPLES = [
  { score: 86, description: 'Skills, seniority, and goals line up clearly.' },
  { score: 68, description: 'Strong overlap -- worth a close look.' },
  { score: 45, description: 'Partial fit, lower confidence.' },
  { score: 25, description: 'Meaningful gaps -- likely not the right move yet.' },
]

/** Threads the (future) Forward Profile will connect. Illustrative only --
 * foreshadows the upcoming Forward Profiles project without implementing it. */
const PROFILE_THREADS = [
  { icon: Briefcase, label: 'Experience & career history' },
  { icon: Layers, label: 'Skills & evidence (Forward DNA)' },
  { icon: Target, label: 'Goals & direction (Career Compass)' },
  { icon: Search, label: 'Matched opportunities (FreshFit)' },
  { icon: FileText, label: 'Resumes & applications' },
]

export function LandingPage() {
  return (
    <main className="callsheet">
      {/* Layer 1: Career Operating System (identity) -- APPROVED, LOCKED.
          Checkpoint A hero. Do not revisit scale, wallpaper positioning,
          copy, CTA treatment, navigation, or blending here unless a real
          regression appears. */}
      <section className="relative overflow-hidden bg-bg py-14 lg:py-28">
        {/* Approved North Star hero wallpaper (owner-supplied art direction,
            docs/superpowers/visual-review/81F4884C-BF73-440A-8E44-2ED0776F6C70.png,
            promoted to public/images/freshlyforward-hero-wallpaper.png).

            Desktop: a single full-width layer spanning the *entire* section (not a
            boxed sub-container starting at a fixed x-position) with a soft readability
            scrim layered on top of it -- "artwork underneath, gradient over the left,
            real content on top" rather than "left panel | right panel". Removing the
            container boundary (rather than covering it with another layer) is what
            eliminated an earlier visible seam.

            Uses background-image + background-size + background-position (not <img> +
            object-fit + a CSS transform) for the pan/zoom into the dashboard:
            transform:scale() always zooms from the element's own center regardless of
            object-position, which silently defeated earlier attempts to reposition the
            crop toward the left nav / Forward Score. background-position gives direct,
            predictable control over exactly which part of the artwork is framed. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-no-repeat lg:block"
          style={{
            backgroundImage: "url('/images/freshlyforward-hero-wallpaper.png')",
            backgroundSize: '148% auto',
            backgroundPosition: '30% 45%',
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-bg)_0%,var(--color-bg)_53%,transparent_76%),linear-gradient(to_bottom,transparent_52%,var(--color-bg)_100%),linear-gradient(to_top,transparent_88%,var(--color-bg)_100%)]" />
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

      {/* Layer 2: Positioning -- editorial four-step journey, not four SaaS
          cards. Typographic hierarchy (giant numbers + verbs) does the work
          instead of borders/backgrounds. */}
      <section className="bg-bg py-20 lg:py-28">
        <div className="shell">
          <SectionHeader
            eyebrow="The career operating system"
            title="More than a job search tool. A complete career operating system."
            description="FreshlyForward connects every stage of your search into one continuous system -- so nothing you learn about yourself gets lost between steps."
          />
          <ol className="mt-14 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {JOURNEY_STEPS.map((step) => (
              <li key={step.number} className="border-t-2 border-primary-500/40 pt-6">
                <span className="font-mono text-sm font-semibold text-ink-muted">{step.number}</span>
                <div className="mt-3 flex items-center gap-2">
                  <step.icon className="h-5 w-5 text-primary-400" aria-hidden="true" />
                  <h3 className="font-display text-2xl font-semibold text-ink">{step.verb}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{step.description}</p>
                <Link
                  to={step.to}
                  className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-primary-400 hover:text-primary-300"
                >
                  {step.label} <ArrowRight size={14} />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Layer 3: Current Focus -- the TrophyCoach-inspired section. One
          large spotlight panel, not a small dashboard widget. */}
      <section className="bg-surface-subtle py-20 lg:py-28">
        <div className="shell grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeader
              eyebrow="Personalized guidance"
              title="Your next move should be obvious."
              description="FreshlyForward doesn't just show you information -- it tells you what to do next, backed by evidence from your own profile and progress."
            />
            <p className="mt-6 text-sm leading-relaxed text-ink-muted">
              Every recommendation is grounded in something real: a skill gap the system found, a milestone you're
              close to, or a pattern in how you're moving through your search. No generic advice -- just your next,
              clearest move.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-surface-card p-8 shadow-lg shadow-black/10 lg:p-10">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-primary-400">
                <Target className="h-4 w-4" aria-hidden="true" /> Current Focus
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-ink-muted">
                Sample
              </span>
            </div>
            <h3 className="mt-5 font-display text-2xl font-semibold text-ink lg:text-3xl">
              Strengthen your interview readiness
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Your Forward DNA shows strong evidence for account management and forecasting, but interview prep is
              the one pillar still holding your Forward Score back. Two mock interviews this month would close most
              of that gap.
            </p>
            <ProgressBar value={60} label="Interview readiness" className="mt-6" />
            <LinkButton to="/forward-dna" variant="secondary">
              <span className="flex items-center gap-2">
                Close this gap <ArrowRight size={16} />
              </span>
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Layer 4: Opportunity Intelligence / FreshFit -- one detailed
          "why it fits" example, plus the real four-tier legend. Emphasizes
          reasoning over a bare score. */}
      <section className="bg-bg py-20 lg:py-28">
        <div className="shell">
          <SectionHeader
            eyebrow="Opportunity intelligence"
            title="It's not just a score -- it's why it fits."
            description="FreshFit weighs your skills, seniority, goals, and preferences against every opportunity -- and shows its reasoning, not just a number."
          />

          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="rounded-3xl border border-border bg-surface-card p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Top Opportunity &middot; Sample
                  </p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-ink">Regional Sales Manager</h3>
                  <p className="text-sm text-ink-muted">CPG &middot; Remote</p>
                </div>
                <FreshFitBadge score={86} />
              </div>
              <ul className="mt-6 space-y-3 border-t border-border pt-6">
                <li className="flex items-start gap-2 text-sm text-ink-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
                  Six years of B2B sales experience matches this role's seniority and scope.
                </li>
                <li className="flex items-start gap-2 text-sm text-ink-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
                  Skill overlap in forecasting, account management, and CRM tools.
                </li>
                <li className="flex items-start gap-2 text-sm text-ink-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
                  Remote-eligible, matching your stated location preference.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-muted">
                The FreshFit scale
              </p>
              <ul className="mt-4 space-y-4">
                {FRESHFIT_TIER_EXAMPLES.map((tier) => (
                  <li key={tier.score} className="flex items-start gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
                    <FreshFitBadge score={tier.score} />
                    <p className="text-sm text-ink-muted">{tier.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Layer 5: Forward Profile -- foreshadows the upcoming Forward
          Profiles project (identity backbone) without implementing it. */}
      <section className="bg-surface-subtle py-20 lg:py-28">
        <div className="shell grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <ProfileStrengthCard name="Mike B." headline="Career OS Member since 2026" strength={82} forwardScore={78} />

          <div>
            <SectionHeader
              eyebrow="Forward Profile"
              title="Your career story, finally connected."
              description="Everything FreshlyForward learns about you lives in one place -- not scattered across resumes, forms, and forgotten notes."
            />
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROFILE_THREADS.map((thread) => (
                <li key={thread.label} className="flex items-center gap-2.5 text-sm text-ink-muted">
                  <thread.icon className="h-4 w-4 shrink-0 text-primary-400" aria-hidden="true" />
                  {thread.label}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-ink-muted">
              More connected career tools are on the way -- built on this same profile, so your story never has to
              start over.
            </p>
          </div>
        </div>
      </section>

      {/* Layer 6: Human + AI -- integrated differentiator, not the primary
          product definition. Plain typographic two-column layout; no cards. */}
      <section className="bg-bg py-20 lg:py-28">
        <div className="shell">
          <SectionHeader
            align="center"
            className="mx-auto"
            eyebrow="Human + AI"
            title="A better search needs better judgment."
            description="FreshlyForward combines AI career intelligence with real strategist judgment where context matters most."
          />
          <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary-400" aria-hidden="true" />
                <h3 className="font-display text-lg font-semibold text-ink">AI career intelligence</h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                <li>Personalized opportunity matching, powered by FreshFit</li>
                <li>Structured profile-building through Forward DNA</li>
                <li>Momentum tracking through your Forward Score</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary-400" aria-hidden="true" />
                <h3 className="font-display text-lg font-semibold text-ink">Real strategist judgment</h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                <li>Context and nuance the system can't see on its own</li>
                <li>Accountability, encouragement, and a second opinion</li>
                <li>Support exactly where it matters -- not a 24/7 requirement</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Layer 7: Progress / outcomes -- sample metrics only, no
          testimonials, logos, user counts, or success rates. */}
      <section className="bg-surface-subtle py-20 lg:py-28">
        <div className="shell">
          <SectionHeader
            eyebrow="Progress"
            title="See your career moving forward."
            description="Every action you take -- an interview, an application, a completed skill gap -- moves a real number. Sample data shown; your own progress starts the moment you sign up."
          />
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
            <ForwardScoreCard score={78} delta="+12 this month" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard icon={Briefcase} label="Active Applications" value="6" delta="+2 this week" />
              <MetricCard icon={Target} label="Profile Strength" value="82%" />
              <MetricCard icon={Search} label="New Matches" value="5" delta="This week" />
              <MetricCard icon={CheckCircle2} label="Interviews Scheduled" value="1" />
            </div>
          </div>
        </div>
      </section>

      {/* Layer 8: Final CTA */}
      <section className="bg-bg py-20 lg:py-28">
        <div className="shell text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl lg:text-5xl">
            Your next opportunity is closer than you think.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-muted">
            Get started free and see your Career Compass, Forward Score, and matched opportunities in minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton to="/signup">
              Get started free <ArrowRight size={18} />
            </LinkButton>
            <LinkButton to="/how-it-works" variant="secondary">
              See how it works
            </LinkButton>
          </div>
        </div>
      </section>
    </main>
  )
}
