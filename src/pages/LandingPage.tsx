import { ArrowRight, Check, Compass, FileStack, FileText, FolderOpen, HelpCircle, LayoutGrid, MessageCircleMore, MessageCircleOff, MessagesSquare, PenLine, PlayCircle, Rocket, Search, Target, TrendingUp, UserX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LinkButton, SectionHeading } from '@/components/ui'
import { HeroFreshFitCenterpiece } from '@/components/homepage/HeroFreshFitCenterpiece'
import { HeroFloatingCard } from '@/components/homepage/HeroFloatingCard'
import { HeroCareerPath } from '@/components/homepage/HeroCareerPath'
import { NodeGraph, type GraphNode } from '@/components/homepage/NodeGraph'

// Homepage Redesign Phase 1 / Task 7: "Why FreshlyForward?" node-graph
// comparison. Left side is deliberately generic/negative (no real product
// or competitor named); right side is every real capability referenced
// elsewhere on this page, connected in the same order as How It Works.
const traditionalNodes: GraphNode[] = [
  { icon: LayoutGrid, label: 'Endless job boards', x: 15, y: 20 },
  { icon: FileStack, label: 'Generic templates', x: 75, y: 15 },
  { icon: HelpCircle, label: 'No fit signal', x: 30, y: 65 },
  { icon: MessageCircleOff, label: 'No feedback', x: 80, y: 70 },
  { icon: UserX, label: "You're on your own", x: 50, y: 40 },
]

const connectedNodes: GraphNode[] = [
  { icon: Compass, label: 'Career Compass', x: 15, y: 75 },
  { icon: Search, label: 'Opportunity Engine', x: 35, y: 30 },
  { icon: Target, label: 'FreshFit', x: 60, y: 15 },
  { icon: FolderOpen, label: 'Career Vault', x: 82, y: 35 },
  { icon: MessageCircleMore, label: 'Human Strategist', x: 70, y: 75 },
]

// Homepage Redesign Phase 1 / Task 5: flagship feature showcase. Career
// Vault is included per the locked spec decision (kept in the flagship
// slot, clearly "Coming Soon", no route/link) rather than substituted with
// Achievement Vault or omitted.
const flagshipFeatures = [
  {
    icon: Search,
    title: 'Opportunity Engine',
    copy: 'Real roles, ranked by fit -- not another feed to scroll through by hand.',
    to: '/opportunity-engine',
    comingSoon: false,
  },
  {
    icon: Target,
    title: 'FreshFit',
    copy: 'A directional fit score for every role, so you know which ones deserve your time first.',
    to: '/opportunity-engine',
    comingSoon: false,
  },
  {
    icon: FolderOpen,
    title: 'Career Vault',
    copy: 'Your resume versions, wins, and career story, organized in one place.',
    to: null,
    comingSoon: true,
  },
] as const

// Supporting capabilities. Human Strategists intentionally stays brief here
// -- Task 6's Human Support section carries the fuller treatment, this card
// just establishes it exists as a real capability alongside the other two.
const supportingCapabilities = [
  { icon: Compass, title: 'Career Compass', copy: 'A short assessment that points you toward directions worth pursuing.', to: '/career-compass' },
  { icon: FileText, title: 'Applications', copy: 'Every application you send, tracked in one place -- no spreadsheets required.', to: '/applications' },
  { icon: MessageCircleMore, title: 'Human Strategists', copy: 'Real career professionals available when you need direction, not just data.', to: null },
] as const

// Homepage Redesign Phase 1 / Task 6: Human Support section. Bullets
// grounded in real strategist-support capabilities (career strategy,
// application feedback, interview prep, negotiation/next-steps) rather than
// invented ones. Per the locked spec (decision #5), no testimonial, no
// star rating, no invented quote -- credibility here comes from describing
// the real capability plainly, backed by LandingPage.test.tsx.
const humanSupportBullets = [
  { icon: Compass, text: 'Career strategy and planning tailored to where you actually want to go.' },
  { icon: PenLine, text: 'Resume and application feedback from a real person, not a generic checklist.' },
  { icon: MessagesSquare, text: 'Interview preparation, so you walk in ready instead of guessing.' },
  { icon: TrendingUp, text: 'Support through offers and negotiation, all the way to your next step.' },
]

