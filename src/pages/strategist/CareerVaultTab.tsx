import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getCareerWinsWithCapabilities, type CareerWinWithCapabilities } from '@/lib/careerVault/careerWins'
import { CareerWinCard } from '@/components/careerVault/CareerWinCard'

interface CareerVaultTabProps {
  memberId: string
}

/**
 * Read-only, full stop. Never passes onDelete to CareerWinCard --
 * strategists and admins can view a member's Career Vault evidence but
 * can never edit or delete it (spec section 11). The RLS SELECT policy
 * from the migration enforces this server-side too; this component
 * additionally never renders a control that could attempt it.
 */
export function CareerVaultTab({ memberId }: CareerVaultTabProps) {
  const [careerWins, setCareerWins] = useState<CareerWinWithCapabilities[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getCareerWinsWithCapabilities(memberId).then(({ careerWins: wins }) => {
      if (cancelled) return
      setCareerWins(wins)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [memberId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  if (careerWins.length === 0) {
    return (
      <div className="border border-border bg-surface-card p-8 text-center text-sm text-ink-muted">
        This member hasn't logged any Career Wins yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {careerWins.map((win) => (
        <CareerWinCard key={win.id} careerWin={win} />
      ))}
    </div>
  )
}
