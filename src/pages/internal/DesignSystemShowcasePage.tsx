import { useState } from 'react'
import {
  Card,
  CTAButton,
  DataRow,
  EmptyState,
  FilterChip,
  ProgressBar,
  SecondaryButton,
  SectionEyebrow,
  SectionHeader,
  Tabs,
} from '@/components/ui'

export function DesignSystemShowcasePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [activeFilter, setActiveFilter] = useState('remote')

  return (
    <div className="min-h-screen bg-bg px-6 py-12 text-ink">
      <div className="mx-auto max-w-5xl space-y-16">
        <header>
          <SectionEyebrow>Internal — Visual QA Only</SectionEyebrow>
          <h1 className="text-display font-display text-ink">Design System Foundation</h1>
          <p className="mt-3 max-w-2xl text-body text-ink-muted">
            Every foundational primitive from Sub-Project 1, shown with realistic FreshlyForward
            content at desktop and mobile widths. Not linked from any public navigation.
          </p>
        </header>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Surfaces</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-bg p-6 text-center text-sm text-ink-muted ring-1 ring-border">bg-bg</div>
            <div className="rounded-xl bg-surface-elevated p-6 text-center text-sm text-ink-muted">bg-surface-elevated</div>
            <div className="rounded-xl bg-surface-card p-6 text-center text-sm text-ink-muted">bg-surface-card</div>
            <div className="rounded-xl bg-surface-subtle p-6 text-center text-sm text-ink-muted">bg-surface-subtle</div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Typography</h2>
          <SectionHeader
            eyebrow="Opportunity Intelligence"
            title="Your FreshFit for Regional Account Manager is 86"
            description="Strong alignment on leadership scope and compensation. One gap worth addressing before you apply."
          />
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <CTAButton>Take Career Compass</CTAButton>
            <SecondaryButton>See How It Works</SecondaryButton>
            <CTAButton disabled>Submitting…</CTAButton>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Cards</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-sm font-semibold text-ink">Regional Account Manager</p>
              <p className="mt-1 text-sm text-ink-muted">Kellanova · Chicago, IL · FreshFit 86</p>
            </Card>
            <Card>
              <p className="text-sm font-semibold text-ink">Strengthen your leadership accomplishments</p>
              <p className="mt-1 text-sm text-ink-muted">One targeted edit to your Forward Profile could raise your fit on similar roles.</p>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Progress</h2>
          <div className="max-w-sm space-y-4">
            <ProgressBar value={86} label="FreshFit — Regional Account Manager" />
            <ProgressBar value={62} label="Forward Profile completeness" />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Tabs</h2>
          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'applications', label: 'Applications' },
              { id: 'compass', label: 'Career Compass' },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Filter chips</h2>
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Remote" active={activeFilter === 'remote'} onClick={() => setActiveFilter('remote')} />
            <FilterChip label="Hybrid" active={activeFilter === 'hybrid'} onClick={() => setActiveFilter('hybrid')} />
            <FilterChip label="On-site" active={activeFilter === 'onsite'} onClick={() => setActiveFilter('onsite')} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Data rows</h2>
          <Card padded={false} className="divide-y divide-border px-6">
            <DataRow label="FreshFit score" value="86" />
            <DataRow label="Compensation fit" value="Strong" />
            <DataRow label="Seniority fit" value="On target" />
          </Card>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Empty, loading, and error states</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <EmptyState
              title="No applications yet"
              description="Submit a job and your strategist will follow up within one business day."
              action={<CTAButton>Submit a job</CTAButton>}
            />
            <div className="flex items-center justify-center rounded-2xl border border-border bg-surface-subtle p-12 text-sm text-ink-muted">
              Loading your Opportunity Engine…
            </div>
            <div className="rounded-2xl border border-error-700 bg-surface-subtle p-6 text-sm text-error-300">
              We couldn&apos;t refresh your FreshFit scores. Try again in a moment.
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Navigation states</h2>
          <nav className="flex gap-1 rounded-xl bg-surface-elevated p-1.5">
            <span className="rounded-lg bg-surface-card px-4 py-2 text-sm font-semibold text-ink">Dashboard</span>
            <span className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:text-ink">Opportunity Engine</span>
            <span className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:text-ink">Forward Profile</span>
          </nav>
        </section>
      </div>
    </div>
  )
}