// Homepage Redesign Phase 1 / Task 4: "How FreshlyForward Works" -- 5 steps
// grounded in real, currently-shipped (or explicitly Coming Soon) product
// capabilities, per the approved North Star structure. Build/Career Vault
// is marked Coming Soon here too, matching the locked spec decision and the
// Task 4 plan step's explicit instruction to do so wherever it's mentioned.
const howItWorksSteps = [
  { icon: Compass, title: 'Discover', copy: 'Career Compass points you toward roles and directions that actually fit your goals.' },
  { icon: FolderOpen, title: 'Build', copy: 'Career Vault keeps your wins, resume assets, and story organized in one place. Coming Soon.' },
  { icon: Search, title: 'Find', copy: 'The Opportunity Engine surfaces real roles worth your time, not another endless job board.' },
  { icon: Target, title: 'Understand', copy: 'FreshFit scores how well each role actually fits you, so you know where to focus first.' },
  { icon: Rocket, title: 'Move Forward', copy: 'Applications keeps everything moving, with a real human strategist there when you need one.' },
]

// Homepage Redesign Phase 1 / Task 2: three short trust bullets under the
// hero CTAs, replacing the old "Human-led / No mass applying / Pause
// anytime" set now that the hero itself carries the human-led/no-mass-apply
// message in its subcopy -- kept short per the North Star reference.
const heroFeatureBullets = ['Personalized', 'AI-powered career intelligence', 'Human experts']

