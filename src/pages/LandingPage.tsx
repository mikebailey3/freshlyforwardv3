import type { ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, Award, Check, Compass, FileStack, FileText, FolderOpen, HelpCircle, LayoutGrid, Link2, MessageCircleMore, MessageCircleOff, MessagesSquare, PenLine, PlayCircle, Rocket, Search, Target, TrendingUp, User, UserX, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LinkButton, SectionHeading } from '@/components/ui'
import { HeroFreshFitCenterpiece } from '@/components/homepage/HeroFreshFitCenterpiece'
import { HeroFloatingCard } from '@/components/homepage/HeroFloatingCard'
import { HeroCareerPath, desktopJourneyNodes, tabletJourneyNodes } from '@/components/homepage/HeroCareerPath'
import { HeroMobileJourney } from '@/components/homepage/HeroMobileJourney'
import { NodeGraph, type GraphNode } from '@/components/homepage/NodeGraph'
import { PricingTeaser } from '@/components/homepage/PricingTeaser'
import { CareerCompassRadar } from '@/components/homepage/CareerCompassRadar'
import { ApplicationsStatusPreview } from '@/components/homepage/ApplicationsStatusPreview'
import { FlagshipOpportunityPreview } from '@/components/homepage/FlagshipOpportunityPreview'
import { FlagshipFreshFitPreview } from '@/components/homepage/FlagshipFreshFitPreview'
import { FlagshipVaultPreview } from '@/components/homepage/FlagshipVaultPreview'
import { HowItWorksConnector } from '@/components/homepage/HowItWorksConnector'
import { FooterCareerPath } from '@/components/homepage/FooterCareerPath'

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

// Homepage Redesign Phase 1 / Task 5 (extended for North Star fidelity):
// flagship feature showcase. Career Vault is included per the locked spec
// decision (kept in the flagship slot, clearly "Coming Soon", no
// route/link) rather than substituted with Achievement Vault or omitted.
// Each card now carries a `preview` -- a miniature, product-realistic UI
// matching the North Star reference's density (see the individual preview
// components for exactly what real data/fields ground each one).
const flagshipFeatures: { icon: typeof Search; title: string; copy: string; to: string | null; comingSoon: boolean; preview: ReactNode }[] = [
  {
    icon: Search,
    title: 'Opportunity Engine',
    copy: 'Real roles, ranked by fit -- not another feed to scroll through by hand.',
    to: '/opportunity-engine',
    comingSoon: false,
    preview: <FlagshipOpportunityPreview />,
  },
  {
    icon: Target,
    title: 'FreshFit',
    copy: 'A directional fit score for every role, so you know which ones deserve your time first.',
    to: '/opportunity-engine',
    comingSoon: false,
    preview: <FlagshipFreshFitPreview />,
  },
  {
    icon: FolderOpen,
    title: 'Career Vault',
    copy: 'Your resume versions, wins, and career story, organized in one place.',
    to: null,
    comingSoon: true,
    preview: <FlagshipVaultPreview />,
  },
]

// Supporting capabilities. Human Strategists intentionally stays brief here
// -- Task 6's Human Support section carries the fuller treatment, this card
// just establishes it exists as a real capability alongside the other two.
// `visual` adds the North Star's small illustrative graphic per card.
const supportingCapabilities: { icon: typeof Compass; title: string; copy: string; to: string | null; visual: ReactNode }[] = [
  {
    icon: Compass,
    title: 'Career Compass',
    copy: 'A short assessment that points you toward directions worth pursuing.',
    to: '/career-compass',
    visual: <CareerCompassRadar />,
  },
  {
    icon: FileText,
    title: 'Applications',
    copy: 'Every application you send, tracked in one place -- no spreadsheets required.',
    to: '/applications',
    visual: <ApplicationsStatusPreview />,
  },
  {
    icon: MessageCircleMore,
    title: 'Human Strategists',
    copy: 'Real career professionals available when you need direction, not just data.',
    to: null,
    visual: (
      <img
        src="/images/headshot.png?v=2"
        alt=""
        aria-hidden="true"
        className="mt-3 h-16 w-16 rounded-full object-cover ring-2 ring-white/20"
      />
    ),
  },
]

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

