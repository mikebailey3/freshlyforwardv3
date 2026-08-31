export interface CareerScope {
  id: string
  user_id: string
  employment_entry_id: string
  revenue_managed_cents: number | null
  team_size: number | null
  budget_managed_cents: number | null
  direct_reports: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CareerResponsibility {
  id: string
  user_id: string
  employment_entry_id: string
  tag: string
  category: string | null
  created_at: string
}

export type SkillState = 'claimed' | 'demonstrated' | 'supported'

export interface CareerSkill {
  id: string
  user_id: string
  skill_name: string
  state: SkillState
  evidence_note: string | null
  created_at: string
  updated_at: string
}
