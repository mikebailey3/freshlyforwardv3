import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui'
import { AlternatingRow } from '@/components/AlternatingRow'
import { KeyValueCard } from '@/components/KeyValueCard'
import { ChecklistPreviewCard } from '@/components/ChecklistPreviewCard'
import { OpportunityPreviewCard } from '@/components/OpportunityPreviewCard'
import { ChatPreviewCard } from '@/components/ChatPreviewCard'

// Illustrative sample data only -- same "isSample"/labeled-preview
// convention as HowItWorksPage and FridayReportCard. No real client,
// employer, or outcome is represented here.
export function ServicesPage() {
  return (
    <main>
      <section className="page-hero shell">
        <div>
          <p className="eyebrow">Services</p>
          <h1>Everything your job search needs. Personally handled.</h1>
          <p>Choose focused support or a complete concierge partnership. Either way, the work stays thoughtful, personal, and human-led.</p>
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
          eyebrow="Strategy"
          title="Career search strategy"
          copy="We start by clarifying where you're headed -- target roles, positioning, compensation expectations, and the practical plan that ties it together, so every next move has a reason behind it."
          visual={
            <KeyValueCard
              label="Search Strategy"
              rows={[
                { label: 'Target role', value: 'Director of Marketing, Series B-D startups' },
                { label: 'Search radius', value: 'Remote (US) or Austin, TX' },
                { label: 'Priority', value: 'Team leadership + equity upside' },
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Materials"
          reversed
          title="Resume & profile optimization"
          copy="Your resume and LinkedIn profile get rebuilt around measurable impact, not job-description language recycled from your old titles -- so a recruiter can see what you actually accomplished in the first ten seconds."
          visual={
            <ChecklistPreviewCard
              label="Resume Optimization"
              items={[
                'Quantified impact added to 6 bullet points',
                'LinkedIn headline rewritten for target roles',
                'Removed outdated or irrelevant experience',
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Research"
          title="Opportunity research"
          copy="We track down roles that actually match your strategy -- not everything with a matching keyword -- and review each one for fit, growth trajectory, and whether it's worth your time before it ever reaches you."
          visual={
            <OpportunityPreviewCard
              role="Director of Marketing"
              company="Example Health Co."
              location="Austin, TX (Hybrid)"
              fitNote="Strong fit: reports to CMO, matches your leadership-track goal."
              status="reviewed"
            />
          }
        />

        <AlternatingRow
          eyebrow="Execution"
          reversed
          title="Application concierge"
          copy="Once a role clears review, we tailor the materials to that specific opportunity, handle the application details, and keep everything moving -- with your explicit sign-off before anything goes out."
          visual={
            <OpportunityPreviewCard
              role="Director of Marketing"
              company="Example Health Co."
              location="Austin, TX (Hybrid)"
              fitNote="Cover letter highlights your Series B scaling experience directly."
              status="submitted"
            />
          }
        />

        <AlternatingRow
          eyebrow="Preparation"
          title="Interview preparation"
          copy="When an interview lands, we prep you for that specific conversation -- likely questions, sharper answers to your own stories, and mock sessions until you walk in calm instead of scrambling."
          visual={
            <ChatPreviewCard
              label="Sample prep conversation"
              messages={[
                { from: 'member', text: 'Panel interview with the CMO and two directors next week.' },
                { from: 'strategist', text: "Let's run a mock panel Thursday -- I'll play the toughest interviewer." },
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Coaching"
          reversed
          title="Career coaching"
          copy="Offers, counteroffers, and hard calls don't have to be made alone. Your strategist stays a sounding board through decisions, setbacks, and whatever comes after the search itself ends."
          visual={
            <KeyValueCard
              label="Offer Evaluation"
              rows={[
                { label: 'Base salary', value: '$142K (target: $135K+)' },
                { label: 'Equity', value: '0.15%, 4-year vest' },
                { label: 'Verdict', value: 'Exceeds target -- worth accepting' },
              ]}
            />
          }
        />
      </section>

      <section className="editorial-aside shell">
        <p className="eyebrow eyebrow-light">The human difference</p>
        <h2>No AI mass applications -- ever.</h2>
        <p>Technology can support research and organization. The judgment, writing, decisions, and accountability remain human.</p>
        <LinkButton to="/why-freshlyforward" variant="secondary">
          Why FreshlyForward <ArrowRight size={18} />
        </LinkButton>
      </section>
    </main>
  )
}