// Homepage Redesign Phase 1 / Task 9 (extended for North Star fidelity):
// FAQ teaser -- 6 of the 8 real questions from FaqPage.tsx verbatim (same
// source of truth, no rewritten or invented answers), chosen for relevance
// to a first-time visitor, split into two columns to match the reference's
// density (see the .faq-list wrapper markup below for how the counter
// numbering stays correct across both columns).
const faqTeaserQuestions: [string, string][] = [
  ['Is FreshlyForward an AI application service?', 'No. FreshlyForward is a human-led career concierge. Technology may support organization and research, but people select opportunities, shape strategy, craft materials, and remain accountable for the work.'],
  ['Do you apply without my permission?', 'No. Your application authorization is documented before applications begin, and you can update or withdraw it. We also follow the role preferences and boundaries established with your strategist.'],
  ['Can you guarantee I get hired?', 'No ethical service can guarantee a hiring outcome. FreshlyForward provides the strategy, execution, preparation, and support that help you run a stronger search.'],
  ['Can I pause or cancel?', 'Yes. Concierge service has no long-term contract and can be paused before the next monthly renewal.'],
  ['Do you help with interviews?', 'Yes. Interview preparation can include role research, answer development, mock interviews, feedback, follow-up strategy, and offer decision support.'],
  ['Who is this service best for?', 'FreshlyForward is designed for busy professionals, career changers, people returning to work, and job seekers who want a more personal and accountable search partner.'],
]

// Homepage Redesign Phase 1 / North Star fidelity pass: itemized lists for
// the "Why FreshlyForward?" comparison, alongside the existing node graphs
// (kept, not discarded -- see NodeGraph.tsx). Every FreshlyForward item
// names a real capability already referenced elsewhere on this page;
// nothing on the traditional side names a real competitor or product.
const traditionalJobSearchItems = [
  'Endless job boards',
  'Generic resume templates',
  'Spreadsheets and scattered notes',
  'No fit signal before you apply',
  "You're on your own",
]

const freshlyForwardItems = [
  'Career Compass for direction',
  'Opportunity Engine for discovery',
  'FreshFit for fit intelligence',
  'Applications for execution',
  'Human strategists when you need them',
]

