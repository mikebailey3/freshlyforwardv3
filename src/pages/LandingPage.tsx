import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarCheck, Check, ClipboardCheck, FilePenLine, Handshake, MessageCircleMore, PauseCircle, Search, ShieldCheck, Target, UserRoundCheck, X } from 'lucide-react'
import { LinkButton, SectionHeading } from '@/components/ui'
import { ForwardFeedWidget } from '@/components/ForwardFeedWidget'

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
      <section className="cs-hero shell">
        <div className="cs-masthead">
          <span>FRESHLYFORWARD</span>
          <span>CALL SHEET</span>
          <span>STRATEGIST: ASSIGNED</span>
          <span>STATUS: IN PRODUCTION</span>
        </div>
        <div className="cs-hero-grid">
          <div className="cs-hero-copy reveal">
            <h1>We search. We apply. <span>You move forward.</span></h1>
            <p className="hero-lede">A real person manages the details of your job search—from strategy and tailored applications to interview preparation and ongoing support.</p>
            <div className="hero-actions">
              <LinkButton to="/signup">Get started <ArrowRight size={18} /></LinkButton>
              <LinkButton to="/how-it-works" variant="secondary">See how it works</LinkButton>
            </div>
            <div className="cs-manifest-strip" aria-label="Service assurances">
              <span><Check size={16} /> Human-led</span>
              <span><Check size={16} /> No mass applying</span>
              <span><Check size={16} /> Pause anytime</span>
            </div>
          </div>
          <div className="cs-contact-sheet reveal reveal-delay">
            <img src="/images/headshot.png?v=2" alt="FreshlyForward founder and career strategist" />
            <div className="cs-caption">
              <p>"Your search deserves focus, judgment, and a person who knows your story."</p>
              <div className="cs-caption-meta">
                <strong>Mike Bailey</strong>
                <span>FOUNDER &amp; STRATEGIST · FRAME 01</span>
              </div>
            </div>
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
