import { ArrowRight } from 'lucide-react'
import { LinkButton } from '@/components/ui'
import { ProcessStep } from '@/components/ProcessStep'
import { ChatPreviewCard } from '@/components/ChatPreviewCard'
import { OpportunityPreviewCard } from '@/components/OpportunityPreviewCard'
import { FridayReportCard, type FridayReportCardData } from '@/components/FridayReportCard'

// Illustrative sample data only, following the same "isSample" convention
// established for the Landing hero -- see FridayReportCard.tsx and
// docs/superpowers/specs/2026-08-28-concierge-editorial-redesign-design.md.
// None of the names, companies, or conversations below represent a real
// client; they exist to show the shape of the real product UI, not to
// imply a specific outcome.
const sampleReport: FridayReportCardData = {
  title: 'Week 3 Progress Report',
  report_date: '2026-04-17',
  summary: 'Steady week. Two strong-fit roles went out with tailored materials, and one employer requested a screening call.',
  opportunities_reviewed: 14,
  applications_submitted: 2,
  interviews_scheduled: 1,
  next_steps: "Prep talking points for the screening call\nReview three new leads flagged this week\nFollow up on last week's application",
  approval_status: 'sent',
}

export function HowItWorksPage() {
  return (
    <main>
      <section className="page-hero shell">
        <div>
          <p className="eyebrow">How it works</p>
          <h1>A thoughtful search, managed from first conversation to first day.</h1>
          <p>FreshlyForward combines strategy, hands-on execution, weekly visibility, and interview coaching in one continuous partnership.</p>
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
        <ProcessStep
          index={1}
          title="We learn your story"
          copy="Before a single application goes out, your strategist spends real time understanding your background, what you're optimizing for this time around, and what you won't compromise on -- compensation floor, location, team culture, whatever matters to you. It's a conversation, not a form."
          visual={
            <ChatPreviewCard
              label="Sample intake conversation"
              messages={[
                { from: 'strategist', text: "Walk me through what made your last two roles feel right, and what didn't." },
                { from: 'member', text: 'Good scope and autonomy, but I want more ownership over strategy, not just execution.' },
                { from: 'strategist', text: "Got it. I'll prioritize roles with real strategic input over pure IC positions." },
              ]}
            />
          }
        />

        <ProcessStep
          index={2}
          reversed
          title="We set the strategy"
          copy="Your strategist turns that conversation into an actual plan: which roles to target, how to position your resume and LinkedIn, and where the guardrails are so you're never blindsided by an application you wouldn't have wanted submitted."
          visual={
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5">
              <div className="h-1.5 bg-primary-600" aria-hidden="true" />
              <div className="p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">Search Strategy</p>
                  <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-neutral-500">Sample</span>
                </div>
                <ul className="mt-5 space-y-4">
                  {[
                    { label: 'Target role', value: 'Senior Product Manager, growth-stage B2B SaaS' },
                    { label: 'Compensation floor', value: '$155K base, non-negotiable' },
                    { label: 'Location', value: 'Remote (US), occasional travel OK' },
                  ].map((row) => (
                    <li key={row.label} className="border-t border-neutral-100 pt-4 first:border-t-0 first:pt-0">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{row.label}</p>
                      <p className="mt-1 text-sm text-neutral-800">{row.value}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          }
        />

        <ProcessStep
          index={3}
          title="We handpick roles"
          copy="No mass-applying. Every opportunity is reviewed by a person -- your strategist -- for fit, trajectory, and whether it actually matches the plan you set together. If a role doesn't clear that bar, it doesn't get submitted."
          visual={
            <OpportunityPreviewCard
              role="Senior Product Manager, Platform"
              company="Example Robotics Co."
              location="Remote (US)"
              fitNote="Strong fit: growth-stage, cross-functional ownership, comp above your floor."
              status="reviewed"
            />
          }
        />

        <ProcessStep
          index={4}
          reversed
          title="We craft and apply"
          copy="Once a role clears review, your strategist tailors the resume and cover letter around that specific opportunity -- not a template with the company name swapped in -- and submits only with your explicit authorization."
          visual={
            <OpportunityPreviewCard
              role="Senior Product Manager, Platform"
              company="Example Robotics Co."
              location="Remote (US)"
              fitNote="Resume aligned to platform ownership; cover letter references their Q1 launch."
              status="submitted"
            />
          }
        />

        <ProcessStep
          index={5}
          title="We report every Friday"
          copy="Every week, you get a plain-language report: what was reviewed, what went out, what happened, and what's next. No dashboard you have to decode -- just a clear update, on a schedule you can count on."
          visual={<FridayReportCard report={sampleReport} isSample />}
        />

        <ProcessStep
          index={6}
          reversed
          title="We prepare and coach"
          copy="When interviews land, your strategist preps you for that specific conversation -- mock sessions, likely questions, and a second opinion when an offer finally shows up."
          visual={
            <ChatPreviewCard
              label="Sample coaching conversation"
              messages={[
                { from: 'member', text: 'Just got a screening call for the Platform PM role.' },
                { from: 'strategist', text: "Great news. Let's run through their likely questions -- I'll send a mock-interview slot for tomorrow." },
              ]}
            />
          }
        />
      </section>

      <section className="editorial-aside shell">
        <p className="eyebrow eyebrow-light">The human difference</p>
        <h2>You always know what is happening and why.</h2>
        <p>Every role has a rationale. Every application reflects your story. Every Friday brings a clear progress report.</p>
        <LinkButton to="/why-freshlyforward" variant="secondary">
          Why FreshlyForward <ArrowRight size={18} />
        </LinkButton>
      </section>
    </main>
  )
}
