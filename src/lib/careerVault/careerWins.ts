import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerWin, CareerWinCapability, EvidenceType, MetricType } from '@/types/careerVault'

export interface CreateCareerWinInput {
  originalStatement: string
  employmentEntryId: string | null
  evidenceType: EvidenceType
  category: string | null
  metricType: MetricType | null
  metricValue: number | null
  metricRaw: string | null
}

export async function createCareerWin(
  userId: string,
  input: CreateCareerWinInput,
  client: SupabaseClient = defaultClient
): Promise<{ careerWin: CareerWin | null; error: string | null }> {
  // Unlike sibling inserts elsewhere in forwardDna/ (e.g. addResponsibility),
  // this one selects the row back: Task 6/7 need the generated `id`
  // immediately afterward to attach capability-confirmation rows to it.
  const { data, error } = await client
    .from('career_wins')
    .insert({
      user_id: userId,
      employment_entry_id: input.employmentEntryId,
      original_statement: input.originalStatement,
      evidence_type: input.evidenceType,
      category: input.category,
      metric_type: input.metricType,
      metric_value: input.metricValue,
      metric_raw: input.metricRaw,
    })
    .select('*')
    .maybeSingle()

  return { careerWin: (data as CareerWin | null) ?? null, error: error?.message ?? null }
}

export async function getCareerWinsForUser(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ careerWins: CareerWin[]; error: string | null }> {
  const { data, error } = await client
    .from('career_wins')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { careerWins: (data as CareerWin[]) ?? [], error: error?.message ?? null }
}

export interface CareerWinWithCapabilities extends CareerWin {
  capabilities: CareerWinCapability[]
}

/**
 * Fetches a user's Career Wins plus their confirmed capabilities in two
 * queries (not N+1) -- one for the wins, one for all matching
 * career_win_capabilities rows, grouped client-side. Used identically
 * by the member's own Career Vault page and the strategist's read-only
 * tab (userId is simply whichever member's data the RLS policy allows
 * the caller to see).
 */
export async function getCareerWinsWithCapabilities(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ careerWins: CareerWinWithCapabilities[]; error: string | null }> {
  const { careerWins, error } = await getCareerWinsForUser(userId, client)
  if (error) return { careerWins: [], error }
  if (careerWins.length === 0) return { careerWins: [], error: null }

  const ids = careerWins.map((w) => w.id)
  const { data, error: capsError } = await client
    .from('career_win_capabilities')
    .select('*')
    .in('career_win_id', ids)
    .eq('status', 'confirmed')

  if (capsError) {
    // Fail closed, matching getCareerWinsForUser's own error branch above --
    // a partially-successful shape (wins populated, capabilities silently
    // empty) would let a careless caller render "no confirmed skills yet"
    // as if it were ground truth instead of an error state.
    return { careerWins: [], error: capsError.message }
  }

  const capsByWin = new Map<string, CareerWinCapability[]>()
  for (const cap of (data as CareerWinCapability[]) ?? []) {
    const list = capsByWin.get(cap.career_win_id) ?? []
    list.push(cap)
    capsByWin.set(cap.career_win_id, list)
  }

  return {
    careerWins: careerWins.map((w) => ({ ...w, capabilities: capsByWin.get(w.id) ?? [] })),
    error: null,
  }
}

export async function deleteCareerWin(
  careerWinId: string,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client.from('career_wins').delete().eq('id', careerWinId)
  return { error: error?.message ?? null }
}
