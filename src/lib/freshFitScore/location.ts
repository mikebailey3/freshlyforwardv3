import type { MemberProfile, ScrapedJob } from '@/types'
import type { FreshFitDimensionResult, FreshFitHardConstraint } from './types'

function normalize(text: string | null | undefined): string {
  return (text || '').toLowerCase()
}

const TRAVEL_PERCENT_RE = /(\d{1,3})\s?%\s*travel/i
const TRAVEL_MENTION_RE = /\brequires?\s+travel\b|\bfrequent travel\b|\bextensive travel\b/i

function jobImpliesHeavyTravel(description: string): boolean {
  const pctMatch = description.match(TRAVEL_PERCENT_RE)
  if (pctMatch && Number(pctMatch[1]) >= 25) return true
  return TRAVEL_MENTION_RE.test(description)
}

function isRemoteText(location: string): boolean {
  return normalize(location).includes('remote')
}

function sameCity(memberLocation: string | null, jobLocation: string): boolean {
  const member = normalize(memberLocation)
  const job = normalize(jobLocation)
  if (!member || !job) return false
  return job.includes(member.split(',')[0].trim())
}

/**
 * Location & Logistics dimension -- an upgrade of the original
 * locationFit factor. Same "no signal = neutral credit, never a
 * penalty" philosophy, now also folding in `travel_willingness` (a
 * field MemberProfile already collects but the original engine never
 * read) as an explanation-level flag rather than a score swing --
 * FreshlyForward doesn't have real commute-distance data, so this stays
 * a best-effort surface, not a precise calculation (documented
 * limitation, see the design spec's §5.4).
 */
export function scoreLocationDimension(profile: MemberProfile, job: ScrapedJob): FreshFitDimensionResult {
  const jobLocation = job.location || ''
  const isRemoteJob = isRemoteText(jobLocation)
  const description = job.description || ''
  const heavyTravel = jobImpliesHeavyTravel(description)
  const travelGap =
    heavyTravel && (profile.travel_willingness === 'none' || !profile.travel_willingness)
      ? ['this role appears to require significant travel']
      : []

  let score: number
  let status: FreshFitDimensionResult['status']
  let explanation: string
  let evidence: string[] = []
  let gaps: string[] = [...travelGap]

  if (isRemoteJob && (profile.remote_preference === 'remote' || profile.remote_preference === 'hybrid')) {
    score = 95
    status = 'strong'
    explanation = 'This is a remote role, matching your remote/hybrid preference.'
    evidence = ['remote role matches your stated preference']
  } else if (sameCity(profile.location, jobLocation)) {
    score = 90
    status = 'strong'
    explanation = `This role is in the same area as your stated location (${profile.location}).`
    evidence = ['same metro area as your stated location']
  } else if (profile.willing_to_relocate) {
    score = 55
    status = 'moderate'
    explanation = "This role isn't in your immediate area, but you've indicated you're willing to relocate."
    evidence = ['stated willingness to relocate']
  } else if (!profile.location && !isRemoteJob) {
    score = 5
    status = 'no-data'
    explanation = 'No location is on file yet, so FreshFit can\'t confirm how this role lines up geographically.'
    gaps = [...gaps]
  } else {
    score = 10
    status = 'weak'
    explanation = `This role (${jobLocation || 'location unspecified'}) doesn't match your stated location, remote preference, or relocation willingness.`
    gaps = ['location, remote, or relocation alignment', ...travelGap]
  }

  return {
    key: 'locationAndLogistics',
    label: 'Location & Logistics',
    score,
    weight: 0.1,
    status,
    explanation,
    evidence,
    gaps,
    unknowns: profile.location ? [] : ['precise commute/logistics fit'],
    improvementLink: score < 100 ? { label: 'Update your location preferences', to: '/career-profile' } : null,
  }
}

/**
 * V1's second active hard constraint (design spec Q4): fires
 * HARD_BLOCKER only for a member who has explicitly stated a
 * remote-only requirement, against a job that is confidently *not*
 * remote, not in their area, and they've said they won't relocate.
 * Anything less certain than that stays UNKNOWN -- a member without a
 * strict remote requirement, or a job with ambiguous location data,
 * never gets falsely blocked.
 */
export function remoteHardConstraint(profile: MemberProfile, job: ScrapedJob): FreshFitHardConstraint {
  const isRemoteOnlyMember = profile.remote_preference === 'remote'
  if (!isRemoteOnlyMember) {
    return {
      key: 'remoteRequirement',
      label: 'Remote Requirement',
      status: 'unknown',
      reason: "You haven't stated a strict remote-only requirement.",
    }
  }

  const jobLocation = job.location || ''
  if (isRemoteText(jobLocation) || sameCity(profile.location, jobLocation)) {
    return {
      key: 'remoteRequirement',
      label: 'Remote Requirement',
      status: 'confirmed_match',
      reason: 'This role is remote (or in your area), matching your remote-only requirement.',
    }
  }

  if (profile.willing_to_relocate) {
    return {
      key: 'remoteRequirement',
      label: 'Remote Requirement',
      status: 'confirmed_match',
      reason: "This role isn't remote, but you've indicated you're willing to relocate.",
    }
  }

  if (!jobLocation) {
    return {
      key: 'remoteRequirement',
      label: 'Remote Requirement',
      status: 'unknown',
      reason: "This posting doesn't list a confirmed location.",
    }
  }

  return {
    key: 'remoteRequirement',
    label: 'Remote Requirement',
    status: 'hard_blocker',
    reason: `This role is on-site in ${jobLocation}, doesn't match your stated location, and you've indicated you're not willing to relocate.`,
  }
}
