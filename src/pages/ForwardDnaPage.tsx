import { useEffect, useState, useCallback } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ensureProfile } from '@/lib/profile'
import { ensureEmploymentEntryIdsForUser } from '@/lib/forwardDna/employmentEntryIds'
import { getAllScopeForUser, upsertScope } from '@/lib/forwardDna/scope'
import type { CareerScopeUpdate } from '@/lib/forwardDna/scope'
import { getAllResponsibilitiesForUser, addResponsibility, removeResponsibility } from '@/lib/forwardDna/responsibilities'
import { getSkillStates, upsertSkillState, syncSkillsFromProfile } from '@/lib/forwardDna/skills'
import { buildForwardDnaCompletenessInput } from '@/lib/forwardDna/completeness'
import type { SkillState } from '@/types/forwardDna'
import { CompassSummaryCard } from '@/components/forwardDna/CompassSummaryCard'
import { CareerScopeCard } from '@/components/forwardDna/CareerScopeCard'
import { ResponsibilitiesCard } from '@/components/forwardDna/ResponsibilitiesCard'
import { SkillEvidenceCard } from '@/components/forwardDna/SkillEvidenceCard'
import { CareerGoalsCard } from '@/components/forwardDna/CareerGoalsCard'
import { CompletenessWidget } from '@/components/forwardDna/CompletenessWidget'
import { Loader2, AlertCircle } from 'lucide-react'
import type { MemberProfile, EmploymentEntry } from '@/types'
import type { CareerScope, CareerResponsibility, CareerSkill } from '@/types/forwardDna'
import type { ArchetypeKey } from '@/types/careerCompass'

interface CompassSummary {
  primary_archetype: ArchetypeKey
  primary_barrier: string
}

export function ForwardDnaPage() {
  const { user, refreshProfile } = useAuth()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [entries, setEntries] = useState<EmploymentEntry[]>([])
  const [scope, setScope] = useState<CareerScope[]>([])
  const [responsibilities, setResponsibilities] = useState<CareerResponsibility[]>([])
  const [skills, setSkills] = useState<CareerSkill[]>([])
  const [compassResult, setCompassResult] = useState<CompassSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      const p = (await ensureProfile(user.id)) as MemberProfile | null
      if (!p || cancelled) return
      setProfile(p)

      const { entries: idEntries } = await ensureEmploymentEntryIdsForUser(user.id, p.employment_history || [])
      if (cancelled) return
      setEntries(idEntries)

      await syncSkillsFromProfile(user.id, p.skills || [])

      const [scopeRes, respRes, skillsRes, compassRes] = await Promise.all([
        getAllScopeForUser(user.id),
        getAllResponsibilitiesForUser(user.id),
        getSkillStates(user.id),
        supabase
          .from('career_compass_results')
          .select('primary_archetype, primary_barrier')
          .eq('user_id', user.id)
          .eq('is_current', true)
          .maybeSingle(),
      ])

      if (cancelled) return
      setScope(scopeRes.scope)
      setResponsibilities(respRes.responsibilities)
      setSkills(skillsRes.skills)
      setCompassResult((compassRes.data as CompassSummary | null) ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSaveScope = useCallback(
    async (employmentEntryId: string, updates: CareerScopeUpdate) => {
      if (!user) return
      setError(null)
      const { error: saveError } = await upsertScope(user.id, employmentEntryId, updates)
      if (saveError) {
        setError('Could not save your professional scope. Please try again.')
        return
      }
      const { scope: refreshed } = await getAllScopeForUser(user.id)
      setScope(refreshed)
    },
    [user]
  )

  const handleAddResponsibility = useCallback(
    async (employmentEntryId: string, tag: string) => {
      if (!user) return
      setError(null)
      const { error: addError } = await addResponsibility(user.id, employmentEntryId, tag, null)
      if (addError) {
        setError('Could not add that responsibility. Please try again.')
        return
      }
      const { responsibilities: refreshed } = await getAllResponsibilitiesForUser(user.id)
      setResponsibilities(refreshed)
    },
    [user]
  )

  const handleRemoveResponsibility = useCallback(
    async (responsibilityId: string) => {
      if (!user) return
      setError(null)
      const { error: removeError } = await removeResponsibility(responsibilityId)
      if (removeError) {
        setError('Could not remove that responsibility. Please try again.')
        return
      }
      const { responsibilities: refreshed } = await getAllResponsibilitiesForUser(user.id)
      setResponsibilities(refreshed)
    },
    [user]
  )

  const handleChangeSkillState = useCallback(
    async (skillName: string, state: SkillState) => {
      if (!user) return
      setError(null)
      const existing = skills.find((s) => s.skill_name === skillName)
      const { error: skillError } = await upsertSkillState(user.id, skillName, state, existing?.evidence_note ?? null)
      if (skillError) {
        setError('Could not update that skill. Please try again.')
        return
      }
      const { skills: refreshed } = await getSkillStates(user.id)
      setSkills(refreshed)
    },
    [user, skills]
  )

  const handleSaveTargets = useCallback(
    async (targetRole: string, targetTimeframe: string) => {
      if (!user) return
      setError(null)
      const { error: saveError } = await supabase
        .from('member_profiles')
        .update({ target_role: targetRole || null, target_timeframe: targetTimeframe || null })
        .eq('user_id', user.id)
      if (saveError) {
        setError('Could not save your career goals. Please try again.')
        return
      }
      setProfile((p) => (p ? { ...p, target_role: targetRole || null, target_timeframe: targetTimeframe || null } : p))
      await refreshProfile()
    },
    [user, refreshProfile]
  )

  if (loading || !profile) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">Forward DNA</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Your complete professional intelligence profile — not a resume, the real thing underneath it.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CompassSummaryCard result={compassResult} />
          <CareerScopeCard entries={entries} scope={scope} onSave={handleSaveScope} />
          <ResponsibilitiesCard entries={entries} responsibilities={responsibilities} onAdd={handleAddResponsibility} onRemove={handleRemoveResponsibility} />
          <SkillEvidenceCard skills={skills} onChangeState={handleChangeSkillState} />
          <CareerGoalsCard profile={profile} onSaveTargets={handleSaveTargets} />
        </div>
        <div>
          <CompletenessWidget
            input={buildForwardDnaCompletenessInput(profile, scope, responsibilities, skills, !!compassResult)}
          />
        </div>
      </div>
    </MemberLayout>
  )
}
