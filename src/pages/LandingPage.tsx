import { ArrowRight, CalendarCheck, Check, ClipboardCheck, FilePenLine, Handshake, MessageCircleMore, PauseCircle, PlayCircle, Search, ShieldCheck, Target, UserRoundCheck, X } from 'lucide-react'
import { LinkButton, SectionHeading } from '@/components/ui'
import { ForwardFeedWidget } from '@/components/ForwardFeedWidget'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { HeroFreshFitCenterpiece } from '@/components/homepage/HeroFreshFitCenterpiece'
import { HeroFloatingCard } from '@/components/homepage/HeroFloatingCard'
import { HeroCareerPath, HeroFigureSilhouette } from '@/components/homepage/HeroCareerPath'

const manifest = [
  { icon: ShieldCheck, title: '100% Human-Led Service', copy: 'No bots, no shortcuts. Every decision is made by a real career professional.' },
  { icon: Search, title: 'Hand-Selected Opportunities', copy: 'We research roles for fit, trajectory, compensation, and your personal goals.' },
  { icon: FilePenLine, title: 'Hand-Crafted Applications', copy: 'Every resume adjustment and cover letter is built around one specific opportunity.' },
  { icon: CalendarCheck, title: 'Weekly Progress Every Friday', copy: 'See what we found, where we applied, and what happens next—every single week.' },
  { icon: MessageCircleMore, title: 'Personal Strategist Support', copy: 'Your dedicated strategist stays available for questions, decisions, and momentum.' },
  { icon: PauseCircle, title: 'No Contracts. Pause Anytime.', copy: 'A flexible month-to-month partnership designed around real life and real careers.' },
]

const scenes: [string, string, string][] = [
  ['SC. 01', 'Tell us your story', 'We learn your background, goals, preferences, strengths, and non-negotiables.'],
  ['SC. 02', 'Build your strategy', 'Your strategist sharpens your positioning and creates a focused search plan.'],
  ['SC. 03', 'We search and apply', 'We handpick strong-fit roles and craft each application one at a time.'],
  ['SC. 04', 'Review Friday progress', 'You receive a clear weekly report with decisions, applications, and next steps.'],
  ['SC. 05', 'Prepare with confidence', 'We coach your interviews, run mock sessions, and help you evaluate offers.'],
]

// Homepage Redesign Phase 1 / Task 2: three short trust bullets under the
// hero CTAs, replacing the old "Human-led / No mass applying / Pause
// anytime" set now that the hero itself carries the human-led/no-mass-apply
// message in its subcopy -- kept short per the North Star reference.
const heroFeatureBullets = ['Personalized', 'AI-powered career intelligence', 'Human experts']

