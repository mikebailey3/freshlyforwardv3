import { parseSalaryRange } from '@/lib/freshFitScore/compensation'
import { inferSeniorityLevel, type SeniorityLevel } from '@/lib/freshFitScore/seniority'
import { findSkillsInText } from '@/lib/freshFitScore/skillMatching'
import { isRemoteText, extractTravelSignal } from '@/lib/freshFitScore/location'
import { isSafeHttpUrl } from '@/lib/url'

/**
 * OE 2.0 Phase 1 -- deterministic, testable job normalization.
 *
 * Design principle (explicitly requested): every field here is a PURE
 * function of a job's own raw, already-canonical columns
 * (`scraped_jobs.title/company/location/description/...`). Nothing here
 * is persisted as a second copy of that data -- `normalizeJob()` is a
 * read-time projection, computed on demand by any consumer that wants
 * it (Phase 2+ scoring, admin/strategist UI, market intelligence),
 * never a competing source of truth. The one genuinely stateful
 * exception is deduplication (`jobDeduplication.ts`), which by nature
 * depends on comparing *multiple* rows and must persist a decision to
 * survive across scrape runs -- everything in *this* file stays a pure
 * function of a single job.
 *
 * Reuse, not reinvention: seniority, salary, skills, remote/travel
 * detection all already exist as tested primitives inside
 * `freshFitScore/` (used today by FreshFit's scoring dimensions). This
 * file imports and reuses them directly rather than maintaining a
 * second copy that could silently drift from FreshFit's locked
 * decisions -- exactly the reuse the brief asked for.
 */

export type WorkModel = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export type NormalizedEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'temporary'
  | 'unknown'

export type EducationRequirement = 'high_school' | 'associate' | 'bachelor' | 'master' | 'doctorate'

export interface NormalizedLocation {
  /** lowercase, trimmed, whitespace-collapsed -- the raw text used for the dedup key. */
  normalized: string
  city: string | null
  state: string | null
}

/**
 * Structural type (not `ScrapedJob`/`ScrapedJobInput` directly) so this
 * module works identically for a freshly-fetched provider job (before
 * insert), an already-persisted `scraped_jobs` row, and a member
 * submission -- every existing job-shaped object in this codebase
 * already satisfies this shape.
 */
export interface JobLike {
  source: string
  title: string
  company: string
  location: string | null
  description: string
  salary_text: string | null
  employment_type: string | null
  posting_url: string
  posted_at: string | null
}

export interface NormalizedJob {
  normalizedTitle: string
  normalizedCompany: string
  normalizedLocation: NormalizedLocation
  /** Exact-match dedup key -- see jobDeduplication.ts. */
  dedupeKey: string
  workModel: WorkModel
  employmentType: NormalizedEmploymentType
  seniorityLevel: SeniorityLevel | null
  skills: string[]
  salaryRange: { min: number; max: number } | null
  minYearsExperience: number | null
  educationRequirement: EducationRequirement | null
  responsibilities: string[]
  travel: { impliesHeavyTravel: boolean; percentage: number | null }
  postedAt: string | null
  source: string
  sourceReliability: number
  applyUrl: string | null
}

// ---------------------------------------------------------------------
// Title / company / location
// ---------------------------------------------------------------------

const LEGAL_SUFFIX_RE = /\b(inc|incorporated|llc|l\.l\.c|corp|corporation|co|company|ltd|limited|plc|gmbh|group|holdings)\b\.?/gi

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Lowercase, punctuation-stripped, whitespace-collapsed title -- for the dedup key only, not for display. */
export function normalizeTitle(title: string): string {
  return collapseWhitespace((title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' '))
}

/** Lowercase, legal-suffix-stripped, whitespace-collapsed company name -- for the dedup key only, not for display. */
export function normalizeCompanyName(company: string): string {
  const withoutSuffixes = (company || '').toLowerCase().replace(LEGAL_SUFFIX_RE, ' ')
  return collapseWhitespace(withoutSuffixes.replace(/[^a-z0-9\s]/g, ' '))
}

const CITY_STATE_RE = /^([^,]+),\s*([a-z]{2})$/i

/** Best-effort "City, ST" split; falls back to the whole normalized string when it doesn't parse (never fabricated). */
export function normalizeLocationText(location: string | null | undefined): NormalizedLocation {
  const raw = (location || '').trim()
  const normalized = collapseWhitespace(raw.toLowerCase())
  if (!normalized) return { normalized: '', city: null, state: null }

  const match = raw.match(CITY_STATE_RE)
  if (match) {
    return { normalized, city: collapseWhitespace(match[1].toLowerCase()), state: match[2].toLowerCase() }
  }
  return { normalized, city: null, state: null }
}

