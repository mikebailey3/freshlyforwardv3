import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'

export function CareerVaultTeaserCard() {
  return (
    <Link
      to="/career-vault"
      className="block border border-border bg-surface-card p-4 transition-colors hover:border-primary-400"
    >
      <div className="flex items-center gap-3">
        <Trophy className="h-5 w-5 flex-shrink-0 text-primary-400" />
        <div>
          <p className="font-serif text-sm font-semibold text-ink">Career Vault</p>
          <p className="text-xs text-ink-muted">Log a Career Win to add real evidence to your Forward DNA.</p>
        </div>
      </div>
    </Link>
  )
}
