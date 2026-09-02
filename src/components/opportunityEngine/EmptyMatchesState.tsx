import { Sparkles } from 'lucide-react'

/** Richer than the old single-line empty state, without becoming a wall
 * of text: what Opportunity Engine does, what FreshFit means, and what
 * to do next -- three small jobs instead of one. */
export function EmptyMatchesState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
      <Sparkles className="mx-auto h-12 w-12 text-neutral-300" />
      <p className="mt-4 text-sm font-medium text-neutral-900">No matches yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
        Opportunity Engine automatically scans job postings and scores each one against your Career
        Profile with FreshFit &mdash; a 0&ndash;100 fit score based on your skills, experience, and goals.
        Strong matches get promoted to your Career Strategist for review.
      </p>
      <p className="mt-3 text-xs text-neutral-500">
        Keep your Career Profile (skills, preferred roles) up to date to improve matching, or submit a
        job yourself using the button above.
      </p>
    </div>
  )
}