/**
 * Exact-match dedup key (OE 2.0 Phase 1 plan): title + company + city
 * (falling back to the full normalized location string when no city
 * could be parsed). Deliberately simple/deterministic -- no fuzzy or
 * embedding matching, so it can never collapse two genuinely distinct
 * openings into one; the tradeoff is it will miss some true duplicates
 * (e.g. a real typo), which is the safer failure mode per the brief.
 */
export function normalizeJobKey(title: string, company: string, location: string | null | undefined): string {
  const loc = normalizeLocationText(location)
  const locationPart = loc.city ?? loc.normalized
  return [normalizeTitle(title), normalizeCompanyName(company), locationPart].join('|')
}

// ---------------------------------------------------------------------
// Work model / employment type
// ---------------------------------------------------------------------

const HYBRID_RE = /\bhybrid\b/i
const ONSITE_RE = /\bon[\s-]?site\b|\bin[\s-]?office\b/i

/**
 * Deliberately checks only `title`/`location` for the remote signal
 * (the same structured/near-structured fields `location.ts`'s scoring
 * already trusts for this), not free-text `description` prose --
 * scanning a full JD for the word "remote" risks false positives like
 * "not a remote position" or "no remote work available". The
 * conservative failure mode here is a false negative (missing a truly
 * remote role that only mentions it in body text), never a false
 * positive.
 */
export function inferWorkModel(title: string, location: string | null, description: string): WorkModel {
  const haystack = `${title} ${location ?? ''} ${description}`
  if (isRemoteText(location) || isRemoteText(title)) return 'remote'
  if (HYBRID_RE.test(haystack)) return 'hybrid'
  if (ONSITE_RE.test(haystack) || (location && location.trim())) return 'onsite'
  return 'unknown'
}

const EMPLOYMENT_TYPE_PATTERNS: Array<{ type: NormalizedEmploymentType; pattern: RegExp }> = [
  { type: 'internship', pattern: /\bintern(ship)?\b/i },
  { type: 'temporary', pattern: /\btemp(orary)?\b|\bseasonal\b/i },
  { type: 'contract', pattern: /\bcontract(or)?\b|\bfreelance\b|\b1099\b/i },
  { type: 'part_time', pattern: /\bpart[\s-]?time\b/i },
  { type: 'full_time', pattern: /\bfull[\s-]?time\b|\bfte\b/i },
]

/** Maps free-text employment-type strings from any provider (Lever's `commitment`, Ashby's `employmentType`, etc.) onto one shared canonical enum. */
export function normalizeEmploymentType(raw: string | null | undefined): NormalizedEmploymentType {
  const text = (raw || '').trim()
  if (!text) return 'unknown'
  for (const { type, pattern } of EMPLOYMENT_TYPE_PATTERNS) {
    if (pattern.test(text)) return type
  }
  return 'unknown'
}

// ---------------------------------------------------------------------
// Experience / education / responsibilities
// ---------------------------------------------------------------------

