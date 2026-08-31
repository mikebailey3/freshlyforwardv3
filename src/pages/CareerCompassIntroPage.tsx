import { Compass, ListChecks, ShieldCheck, Timer } from 'lucide-react'
import { LinkButton } from '@/components/ui'

export function CareerCompassIntroPage() {
  return (
    <main>
      <section className="page-hero shell">
        <div>
          <p className="eyebrow">Free career assessment</p>
          <h1>Find out what kind of career move actually fits you.</h1>
          <p>
            Career Compass is a free, two-part assessment that maps how you work and how ready
            you are to make a move — no signup required, and your results are shown to you
            immediately.
          </p>
        </div>
        <div className="page-hero-mark" aria-hidden="true">
          <Compass />
        </div>
      </section>

      <section className="authorization-grid shell">
        <article>
          <ListChecks />
          <div>
            <h2>Part 1: Career Archetype</h2>
            <p>
              24 quick questions uncover how you naturally work best — whether you're a driver,
              connector, strategist, builder, explorer, or creator.
            </p>
          </div>
        </article>
        <article>
          <Timer />
          <div>
            <h2>Part 2: Forward Readiness</h2>
            <p>
              9 more questions gauge how ready your search is today, and where the biggest
              opportunity to move faster is hiding.
            </p>
          </div>
        </article>
        <article>
          <ShieldCheck />
          <div>
            <h2>Free, fast, and yours to keep</h2>
            <p>
              It takes about 5 minutes. No account, no credit card, and no obligation — your
              results are yours to see the moment you finish.
            </p>
          </div>
        </article>
      </section>

      <section className="small-cta shell">
        <div>
          <h2>Ready to see where you stand?</h2>
          <p>Two short parts, five minutes, results shown immediately.</p>
        </div>
        <LinkButton to="/career-compass/assessment">Start the assessment</LinkButton>
      </section>
    </main>
  )
}
