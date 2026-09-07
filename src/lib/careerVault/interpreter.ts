import type { MetricType } from '@/types/careerVault'

export interface InterpretedCareerWin {
  metricType: MetricType | null
  metricValue: number | null
  metricRaw: string | null
  category: string | null
}

/**
 * Extracts structure (metric, category) from a member's verbatim Career
 * Win statement. Never invents a fact -- every non-null field must be
 * derived from a literal substring of the input statement. Returns a
 * Promise even though v1's implementation resolves synchronously: a
 * future AICareerWinInterpreter will need to make a network call, and
 * designing this as sync now would force a breaking interface change
 * later for every caller (spec section 6).
 *
 * Note on `category`: unlike the metric fields (`metricValue`/`metricRaw`,
 * which are guaranteed to be literal substrings of the input), `category`
 * is a classification into one of a small, fixed, human-curated taxonomy
 * label -- not a verbatim extraction. It cannot invent a specific false
 * claim (the label set is closed and developer-authored), but it will not
 * appear as literal text in the input the way a metric does.
 */
export interface CareerWinInterpreter {
  interpret(statement: string): Promise<InterpretedCareerWin>
}
