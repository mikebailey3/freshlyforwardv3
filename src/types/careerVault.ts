export type EvidenceType =
  | 'accomplishment'
  | 'project'
  | 'process_improvement'
  | 'promotion'
  | 'recognition'
  | 'certification'
  | 'leadership'
  | 'problem_solved'
  | 'other'

export type MetricType = 'currency' | 'percentage' | 'count'

export interface CareerWin {
  id: string
  user_id: string
  employment_entry_id: string | null
  original_statement: string
  evidence_type: EvidenceType
  category: string | null
  metric_type: MetricType | null
  metric_value: number | null
  metric_raw: string | null
  created_at: string
  updated_at: string
}

export type CapabilitySource = 'system' | 'member'
export type CapabilityStatus = 'pending' | 'confirmed' | 'rejected'

export interface CareerWinCapability {
  id: string
  career_win_id: string
  user_id: string
  skill_name: string
  suggested_state: 'demonstrated'
  source: CapabilitySource
  inference_reason: string | null
  status: CapabilityStatus
  decided_at: string | null
  created_at: string
}