export function LandingPage() {
  return (
    <main className="callsheet">
      <section className="bg-[var(--navy)] py-14 text-white lg:py-24">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-5xl xl:text-6xl">
              Your Career <span className="text-[#7ee4b6] lg:whitespace-nowrap">Operating System</span> for What's Next.
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

          {/* Homepage Redesign Phase 1 / Task 3 (owner checkpoint round 1):
              FreshFit centerpiece + career-path graphic (path now includes
              node emphasis, glow, upward-flow animation, and the human
              figure composed directly onto it) + floating cards. All
              floating-card content is hand-authored sample/marketing data
              grounded in real capabilities (Opportunity Engine tier
              language, real Dashboard stat categories) -- never live
              member data.

              Visible from `md` up per the owner's requirement that tablet
              keep a simplified version of the graphic rather than hiding it
              entirely -- only mobile collapses to text-only. Each piece
              renders two variants (simplified md-only, full lg+) toggled
              with Tailwind's `md:block lg:hidden` / `hidden lg:block` pairs
              rather than a JS media-query hook, matching this codebase's
              existing responsive-nav pattern. */}
          <div className="relative hidden min-h-[300px] md:block lg:min-h-[420px]">
            <HeroCareerPath simplified className="absolute inset-0 h-full w-full lg:hidden" />
            <HeroCareerPath className="absolute inset-0 hidden h-full w-full lg:block" />

            <div className="reveal mx-auto w-fit lg:hidden" style={{ animationDelay: '.2s' }}>
              <HeroFreshFitCenterpiece size={120} />
            </div>
            <div className="reveal mx-auto hidden w-fit lg:block" style={{ animationDelay: '.2s' }}>
              <HeroFreshFitCenterpiece />
            </div>

            <HeroFloatingCard className="reveal right-0 top-2" style={{ animationDelay: '.35s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Top Opportunity</p>
              <p className="mt-1 text-sm font-semibold text-white">Senior Product Manager</p>
              <p className="text-xs text-[#bac8d6]">92 FreshFit -- Highest Fit</p>
            </HeroFloatingCard>
            <HeroFloatingCard className="reveal left-0 top-32 hidden lg:block" style={{ animationDelay: '.5s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Search Readiness</p>
              <p className="mt-1 text-lg font-bold text-white">78<span className="text-xs font-normal text-[#bac8d6]">/100</span></p>
            </HeroFloatingCard>
            <HeroFloatingCard className="reveal bottom-24 right-4 hidden lg:block" style={{ animationDelay: '.65s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Applications</p>
              <p className="mt-1 text-lg font-bold text-white">6 <span className="text-xs font-normal text-[#bac8d6]">this month</span></p>
            </HeroFloatingCard>
          </div>
        </div>
      </section>

      {/* Homepage Redesign Phase 1 / Task 4: "How FreshlyForward Works".
          Replaces the old Concierge Editorial "manifest" / "concierge
          process" / "service preview" / ForwardFeedWidget / closing-CTA
          sections below the hero -- those told a different product story
          (a white-glove application-submission service) than the approved
          North Star's "Career Operating System" positioning, so this is a
          full replacement of the page below the hero, built out
          section-by-section across Tasks 4-9, not an addition alongside the
          old copy. Sections 4-10 of the approved structure land here in
          later tasks. */}
      <section className="shell py-20" aria-labelledby="how-it-works-title">
        <SectionHeading
          title="How FreshlyForward Works"
          copy="One connected path from where you are now to your next role -- not five disconnected tools."
          id="how-it-works-title"
        />
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {howItWorksSteps.map(({ icon: Icon, title, copy }, index) => (
            <li key={title} className="relative flex flex-col items-center text-center">
              {index < howItWorksSteps.length - 1 && (
                <span className="absolute left-1/2 top-8 hidden h-px w-full bg-[color:var(--color-primary-600)]/25 lg:block" aria-hidden="true" />
              )}
              <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--navy)] text-[#7ee4b6] shadow-[var(--shadow)]">
                <Icon size={26} aria-hidden="true" />
              </span>
              <h3 className="font-display mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{copy}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex justify-center">
          <LinkButton to="/career-compass">
            Start Your Career Journey <ArrowRight size={18} />
          </LinkButton>
        </div>
      </section>

      {/* Homepage Redesign Phase 1 / Task 5: flagship feature showcase +
          supporting capabilities. Flagship cards match the hero's dark
          navy/green treatment; Career Vault's card carries a visible
          "Coming Soon" badge and has no href, matching the locked spec
          decision and the test in LandingPage.test.tsx enforcing it. */}
      <section className="bg-[var(--navy)] py-20 text-white" aria-labelledby="flagship-title">
        <div className="shell">
          <SectionHeading
            title="Powerful tools. One connected system."
            copy="Not six separate apps -- one system where each part makes the others better."
            id="flagship-title"
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {flagshipFeatures.map(({ icon: Icon, title, copy, to, comingSoon }) => {
              const cardClassName = "flex flex-col rounded-[var(--radius)] bg-[var(--navy-soft)] p-8 shadow-[var(--shadow)] transition hover:bg-[color-mix(in_srgb,var(--navy-soft),white_6%)]"
              const inner = (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-[#7ee4b6]">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <div className="mt-4 flex items-center gap-2">
                    <h3 className="font-display text-xl font-semibold">{title}</h3>
                    {comingSoon && (
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#bac8d6]">Coming Soon</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#bac8d6]">{copy}</p>
                </>
              )
              return to ? (
                <Link key={title} to={to} className={cardClassName}>{inner}</Link>
              ) : (
                <div key={title} className={cardClassName}>{inner}</div>
              )
            })}
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {supportingCapabilities.map(({ icon: Icon, title, copy, to }) => {
              const cardClassName = "rounded-[var(--radius)] border border-white/10 p-6"
              const inner = (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[#7ee4b6]">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <h4 className="font-display mt-3 text-base font-semibold">{title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#bac8d6]">{copy}</p>
                </>
              )
              return to ? (
                <Link key={title} to={to} className={`${cardClassName} block transition hover:border-white/25`}>{inner}</Link>
              ) : (
                <div key={title} className={cardClassName}>{inner}</div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Homepage Redesign Phase 1 / Task 6: Human Support section --
          warmer visual treatment (cream background, matching this
          codebase's existing --cream token) contrasting with the navy
          sections above/below. Real founder photo (also used on AboutPage),
          not a stock scene. No testimonial, no star rating -- see the
          Task 6 tests in LandingPage.test.tsx. */}
      <section className="bg-[var(--cream)] py-20" aria-labelledby="human-support-title">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <div>
            <img
              src="/images/headshot.png?v=2"
              alt="Mike Bailey, founder of FreshlyForward"
              className="w-full max-w-md rounded-[var(--radius)] object-cover shadow-[var(--shadow)]"
            />
          </div>
          <div>
            <SectionHeading
              title="Technology gets you the data. A person helps you use it."
              copy="Every FreshlyForward plan includes real human support -- not a chatbot, not a template."
              id="human-support-title"
            />
            <ul className="mt-8 space-y-5">
              {humanSupportBullets.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--color-primary-600)] shadow-[var(--shadow)]">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <p className="text-neutral-700">{text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <LinkButton to="/why-freshlyforward" variant="secondary">
                See How Human Support Works <ArrowRight size={18} />
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Homepage Redesign Phase 1 / Task 7: "Why FreshlyForward?" node-graph
          comparison -- a genuine attempt at the reference image's tangled-
          vs-connected illustration style using NodeGraph (see that
          component for why a faithful attempt was chosen over a plain
          checklist). */}
      <section className="shell py-20" aria-labelledby="why-title">
        <SectionHeading
          title="One connected system for your entire career move."
          copy="Traditional job searching means juggling disconnected tools. FreshlyForward connects every piece."
          id="why-title"
          centered
        />
        <div className="relative mt-12 grid gap-16 md:grid-cols-2 md:gap-8">
          <div>
            <h3 className="text-center font-display text-lg font-semibold text-neutral-500">Traditional Job Search</h3>
            <NodeGraph nodes={traditionalNodes} tangled />
          </div>
          <div>
            <h3 className="text-center font-display text-lg font-semibold text-[color:var(--color-primary-600)]">FreshlyForward</h3>
            <NodeGraph nodes={connectedNodes} tangled={false} />
          </div>
          <span
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow)] md:flex"
            aria-hidden="true"
          >
            VS
          </span>
        </div>
      </section>
    </main>
  )
}
