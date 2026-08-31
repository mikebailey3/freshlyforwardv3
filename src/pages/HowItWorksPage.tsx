import { ArrowRight, Mail } from 'lucide-react'
import { LinkButton } from '@/components/ui'
import { AlternatingRow } from '@/components/AlternatingRow'
import { ChatPreviewCard } from '@/components/ChatPreviewCard'
import { OpportunityPreviewCard } from '@/components/OpportunityPreviewCard'
import { KeyValueCard } from '@/components/KeyValueCard'
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
        <AlternatingRow
          eyebrow="Step 1"
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

        <AlternatingRow
          eyebrow="Step 2"
          reversed
          title="We set the strategy"
          copy="Your strategist turns that conversation into an actual plan: which roles to target, how to position your resume and LinkedIn, and where the guardrails are so you're never blindsided by an application you wouldn't have wanted submitted."
          visual={
            <KeyValueCard
              label="Search Strategy"
              rows={[
                { label: 'Target role', value: 'Senior Product Manager, growth-stage B2B SaaS' },
                { label: 'Compensation floor', value: '$155K base, non-negotiable' },
                { label: 'Location', value: 'Remote (US), occasional travel OK' },
              ]}
            />
          }
        />

        <AlternatingRow
          eyebrow="Step 3"
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

        <AlternatingRow
          eyebrow="Step 4"
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

        <AlternatingRow
          eyebrow="Step 5"
          title="We report every Friday"
          copy="Every week, you get a plain-language report: what was reviewed, what went out, what happened, and what's next. No dashboard you have to decode -- just a clear update, on a schedule you can count on."
          visual={<FridayReportCard report={sampleReport} isSample />}
        />

        <AlternatingRow
          eyebrow="Step 6"
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

      <section className="bg-[var(--cream)] py-16">
        <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary-600">Always on</span>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-[var(--navy)] sm:text-4xl">Your dashboard, always on -- not just Friday.</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-600">The Friday report is the headline, but the dashboard behind it never sleeps. Track every application and interview as it moves, message your strategist directly whenever something comes up, and see what's next on your calendar -- all in one place, updated in real time, not just once a week.</p>
            <ul className="mt-6 space-y-2 text-sm text-neutral-700">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" /> Live application &amp; interview tracking</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" /> Direct messaging with your strategist, any time</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" /> A calendar of what's coming up next</li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 divide-x divide-neutral-200">
              <div className="p-5"><p className="text-xs font-semibold text-neutral-500">Applications</p><p className="mt-2 font-mono text-2xl font-bold text-neutral-900">4</p><p className="mt-1 text-[11px] text-neutral-500">Active</p></div>
              <div className="p-5"><p className="text-xs font-semibold text-neutral-500">Interviews</p><p className="mt-2 font-mono text-2xl font-bold text-neutral-900">1</p><p className="mt-1 text-[11px] text-neutral-500">Upcoming</p></div>
              <div className="p-5"><p className="text-xs font-semibold text-neutral-500">Messages</p><p className="mt-2 font-mono text-2xl font-bold text-neutral-900">2</p><p className="mt-1 text-[11px] text-neutral-500">Unread</p></div>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 p-5">
              <div><p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-500">On Call</p><p className="mt-1 text-sm font-semibold text-neutral-900">Your Career Strategist</p></div>
              <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white"><Mail className="h-4 w-4" aria-hidden="true" /> Send a Message</span>
            </div>
            <p className="border-t border-neutral-100 px-5 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Sample dashboard preview</p>
          </div>
        </div>
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