export function LandingPage() {
  return (
    <main className="callsheet">
      <section className="relative bg-[var(--navy)] py-14 text-white lg:py-24">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="font-hero-sans text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-5xl xl:text-6xl">
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
            <HeroMobileJourney />
          </div>

          {/* Homepage Hero Redesign round 6: FOCUSED literal fidelity
              rebuild against the North Star reference
              (public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png).
              The owner called round 5's result a "wireframe/constellation"
              despite the density/position improvements -- the card
              treatment (translucent color-mix pills, see the pre-round-6
              HeroFloatingCard.tsx) and the dashed card-to-card connector
              network both read as diagram chrome instead of a polished
              product composition. Round 6 fixes both:

              1. Cards are now solid, opaque `--navy-soft` surfaces with a
                 real border and shadow (see HeroFloatingCard.tsx) instead
                 of a partial white-mix that let the background bleed
                 through -- "finished card," not "outline pill."
              2. The dashed connector-stub network is gone entirely. There
                 is now exactly ONE path: a 6-point Catmull-Rom spline
                 (HeroCareerPath.tsx) with visible intermediate milestone
                 dots and an arrowhead at the end, matching the reference's
                 single winding glowing journey line instead of a network
                 diagram.
              3. Card count grew from 7 to the reference's 8 -- Top
                 Opportunity, Career Vault, Search Readiness, Skill Gap,
                 Goal Progress, Applications, Next Milestone, and
                 Strategist Support -- each at the reference's own measured
                 slot (see `desktopJourneyNodes` in HeroCareerPath.tsx).
                 Top Opportunity, Career Vault, and Applications are the 3
                 larger "anchor" cards; the other 5 use a smaller/quieter
                 treatment.
              4. Career Vault is back with an illustrative "23 Assets"
                 count (the owner explicitly authorized this style this
                 round, on the condition it's always paired with a visible
                 "Coming Soon" tag on the same card and never links to
                 /career-vault -- see the regression test in
                 LandingPage.test.tsx and the `data-testid` below it relies
                 on). Strategist Support stays a generic icon avatar, never
                 a named/"online" real person, per this codebase's existing
                 anti-fabrication convention.
              5. The walking figure's SVG scale grew again (0.22 -> 0.24)
                 and the ring grew slightly (260 -> 280) per the owner's
                 "should feel embedded, not isolated" note.

              Tablet gets only the minimum touch needed to avoid a
              regression from the HeroCareerPath.tsx rewrite (this round is
              explicitly desktop-fidelity-first); mobile
              (HeroMobileJourney.tsx) is untouched.

              Round 8 (bounded visual-refinement pass, geometry/positions
              unchanged): per-card copy tightened toward the reference's
              own hierarchy -- Top Opportunity now shows an illustrative
              salary range instead of vague text (still no real employer),
              Applications became "Application in Review" with a real
              stage line, Next Milestone lost its repeated "Illustrative"
              prefix, Search Readiness and Goal Progress now lead with a
              large focal number instead of an inline "/100" fraction, and
              Strategist Support warmed up to "Your strategist is here"
              with a larger avatar. The repeated per-card "Illustrative"
              wording is now ONE small dashboard-level "Illustrative
              preview" tag (bottom-left of the composition) instead of
              cluttering every card -- see HeroFloatingCard.tsx for the
              deeper card-surface pass and HeroCareerPath.tsx for the path/
              glow refinement, both from this same round. */}
          <div className="relative hidden md:block md:min-h-[380px] lg:min-h-[640px]">
            <HeroCareerPath simplified className="absolute inset-0 h-full w-full lg:hidden" />
            <HeroCareerPath className="absolute inset-0 hidden h-full w-full lg:block" />

            <div
              className="reveal absolute z-10 -translate-x-1/2 -translate-y-1/2 lg:hidden"
              style={{ left: `${tabletJourneyNodes.freshFit.x}%`, top: `${tabletJourneyNodes.freshFit.y}%`, animationDelay: '.2s' }}
            >
              <HeroFreshFitCenterpiece size={200} />
            </div>
            <div
              className="reveal absolute z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:block"
              style={{ left: `${desktopJourneyNodes.freshFit.x}%`, top: `${desktopJourneyNodes.freshFit.y}%`, animationDelay: '.2s' }}
            >
              <HeroFreshFitCenterpiece size={280} />
            </div>

            {/* Tablet: 3 cards, kept from the prior round with terminology
                updated to match the new 8-card set (Career Vault replaces
                the round-5-only "Career Direction" concept, which no
                longer exists on desktop either) -- minimum touch per this
                round's desktop-first scope. */}
            <HeroFloatingCard className="reveal z-10 lg:hidden" style={{ left: '58%', top: '4%', animationDelay: '.35s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Top Opportunity</p>
              <p className="mt-1 text-sm font-semibold text-white">Senior Product Manager</p>
            </HeroFloatingCard>
            <HeroFloatingCard className="reveal z-10 lg:hidden" style={{ left: '2%', top: '30%', animationDelay: '.45s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Career Vault</p>
              <p className="mt-1 text-sm font-semibold text-white">23 Assets</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#bac8d6]">Coming Soon</p>
            </HeroFloatingCard>
            <HeroFloatingCard className="reveal z-10 lg:hidden" style={{ left: '58%', top: '72%', animationDelay: '.5s' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Search Readiness</p>
              <p className="mt-1 text-lg font-bold text-white">78<span className="text-xs font-normal text-[#bac8d6]">/100</span></p>
            </HeroFloatingCard>

            {/* Desktop: 8 cards at the reference's own measured layout
                slots. Top Opportunity, Career Vault, and Applications are
                the 3 larger anchor cards; the other 5 use a smaller/
                quieter treatment. */}
            <HeroFloatingCard
              className="reveal z-10 hidden lg:block"
              style={{ left: `${desktopJourneyNodes.topOpportunity.x}%`, top: `${desktopJourneyNodes.topOpportunity.y}%`, animationDelay: '.35s' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Top Opportunity</p>
              <p className="mt-1 text-sm font-semibold text-white">Senior Product Manager</p>
              <p className="mt-1 text-xs text-[#bac8d6]">$120K-$130K -- Remote</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#7ee4b6]/15 px-2 py-0.5 text-[9px] font-bold text-[#7ee4b6]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7ee4b6]" aria-hidden="true" /> 89 FreshFit
              </span>
            </HeroFloatingCard>
            <HeroFloatingCard
              data-testid="hero-career-vault-card"
              className="reveal z-10 hidden lg:block"
              style={{ left: `${desktopJourneyNodes.careerVault.x}%`, top: `${desktopJourneyNodes.careerVault.y}%`, animationDelay: '.4s' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Career Vault</p>
              <p className="mt-1 text-lg font-bold text-white">23 Assets</p>
              <span className="mt-1.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#bac8d6]">Coming Soon</span>
              <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7ee4b6]/15 text-[#7ee4b6]"><FileText size={11} /></span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5b8cb8]/25 text-[#a8c8e8]"><PenLine size={11} /></span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e4c07e]/20 text-[#e4c07e]"><Award size={11} /></span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[#bac8d6]"><Link2 size={11} /></span>
              </div>
            </HeroFloatingCard>
            <HeroFloatingCard
              className="reveal z-10 hidden !px-3.5 !py-2.5 lg:block"
              style={{ left: `${desktopJourneyNodes.searchReadiness.x}%`, top: `${desktopJourneyNodes.searchReadiness.y}%`, animationDelay: '.45s' }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Search Readiness</p>
              <p className="mt-0.5 text-xl font-bold text-white">78</p>
              <p className="text-[10px] text-[#bac8d6]">Good</p>
              <div className="mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[78%] rounded-full bg-[#7ee4b6]" />
              </div>
            </HeroFloatingCard>
            <HeroFloatingCard
              className="reveal z-10 hidden !px-3.5 !py-2.5 lg:block"
              style={{ left: `${desktopJourneyNodes.skillGap.x}%`, top: `${desktopJourneyNodes.skillGap.y}%`, animationDelay: '.5s' }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Skill Gap</p>
              <p className="mt-0.5 text-xl font-bold text-white">3</p>
              <p className="text-[10px] text-[#bac8d6]">Focus areas</p>
            </HeroFloatingCard>
            <HeroFloatingCard
              className="reveal z-10 hidden !px-3.5 !py-2.5 lg:block"
              style={{ left: `${desktopJourneyNodes.goalProgress.x}%`, top: `${desktopJourneyNodes.goalProgress.y}%`, animationDelay: '.55s' }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Goal Progress</p>
              <p className="mt-0.5 text-xl font-bold text-[#7ee4b6]">75%</p>
              <p className="text-[10px] text-[#bac8d6]">On track</p>
              <div className="mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[75%] rounded-full bg-[#7ee4b6]" />
              </div>
            </HeroFloatingCard>
            <HeroFloatingCard
              className="reveal z-10 hidden lg:block"
              style={{ left: `${desktopJourneyNodes.applications.x}%`, top: `${desktopJourneyNodes.applications.y}%`, animationDelay: '.6s' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Application in Review</p>
              <p className="mt-1 text-sm font-semibold text-white">Product Manager</p>
              <p className="text-xs text-[#bac8d6]">Interview &middot; Round 2</p>
            </HeroFloatingCard>
            <HeroFloatingCard
              className="reveal z-10 hidden !px-3.5 !py-2.5 lg:block"
              style={{ left: `${desktopJourneyNodes.nextMilestone.x}%`, top: `${desktopJourneyNodes.nextMilestone.y}%`, animationDelay: '.63s' }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Next Milestone</p>
              <p className="mt-0.5 text-xs font-semibold text-white">Interview Practice</p>
              <p className="text-[10px] text-[#bac8d6]">Today &middot; 2:00 PM</p>
            </HeroFloatingCard>
            <HeroFloatingCard
              className="reveal z-10 hidden !px-3.5 !py-2.5 lg:flex lg:items-center lg:gap-2"
              style={{ left: `${desktopJourneyNodes.strategistSupport.x}%`, top: `${desktopJourneyNodes.strategistSupport.y}%`, animationDelay: '.65s' }}
            >
              <span className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#7ee4b6]/15 ring-1 ring-[#7ee4b6]/25">
                <User size={13} className="text-[#7ee4b6]" aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#7ee4b6] ring-2 ring-[var(--navy-soft)]" aria-hidden="true" />
              </span>
              <span>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Strategist Support</p>
                <p className="text-[10px] text-[#bac8d6]">Your strategist is here</p>
              </span>
            </HeroFloatingCard>

            {/* Hero fidelity round 8: ONE dashboard-level truth label
                instead of repeating "Illustrative" inside every individual
                card (which cluttered the North Star-style card copy and
                didn't match the reference's cleaner card text). This single
                small, muted tag covers the whole composition's
                truthfulness the same way the flagship preview cards
                further down the page use their own "Sample" captions --
                visible enough to read, deliberately secondary in weight/
                position so it doesn't compete with the dashboard itself.
                Anchored bottom-right (not bottom-left) -- that's the one
                pocket of the composition with no card or path geometry
                nearby, so it can't visually collide with Goal Progress or
                the figure. */}
            <div
              className="reveal absolute bottom-2 right-2 z-10 flex items-center gap-1.5 lg:bottom-3 lg:right-3"
              style={{ animationDelay: '.7s' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#7ee4b6]/50" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-wide text-[#bac8d6]/70">Illustrative preview</span>
            </div>
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
      <section className="shell py-14" aria-labelledby="how-it-works-title">
        <SectionHeading
          title="How FreshlyForward Works"
          copy="One connected path from where you are now to your next role -- not five disconnected tools."
          id="how-it-works-title"
        />
        <ol className="relative mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <HowItWorksConnector className="pointer-events-none absolute left-0 top-3 hidden h-8 w-full text-[color:var(--color-primary-600)]/25 lg:block" />
          {howItWorksSteps.map(({ icon: Icon, title, copy }, index) => (
            <li key={title} className="relative flex flex-col items-center text-center">
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--navy)] text-[#7ee4b6] shadow-[var(--shadow)]">
                <Icon size={22} aria-hidden="true" />
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-primary-600)] text-xs font-bold text-white ring-2 ring-white">
                  {index + 1}
                </span>
              </span>
              <h3 className="font-display mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{copy}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex justify-center">
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
      <section className="bg-[var(--cream)] py-20" aria-labelledby="flagship-title">
        <div className="shell">
          <SectionHeading
            title="Powerful tools. One connected system."
            copy="Not six separate apps -- one system where each part makes the others better."
            id="flagship-title"
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {flagshipFeatures.map(({ icon: Icon, title, copy, to, comingSoon, preview }) => {
              const cardClassName = "flex flex-col rounded-[var(--radius)] bg-[var(--navy-soft)] p-8 shadow-xl shadow-black/20 ring-1 ring-white/5 transition hover:bg-[color-mix(in_srgb,var(--navy-soft),white_6%)]"
              const inner = (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-[#7ee4b6]">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <div className="mt-4 flex items-center gap-2">
                    <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
                    {comingSoon && (
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#bac8d6]">Coming Soon</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#bac8d6]">{copy}</p>
                  {preview}
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
            {supportingCapabilities.map(({ icon: Icon, title, copy, to, visual }) => {
              const cardClassName = "rounded-[var(--radius)] border border-white/10 bg-[var(--navy-soft)] p-6 shadow-lg shadow-black/10 text-white"
              const inner = (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[#7ee4b6]">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <h4 className="font-display mt-3 text-base font-semibold text-white">{title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#bac8d6]">{copy}</p>
                  {visual}
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
          <div className="relative lg:ml-auto lg:max-w-md">
            <img
              src="/images/headshot.png?v=2"
              alt="Mike Bailey, founder of FreshlyForward"
              className="w-full max-w-md rounded-[var(--radius)] object-cover shadow-[var(--shadow)]"
            />
            {/* Truthful overlay card in place of the North Star's fabricated
                testimonial -- same geometry/overlap treatment, honest content.
                Smaller negative offset on mobile (where .shell's own outer
                margin is only 12-14px) so the card can't bleed past the
                viewport edge; the wrapper above now shares the image's own
                max-width so the offset anchors to the photo's real corner
                instead of drifting in unused grid-column space. */}
            <div className="absolute -bottom-3 -left-3 max-w-[240px] rounded-[var(--radius)] bg-white p-5 shadow-xl sm:-bottom-6 sm:-left-6">
              <p className="text-sm font-semibold text-[var(--navy)]">Human strategist support</p>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                A real person -- not a chatbot -- available whenever you need direction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Homepage Redesign Phase 1 / Task 7 (extended for North Star
          fidelity): "Why FreshlyForward?" comparison. Switched to a navy
          section per the reference, with an itemized red-X / green-check
          list layered above the existing node-graph illustration -- the
          graph is retained as the decorative comparison graphic (per
          explicit instruction not to discard it), not replaced by the
          list. Every FreshlyForward item names a real capability already
          referenced elsewhere on this page; nothing on the traditional
          side names a real competitor or product. Heading text color
          comes from the inner navy panel's `text-white` (moved off the
          section itself so the outer section can go light per the North
          Star fidelity pass), same inherited-color pattern the flagship
          section above already relies on. */}
      <section className="bg-[var(--cream)] py-20" aria-labelledby="why-title">
        <div className="shell">
          <div className="rounded-[calc(var(--radius)*1.5)] bg-[var(--navy)] px-6 py-14 text-white sm:px-10">
          <SectionHeading
            title="One connected system for your entire career move."
            copy="Traditional job searching means juggling disconnected tools. FreshlyForward connects every piece."
            id="why-title"
            centered
          />
          <div className="relative mt-12 grid gap-10 md:grid-cols-2 md:gap-8">
            <div className="rounded-[var(--radius)] bg-[var(--navy-soft)] p-6 shadow-xl shadow-black/20">
              <h3 className="text-center font-display text-lg font-semibold text-[#bac8d6]">Traditional Job Search</h3>
              <ul className="mt-5 space-y-2.5">
                {traditionalJobSearchItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-[#bac8d6]">
                    <X size={16} className="mt-0.5 flex-shrink-0 text-red-400" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <NodeGraph nodes={traditionalNodes} tangled />
            </div>
            <div className="rounded-[var(--radius)] bg-[var(--navy-soft)] p-6 shadow-xl shadow-black/20">
              <h3 className="text-center font-display text-lg font-semibold text-[#7ee4b6]">FreshlyForward</h3>
              <ul className="mt-5 space-y-2.5">
                {freshlyForwardItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white">
                    <Check size={16} className="mt-0.5 flex-shrink-0 text-[#7ee4b6]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <NodeGraph nodes={connectedNodes} tangled={false} />
            </div>
            <span
              className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--color-primary-600)] px-4 py-2 text-sm font-bold text-white shadow-xl md:flex"
              aria-hidden="true"
            >
              VS
            </span>
          </div>
          </div>
        </div>
      </section>

      {/* Homepage Redesign Phase 1 / Task 8: Pricing section -- real
          membership_plans data only, via PricingTeaser (see that component
          for why it duplicates PricingPage's fetch rather than sharing a
          new hook). */}
      <PricingTeaser />

      {/* Homepage Redesign Phase 1 / Task 9 (extended for North Star
          fidelity): FAQ teaser, reusing FaqPage's existing .faq-list
          accordion styling (Q.01 counter, + toggle) so this doesn't invent
          a second FAQ visual language. Split into two plain-div columns
          (not a CSS grid auto-flow) so the counter -- which increments in
          DOM source order regardless of visual position -- numbers
          question 1-3 down the left column, then 4-6 down the right,
          matching the reference's two-column reading order. */}
      <section className="home-faq faq-list shell" aria-labelledby="faq-title">
        <SectionHeading eyebrow="Straightforward by design" title="Frequently asked questions" id="faq-title" />
        <div className="md:grid md:grid-cols-2 md:gap-x-10">
          <div>
            {faqTeaserQuestions.slice(0, 3).map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary>{question}<span>+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
          <div>
            {faqTeaserQuestions.slice(3).map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<span>+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <LinkButton to="/faq" variant="secondary">See all FAQs</LinkButton>
        </div>
      </section>

      {/* Homepage Redesign Phase 1 / Task 9, corrected during the North
          Star fidelity pass: Final CTA band. The approved spec's structure
          section (docs/superpowers/specs/2026-09-02-homepage-design-north-
          star.md) locks this exact headline and both CTA labels --
          "Your next move starts here." / "Take Career Compass" / "See How
          It Works" -- so this now matches that verbatim instead of the
          drifted copy from the original Task 9 pass. Below the CTAs, a
          multi-milestone journey recap echoes the hero's career-path/glow
          language without duplicating its composition (no ring, no walking
          figure, no floating cards) -- reuses the exact same 5 truthful
          stage names from howItWorksSteps above (single source of truth,
          not a second invented label set) so the closing moment reads as
          "here's the path you just read about, and where it leads," not a
          new claim. Final stop intentionally reads "Move Forward," not an
          outcome/guarantee word like "Offers." */}
      <section className="relative overflow-hidden bg-[var(--navy)] py-20 text-center text-white" aria-labelledby="final-cta-title">
        <div className="shell relative">
          <h2 id="final-cta-title" className="font-display text-3xl font-semibold sm:text-4xl">Your next move starts here.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#bac8d6]">Get clarity, discover better-fit opportunities, track your search, and move forward with a connected system built around you.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton to="/career-compass">
              Take Career Compass <ArrowRight size={18} />
            </LinkButton>
            <LinkButton to="/how-it-works" variant="secondary">
              <PlayCircle size={18} /> See How It Works
            </LinkButton>
          </div>

          <div className="mx-auto mt-14 flex max-w-3xl items-center justify-center gap-3">
            <div className="relative flex-1">
              <FooterCareerPath className="pointer-events-none absolute inset-x-0 top-0 hidden h-3 w-full lg:block" />
              <ol className="relative grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-2">
                {howItWorksSteps.map(({ title }, index) => {
                  const isFinal = index === howItWorksSteps.length - 1
                  return (
                    <li key={title} className="flex flex-col items-center gap-2">
                      {/* h-3 w-3 must stay in sync with FooterCareerPath's
                          own wrapper height (also h-3) -- that's what makes
                          the connecting line pass through these dots
                          instead of floating above/below them. See the
                          alignment note in FooterCareerPath.tsx. */}
                      <span
                        className={`h-3 w-3 rounded-full ring-4 ring-[var(--navy)] ${isFinal ? 'bg-[#7ee4b6]' : 'bg-[#7ee4b6]/50'}`}
                        aria-hidden="true"
                      />
                      <span className={`text-xs font-semibold uppercase tracking-wide ${isFinal ? 'text-[#7ee4b6]' : 'text-[#bac8d6]'}`}>
                        {title}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
            {/* Small closing flourish echoing the hero's forward-momentum
                arrow motif -- a real icon, not hand-drawn SVG coordinates,
                so there's no viewBox-clipping risk. Hidden below lg since
                the row wraps to 2/3 columns there and this reads oddly
                floating outside a wrapped grid. */}
            <ArrowUpRight className="hidden shrink-0 self-start text-[#7ee4b6] lg:block" size={20} aria-hidden="true" />
          </div>
        </div>
      </section>
    </main>
  )
}
