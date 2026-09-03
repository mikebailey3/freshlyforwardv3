import { ArrowRight, Check, Compass, FolderOpen, PlayCircle, Rocket, Search, Target } from 'lucide-react'
import { LinkButton, SectionHeading } from '@/components/ui'
import { HeroFreshFitCenterpiece } from '@/components/homepage/HeroFreshFitCenterpiece'
import { HeroFloatingCard } from '@/components/homepage/HeroFloatingCard'
import { HeroCareerPath } from '@/components/homepage/HeroCareerPath'

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
    </main>
  )
}
