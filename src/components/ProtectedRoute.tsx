import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import { MemberLayout } from '@/components/MemberLayout'
import { UpgradeRequiredPage } from '@/components/FeatureEntitlements'
import type { ReactNode } from 'react'
import type { UserRole, FeatureKey } from '@/types'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: UserRole[]
  feature?: FeatureKey
  requiredPlan?: string
}

export function ProtectedRoute({ children, roles, feature, requiredPlan }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth()
  const { canAccess, loading: entitlementsLoading } = useEntitlements()

  if (loading || entitlementsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (feature && !canAccess(feature)) {
    return (
      <MemberLayout>
        <UpgradeRequiredPage featureKey={feature} requiredPlan={requiredPlan} />
      </MemberLayout>
    )
  }

  return <>{children}</>
}