const YEARS_EXPERIENCE_RE = /(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?years?\b/i

/** Extracts the minimum years-of-experience requirement, e.g. "5+ years" or "3-5 years of experience". Null (never 0) when nothing parses -- absence of a number is Unknown, not "no experience required". */
export function extractMinYearsExperience(jobText: string): number | null {
  const match = (jobText || '').match(YEARS_EXPERIENCE_RE)
  if (!match) return null
  return Number(match[1])
}

const EDUCATION_PATTERNS: Array<{ level: EducationRequirement; pattern: RegExp }> = [
  { level: 'doctorate', pattern: /\bph\.?d\b|\bdoctorate\b/i },
  { level: 'master', pattern: /\bmaster'?s?\b|\bmba\b/i },
  { level: 'bachelor', pattern: /\bbachelor'?s?\b|\bb\.?a\.?\b|\bb\.?s\.?\b|\bundergraduate degree\b/i },
  { level: 'associate', pattern: /\bassociate'?s?\s+degree\b/i },
  { level: 'high_school', pattern: /\bhigh school diploma\b|\bged\b/i },
]

/** Highest education level explicitly mentioned in the JD text; null (never a default) when none is mentioned. */
export function extractEducationRequirement(jobText: string): EducationRequirement | null {
  for (const { level, pattern } of EDUCATION_PATTERNS) {
    if (pattern.test(jobText || '')) return level
  }
  return null
}

const RESPONSIBILITIES_HEADING_RE = /(?:responsibilities|what you'?ll do|key duties)\s*:?/i
const NEXT_SECTION_HEADING_RE =
  /(?:requirements|qualifications|what you'?ll need|about you|nice to have|benefits|perks|who you are)\s*:?/i

/**
 * Conservative, deterministic responsibilities extraction. Only ever
 * returns non-empty when both (a) a recognizable "Responsibilities"-style
 * heading is present, AND (b) the text after it actually contains a
 * splittable delimiter (newline or bullet character). Real job
 * descriptions vary wildly in how much structure survives HTML-to-text
 * conversion (see greenhouse.ts's `stripHtml`, which collapses all
 * whitespace including newlines) -- rather than guess a fuzzy split on
 * a single collapsed line of prose, this returns `[]` in that case. An
 * empty list here means "not reliably extractable," not "no
 * responsibilities" -- callers must treat it as Unknown, not a gap.
 */
export function extractResponsibilities(description: string): string[] {
  const text = description || ''
  const headingMatch = text.match(RESPONSIBILITIES_HEADING_RE)
  if (!headingMatch || headingMatch.index === undefined) return []

  const afterHeading = text.slice(headingMatch.index + headingMatch[0].length)
  const nextSectionMatch = afterHeading.match(NEXT_SECTION_HEADING_RE)
  const section = nextSectionMatch?.index !== undefined ? afterHeading.slice(0, nextSectionMatch.index) : afterHeading

  const lines = section.split(/\r?\n|•|\u2022/g)
  const pieces = lines
    .map((line) => collapseWhitespace(line.replace(/^[\s\-*]+/, '')))
    .filter((piece) => piece.length > 3)

  // A single unsplit blob means no real delimiter was found -- honest
  // "not reliably extractable," not a fabricated one-item list.
  return pieces.length > 1 ? pieces : []
}

// ---------------------------------------------------------------------
// Posted date / apply URL / source reliability
// ---------------------------------------------------------------------

/** Validates and canonicalizes a posted-date string to `YYYY-MM-DD`; null (never today's date) when unparseable. */
export function normalizePostedAt(raw: string | null | undefined): string | null {
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

/** Reuses the same safe-URL check already enforced at every render site; null (never a raw unsafe string) when the URL is missing or dangerous. */
export function normalizeApplyUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw || '').trim()
  return isSafeHttpUrl(trimmed) ? trimmed : null
}

/**
 * Deliberately coarse (0-3) and static -- reflects only the two facts
 * already true in this codebase's own docstrings: Greenhouse/Lever/Ashby
 * are documented, unauthenticated public APIs (scrapeCompanies.ts);
 * Indeed is an explicitly "best-effort, ToS-risk" HTML scrape
 * (scrapeIndeed.ts); member-submitted is human-provided but unverified.
 * Used only to break dedup ties (jobDeduplication.ts) -- never
 * persisted as a per-job trust score, so it can be adjusted here later
 * without a migration.
 */
export const SOURCE_RELIABILITY: Record<string, number> = {
  greenhouse: 3,
  lever: 3,
  ashby: 3,
  'member-submitted': 2,
  indeed: 1,
}

export function getSourceReliability(source: string): number {
  return SOURCE_RELIABILITY[source] ?? 0
}

// ---------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------

/** The single entry point: composes every normalized field above from one raw job. Pure, synchronous, no I/O. */
export function normalizeJob(job: JobLike): NormalizedJob {
  const jobText = `${job.title} ${job.description}`

  return {
    normalizedTitle: normalizeTitle(job.title),
    normalizedCompany: normalizeCompanyName(job.company),
    normalizedLocation: normalizeLocationText(job.location),
    dedupeKey: normalizeJobKey(job.title, job.company, job.location),
    workModel: inferWorkModel(job.title, job.location, job.description),
    employmentType: normalizeEmploymentType(job.employment_type),
    seniorityLevel: inferSeniorityLevel(job.title),
    skills: findSkillsInText(jobText),
    salaryRange: parseSalaryRange(job.salary_text),
    minYearsExperience: extractMinYearsExperience(jobText),
    educationRequirement: extractEducationRequirement(jobText),
    responsibilities: extractResponsibilities(job.description),
    travel: extractTravelSignal(job.description),
    postedAt: normalizePostedAt(job.posted_at),
    source: job.source,
    sourceReliability: getSourceReliability(job.source),
    applyUrl: normalizeApplyUrl(job.posting_url),
  }
}
