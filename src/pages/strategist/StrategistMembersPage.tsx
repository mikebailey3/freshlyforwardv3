import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StrategistLayout } from '@/components/StrategistLayout'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getAssignedMembers } from '@/lib/operations'
import { cn, formatDate } from '@/lib/utils'
import {
  Users, Search, User, MessageSquare, AlertCircle, CheckCircle2,
  ArrowRight, Filter,
} from 'lucide-react'
import type { MemberProfile } from '@/types'

interface MemberRow {
  member_id: string
  assigned_at: string
  profile: MemberProfile | null
  unread_count: number
  pending_approvals: number
}

type ReadinessFilter = 'all' | 'ready' | 'in_progress' | 'not_started'

export function StrategistMembersPage() {
  const { user, role } = useAuth()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all')

  useEffect(() => {
    if (!user) return
    loadMembers()
  }, [user])

  const loadMembers = async () => {
    if (!user) return
    setLoading(true)

    const assignments = await getAssignedMembers(user.id)
    const memberIds = assignments.map((a) => a.member_id)

    const rows: MemberRow[] = []
    for (const assignment of assignments) {
      const { data: profile } = await supabase
        .from('member_profiles')
        .select('*')
        .eq('user_id', assignment.member_id)
        .maybeSingle()

      const { count: unread } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', assignment.member_id)
        .eq('sender_type', 'member')
        .eq('is_read', false)

      const { count: pending } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', assignment.member_id)
        .eq('status', 'awaiting_member_approval')

      rows.push({
        member_id: assignment.member_id,
        assigned_at: assignment.assigned_at,
        profile: profile as MemberProfile | null,
        unread_count: unread || 0,
        pending_approvals: pending || 0,
      })
    }

    setMembers(rows)
    setLoading(false)
  }

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        !searchQuery ||
        m.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.profile?.headline?.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      if (readinessFilter === 'all') return true
      const score = m.profile?.search_readiness_score ?? 0
      if (readinessFilter === 'ready') return score >= 80
      if (readinessFilter === 'in_progress') return score >= 40 && score < 80
      if (readinessFilter === 'not_started') return score < 40
      return true
    })
  }, [members, searchQuery, readinessFilter])

  if (loading) {
    return (
      <StrategistLayout isAdmin={role === 'admin'}>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      </StrategistLayout>
    )
  }

  return (
    <StrategistLayout isAdmin={role === 'admin'}>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Assigned Members</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage and monitor {members.length} assigned member{members.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Search & filter bar */}
      <div className="mb-6 border border-border bg-surface-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or headline..."
              aria-label="Search members by name or headline"
              className="w-full border border-border bg-surface-card py-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-muted" />
            <select
              value={readinessFilter}
              onChange={(e) => setReadinessFilter(e.target.value as ReadinessFilter)}
              aria-label="Filter by search readiness"
              className="border border-border bg-surface-card py-2 pl-3 pr-8 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Readiness</option>
              <option value="ready">Ready (80+)</option>
              <option value="in_progress">In Progress (40-79)</option>
              <option value="not_started">Not Started (&lt;40)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members list */}
      {filteredMembers.length === 0 ? (
        <div className="border border-border bg-surface-card p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-ink-muted" />
          <p className="mt-4 text-sm text-ink-muted">
            {members.length === 0
              ? 'No members assigned to you yet.'
              : 'No members match your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((m) => (
            <Link
              key={m.member_id}
              to={`/strategist/members/${m.member_id}`}
              className="block border border-border border-l-4 border-l-primary-600 bg-surface-card p-5 transition-colors hover:bg-primary-950"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {/* Avatar */}
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-subtle">
                  <User className="h-6 w-6 text-ink-muted" />
                </div>

                {/* Member info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-base font-semibold text-ink truncate">
                      {m.profile?.full_name || 'Unknown Member'}
                    </h3>
                    {m.profile?.onboarding_completed && (
                      <span className="inline-flex items-center gap-1 border border-success-700 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-success-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Onboarded
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted truncate">
                    {m.profile?.headline || 'No headline set'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Assigned {formatDate(m.assigned_at)}
                  </p>
                </div>

                {/* Search readiness */}
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <span className="text-xs font-medium text-ink-muted">Search Readiness</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden border border-border bg-surface-subtle">
                      <div
                        className={cn(
                          'h-full',
                          (m.profile?.search_readiness_score ?? 0) >= 80
                            ? 'bg-success-500'
                            : (m.profile?.search_readiness_score ?? 0) >= 40
                              ? 'bg-accent-500'
                              : 'bg-error-500',
                        )}
                        style={{ width: `${Math.min(m.profile?.search_readiness_score ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-ink">
                      {m.profile?.search_readiness_score ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2">
                  {m.pending_approvals > 0 && (
                    <span className="inline-flex items-center gap-1 border border-warning-700 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-warning-300">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {m.pending_approvals} pending
                    </span>
                  )}
                  {m.unread_count > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-white">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {m.unread_count} unread
                    </span>
                  )}
                  <ArrowRight className="h-5 w-5 flex-shrink-0 text-ink-muted" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </StrategistLayout>
  )
}
