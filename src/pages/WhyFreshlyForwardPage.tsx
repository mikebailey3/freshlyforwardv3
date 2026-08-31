import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui'
import { AlternatingRow } from '@/components/AlternatingRow'
import { ChatPreviewCard } from '@/components/ChatPreviewCard'
import { ChecklistPreviewCard } from '@/components/ChecklistPreviewCard'
import { KeyValueCard } from '@/components/KeyValueCard'
import { FridayReportCard, type FridayReportCardData } from '@/components/FridayReportCard'

// Illustrative sample data only -- same "isSample"/labeled-preview
// convention as HowItWorksPage/ServicesPage. No real client is represented.
const sampleReport: FridayReportCardData = {
  title: 'Week 6 Progress Report',
  report_date: '2026-05-15',
  summary: 'Quiet week on volume, high on quality -- one role stood out as a strong fit and went out with fully tailored materials.',
  opportunities_reviewed: 11,
  applications_submitted: 1,
  interviews_scheduled: 0,
  next_steps: "Await response on this week's submission\nContinue researching two flagged leads\nRevisit search radius if nothing lands by next Friday",
  approval_status: 'sent',
}

export function WhyFreshlyForwardPage() {
  return (
    <main>
      <section className="page-hero shell">
        <div>
          <p className="eyebrow">Why FreshlyForward</p>
          <h1>Because your career is too important for a volume game.</h1>
          <p>The job-search industry often rewards speed and scale. FreshlyForward is built around judgment, trust, transparency, and work that sounds like you.</p>
          <div className="hero-actions">
            <LinkButton to="/signup">
              Get started <ArrowRight size={18} />
            </LinkButton>
            <LinkButton to="/contact" variant="secondary">
              Talk with us
            </LinkButton>
          </div>
        </div>
        <div className="page-hero-mark" aria-hidden="true">
          <span>FF</span>
          <ArrowRight />
        </div>
      </section>

      <section className="shell">
        <AlternatingRow
          eyebrow="Ownership"
          title="A person owns the work"
          copy="Your strategist isn't a rotating queue of support tickets. One person understands your goals, makes the calls on your search, and stays accountable to the quality of what goes out under your name."
          visual={
            <ChatPreviewCard
              label="Sample check-in"
              messages={[
                { from: 'strategist', text: "Quick update -- I found a role that fits what we discussed. Reviewing it now before I bring it to you." },
                { from: 'member', text: 'Appreciate you flagging it before just sending it over.' },
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Authenticity"
          reversed
          title="Your materials stay yours"
          copy="Applications are written around your real experience and how you actually talk -- not a generic template with your name dropped in. If it doesn't sound like something you'd say, it doesn't go out."
          visual={
            <ChecklistPreviewCard
              label="Materials Review"
              items={[
                'Written in your own voice, not a template',
                'No invented skills or experience',
                'You review before anything is submitted',
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Transparency"
          title="The process stays visible"
          copy="You get a Friday report and real context behind every opportunity we pursue -- not a black box you have to trust blindly. If something didn't get submitted, you'll know exactly why."
          visual={<FridayReportCard report={sampleReport} isSample />}
        />

        <AlternatingRow
          eyebrow="Selectivity"
          reversed
          title="Fit beats volume"
          copy="We'd rather send three applications that actually fit than a hundred that don't. Every submission has a reason behind it -- worth your time and worth the employer's attention."
          visual={
            <KeyValueCard
              label="This Week's Search"
              rows={[
                { label: 'Opportunities reviewed', value: '18' },
                { label: 'Applications submitted', value: '3' },
                { label: 'Why the gap', value: 'Quality over quantity, every time' },
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Continuity"
          title="Support continues"
          copy="Interview coaching and career guidance stay connected to the search itself -- the same person who found the role helps you prepare for it, and helps you think through what comes after."
          visual={
            <ChatPreviewCard
              label="Sample offer conversation"
              messages={[
                { from: 'member', text: 'Got an offer. Not sure if I should push back on the base salary.' },
                { from: 'strategist', text: "Let's talk through it before you respond -- there's usually room here." },
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Flexibility"
          reversed
          title="Flexibility is standard"
          copy="Life doesn't pause for a job search, so the service doesn't lock you in either. Pause when things get busy, and pick back up whenever you're ready -- no penalty, no renegotiation."
          visual={
            <ChecklistPreviewCard
              label="Membership Terms"
              items={['Pause anytime, no penalty', 'No long-term contract', "Resume whenever you're ready"]}
            />
          }
        />
      </section>

      <section className="editorial-aside shell">
        <p className="eyebrow eyebrow-light">The human difference</p>
        <h2>Human judgment is the product.</h2>
        <p>A job can change your income, confidence, family routine, and future. That deserves more than automation at scale.</p>
        <LinkButton to="/how-it-works" variant="secondary">
          See how it works <ArrowRight size={18} />
        </LinkButton>
      </section>
    </main>
  )
}