export function LandingPage() {
  const [verdictRef, verdictVisible] = useScrollReveal<HTMLElement>(0.4)

  return (
    <main className="callsheet">
      <section className="bg-[var(--navy)] py-14 text-white lg:py-24">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
              Your Career <span className="text-[#7ee4b6]">Operating System</span> for What's Next.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#bac8d6]">
              One connected system for your career search: Career Compass points you in the right
              direction, the Opportunity Engine and FreshFit surface and score the roles worth your
              time, Applications keeps everything moving, and a real human strategist is there when
              you need one.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/career-compass">
                Take Career Compass <ArrowRight size={18} />
              </LinkButton>
              <LinkButton to="/how-it-works" variant="secondary">
                <PlayCircle size={18} /> See How It Works
              </LinkButton>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2" aria-label="Service assurances">
              {heroFeatureBullets.map((bullet) => (
                <span key={bullet} className="flex items-center gap-1.5 text-sm font-medium text-[#bac8d6]">
                  <Check size={16} className="text-[#7ee4b6]" /> {bullet}
                </span>
              ))}
            </div>
          </div>

          {/* Homepage Redesign Phase 1 / Task 3: FreshFit centerpiece +
              career-path graphic + floating cards + human figure. All
              floating-card content is hand-authored sample/marketing data
              grounded in real capabilities (Opportunity Engine tier
              language, real Dashboard stat categories) -- never live
              member data. Hidden below `lg` per the plan rather than
              attempting the full composition on narrow screens. */}
          <div className="relative hidden lg:block" style={{ minHeight: 420 }}>
            <HeroCareerPath className="absolute inset-0 h-full w-full" />
            <HeroFigureSilhouette className="reveal absolute bottom-6 left-6 h-20 w-12" style={{ animationDelay: '.1s' }} />
            <div className="reveal mx-auto w-fit" style={{ animationDelay: '.2s' }}>
              <HeroFreshFitCenterpiece />
            </div>
            <HeroFloatingCard className="reveal right-0 top-2" style={{ animationDelay: '.35s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Top Opportunity</p>
              <p className="mt-1 text-sm font-semibold text-white">Senior Product Manager</p>
              <p className="text-xs text-[#bac8d6]">92 FreshFit -- Highest Fit</p>
            </HeroFloatingCard>
            <HeroFloatingCard className="reveal left-0 top-32" style={{ animationDelay: '.5s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Search Readiness</p>
              <p className="mt-1 text-lg font-bold text-white">78<span className="text-xs font-normal text-[#bac8d6]">/100</span></p>
            </HeroFloatingCard>
            <HeroFloatingCard className="reveal bottom-24 right-4" style={{ animationDelay: '.65s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Applications</p>
              <p className="mt-1 text-lg font-bold text-white">6 <span className="text-xs font-normal text-[#bac8d6]">this month</span></p>
            </HeroFloatingCard>
          </div>
        </div>
      </section>

      <section className="cs-manifest-section" aria-labelledby="promise-title">
        <div className="shell">
          <SectionHeading title="High-touch help for a high-stakes moment." id="promise-title" />
          <div className="cs-manifest-table" role="table" aria-label="What's included">
            {manifest.map(({ icon: Icon, title, copy }) => (
              <div className="cs-manifest-row" role="row" key={title}>
                <Icon aria-hidden="true" className="cs-manifest-icon" />
                <div role="cell">
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
                <Check aria-hidden="true" className="cs-manifest-check" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={verdictRef} className={`contrast-section shell${verdictVisible ? ' cs-verdict-visible' : ''}`}>
        <div className="contrast-intro">
          <h2>No AI mass applications. No spray-and-pray search.</h2>
          <p>One carefully chosen opportunity is worth more than a hundred generic submissions. We use technology as a tool—not as a substitute for judgment, care, or accountability.</p>
        </div>
        <div className="contrast-card contrast-muted cs-redline">
          <span>Mass application services</span>
          {['Hundreds of generic submissions', 'Template-based materials', 'Little context on role selection', 'No person accountable to you'].map((item) => <p key={item}><X size={16} /> {item}</p>)}
        </div>
        <div className="contrast-card contrast-positive cs-stamped">
          <span className="cs-stamp" aria-hidden="true">APPROVED</span>
          <span>The FreshlyForward standard</span>
          {['Opportunities selected for fit', 'Materials tailored by hand', 'A reason behind every application', 'A strategist who knows your story'].map((item) => <p key={item}><Check size={16} /> {item}</p>)}
        </div>
      </section>

      <section className="cs-schedule-section shell">
        <SectionHeading title="Your concierge process" copy="You stay focused on your life and your future. We keep the search moving with care and consistency." />
        <div className="cs-schedule">
          {scenes.map(([scene, title, copy]) => (
            <article className="cs-scene" key={scene}>
              <span className="cs-scene-tag">{scene}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="service-preview shell">
        <div className="service-preview-copy">
          <h2>Strategy, execution, and support—working together.</h2>
          <p>FreshlyForward closes the gap between knowing you need a better role and having enough time, energy, and expertise to pursue it well.</p>
          <LinkButton to="/services" variant="secondary">Explore services <ArrowRight size={18} /></LinkButton>
        </div>
        <div className="service-stack">
          <div><Target /><span><strong>Search strategy</strong>Define the right roles, companies, and story.</span></div>
          <div><ClipboardCheck /><span><strong>Application execution</strong>Research, tailor, review, and submit.</span></div>
          <div><UserRoundCheck /><span><strong>Interview readiness</strong>Practice, refine, and build confidence.</span></div>
          <div><Handshake /><span><strong>Ongoing coaching</strong>Navigate decisions, offers, and next moves.</span></div>
        </div>
      </section>

      <ForwardFeedWidget />

      {/* TODO(social-proof): homepage currently has zero third-party validation.
          The hero used to carry a founder testimonial/photo as its only human
          trust signal; the Concierge Editorial hero rebuild (2026-08-28) replaced
          it with a sample Friday Report artifact instead, so as of that change
          this page has no human-face or third-party proof at all above the fold.
          Homepage Redesign Phase 1's Human Support section (Task 6) adds real,
          non-fabricated capability description in this spirit, but per the
          approved spec (locked decision #5) this page must never carry invented
          testimonials, ratings, or counts -- so this TODO stays open rather than
          being closed by fabrication. */}

      <section className="closing-cta cs-final-call">
        <div className="shell closing-inner">
          <div>
            <span className="cs-stamp cs-stamp-light" aria-hidden="true">FINAL CALL</span>
            <h2>Let's make your job search feel lighter—and work harder.</h2>
          </div>
          <LinkButton to="/signup" variant="light">Get started <ArrowRight size={18} /></LinkButton>
        </div>
      </section>
    </main>
  )
}
