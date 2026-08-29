import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarCheck, Check, ClipboardCheck, FilePenLine, Handshake, MessageCircleMore, PauseCircle, Search, ShieldCheck, Target, UserRoundCheck, X } from 'lucide-react'
import { LinkButton, PillLinkButton, SectionHeading } from '@/components/ui'
import { ForwardFeedWidget } from '@/components/ForwardFeedWidget'
import { FridayReportCard, type FridayReportCardData } from '@/components/FridayReportCard'

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

// Explicitly labeled sample data for the hero -- never implied as a real
// member's report. See docs/superpowers/specs/2026-08-28-concierge-editorial-redesign-design.md
// for why this reuses the real FridayReport shape instead of inventing one.
const sampleReport: FridayReportCardData = {
  title: 'Week 5 Progress Report',
  report_date: '2026-05-08',
  summary: 'Strong week. Three roles cleared review and went out with tailored materials, and one first-round interview is on the books.',
  opportunities_reviewed: 18,
  applications_submitted: 3,
  interviews_scheduled: 1,
  next_steps: 'Finalize tailored resume for the Product Ops role\nPrep talking points for Thursday\'s interview\nReview two new leads flagged this week',
  approval_status: 'sent',
}

export function LandingPage() {
  const verdictRef = useRef<HTMLElement>(null)
  const [verdictVisible, setVerdictVisible] = useState(false)

  useEffect(() => {
    const node = verdictRef.current
    if (!node) return
    // One authored moment, not a scroll-fade applied everywhere: the verdict
    // (redline strike + approval stamp) plays once, the first time it's seen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVerdictVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <main className="callsheet">
      <section className="bg-[var(--cream)] py-14 lg:py-24">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-[1.1] text-[var(--navy)] sm:text-5xl lg:text-6xl">
              A better search needs better judgment.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-neutral-600">
              FreshlyForward is a human-led career concierge. One real strategist searches,
              applies, and reports back — so you're never doing this alone, and never
              guessing what's happening behind the scenes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PillLinkButton to="/signup">
                Get started <ArrowRight size={18} />
              </PillLinkButton>
              <PillLinkButton to="/how-it-works" variant="secondary">
                See how it works
              </PillLinkButton>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2" aria-label="Service assurances">
              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <Check size={16} className="text-primary-600" /> Human-led
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <Check size={16} className="text-primary-600" /> No mass applying
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <Check size={16} className="text-primary-600" /> Pause anytime
              </span>
            </div>
          </div>
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <FridayReportCard report={sampleReport} isSample />
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

      {/* TODO(social-proof): homepage currently has zero third-party validation --
          the only testimonial above is from the founder about his own service.
          Before the next marketing push, add 2-3 real client quotes/outcomes here
          (name + result, with permission) or a placement/client-count stat.
          Do not fill this with placeholder/fabricated quotes. */}

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
