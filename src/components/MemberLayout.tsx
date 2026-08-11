import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import {
  Compass, LayoutDashboard, User, CreditCard, Calendar, MessageSquare,
  TrendingUp, Sparkles, Menu, X, LogOut, Search, FileText,
  Bell, Settings, Activity, Award, FileText as FileTextIcon,
  Lock,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { FeatureKey } from '@/types'

interface NavItemConfig {
  to: string
  label: string
  icon: typeof LayoutDashboard
  feature?: FeatureKey
  requiredPlan?: string
}

const navItems: NavItemConfig[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/opportunities', label: 'Opportunities', icon: Search, feature: 'hand_selected_opportunities' },
  { to: '/applications', label: 'Applications', icon: FileText, feature: 'applications' },
  { to: '/profile', label: 'Career Profile', icon: User, feature: 'career_profile' },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/mock-interviews', label: 'Mock Interviews', icon: MessageSquare, feature: 'mock_interviews', requiredPlan: 'career-growth' },
  { to: '/friday-reports', label: 'Friday Reports', icon: FileTextIcon, feature: 'friday_reports' },
  { to: '/messages', label: 'Messages', icon: MessageSquare, feature: 'direct_messaging' },
  { to: '/timeline', label: 'Timeline', icon: Calendar },
  { to: '/activity', label: 'Activity Feed', icon: Activity },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/career-success', label: 'Career Success', icon: Sparkles, feature: 'workplace_success_coaching', requiredPlan: 'career-concierge' },
  { to: '/founding-member', label: 'Founding Member', icon: Award },
  { to: '/membership', label: 'Membership', icon: CreditCard },
  { to: '/settings/communication', label: 'Settings', icon: Settings },
]

export function MemberLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const { canAccess } = useEntitlements()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const renderNavIcon = (item: NavItemConfig) => {
    if (item.feature && !canAccess(item.feature)) {
      return <Lock className="h-4 w-4 text-neutral-400" />
    }
    return <item.icon className="h-5 w-5" />
  }

  const renderNavLink = (item: NavItemConfig, onNavigate?: () => void) => {
    const isActive = location.pathname === item.to
    const isLocked = item.feature ? !canAccess(item.feature) : false

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
        } ${isLocked ? 'opacity-70' : ''}`}
      >
        {renderNavIcon(item)}
        {item.label}
        {isLocked && item.requiredPlan && (
          <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            {item.requiredPlan === 'career-growth' ? 'Growth' : item.requiredPlan === 'career-concierge' ? 'Concierge' : ''}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-neutral-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <Link to="/dashboard" className="flex items-center gap-2 border-b border-neutral-200 px-6 py-5">
            <Compass className="h-7 w-7 text-primary-600" />
            <span className="font-serif text-lg font-semibold text-neutral-900">FreshlyForward</span>
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => renderNavLink(item))}
          </nav>

          <div className="border-t border-neutral-200 p-3">
            <div className="mb-2 px-3 text-xs text-neutral-500">
              {profile?.full_name || profile?.headline || 'Member'}
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary-600" />
            <span className="font-serif text-base font-semibold text-neutral-900">FreshlyForward</span>
          </Link>
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle navigation"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileNavOpen && (
        <nav className="fixed inset-0 z-50 bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <Link to="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2">
              <Compass className="h-6 w-6 text-primary-600" />
              <span className="font-serif text-base font-semibold text-neutral-900">FreshlyForward</span>
            </Link>
            <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="space-y-1 p-3">
            {navItems.map((item) => renderNavLink(item, () => setMobileNavOpen(false)))}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </nav>
      )}

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
            { to: '/opportunities', label: 'Opps', icon: Search },
            { to: '/applications', label: 'Apps', icon: FileText },
            { to: '/messages', label: 'Chat', icon: MessageSquare },
            { to: '/notifications', label: 'Alerts', icon: Bell },
          ].map((item) => {
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'text-primary-600' : 'text-neutral-500'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
