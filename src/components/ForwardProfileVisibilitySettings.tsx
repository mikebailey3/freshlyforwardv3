import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updatePublicProfileVisibility } from '@/lib/publicProfile'
import { PUBLIC_PROFILE_SECTION_KEYS } from '@/types/publicProfile'
import type { PublicProfileSectionKey } from '@/types/publicProfile'
import type { MemberProfile } from '@/types'

const SECTION_LABELS: Record<PublicProfileSectionKey, string> = {
  summary: 'Summary',
  employment: 'Experience',
  education: 'Education',
  certifications: 'Certifications',
  skills: 'Skills',
  career_goals: 'Career Goals',
}

interface ForwardProfileVisibilitySettingsProps {
  profile: MemberProfile
  onUpdated: () => void
}

/**
 * Lives inside CareerProfilePage's sidebar, next to ProfileCard -- kept as
 * its own component rather than folded into ProfileCard.tsx since it's a
 * distinct concern (public visibility) from identity/avatar data entry,
 * and ProfileCard.tsx is already a meaningful size on its own.
 *
 * Every write here goes through the existing owner-only `update_own_profile`
 * RLS policy on member_profiles (unchanged by this feature) via
 * updatePublicProfileVisibility -- this component itself has no special
 * privilege and cannot make any OTHER member's profile public.
 */
export function ForwardProfileVisibilitySettings({ profile, onUpdated }: ForwardProfileVisibilitySettingsProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasUsername = !!profile.username
  const isPublic = profile.public_profile_enabled

  const save = async (enabled: boolean, sections: MemberProfile['public_profile_sections']) => {
    setSaving(true)
    setError(null)
    const { error: saveError } = await updatePublicProfileVisibility(profile.user_id, {
      publicProfileEnabled: enabled,
      sections,
    })
    setSaving(false)
    if (saveError) {
      setError('Could not save your Forward Profile visibility. Please try again.')
      return
    }
    onUpdated()
  }

  const handleToggleEnabled = () => {
    if (!hasUsername) return
    save(!isPublic, profile.public_profile_sections)
  }

  const handleToggleSection = (key: PublicProfileSectionKey) => {
    save(isPublic, {
      ...profile.public_profile_sections,
      [key]: !profile.public_profile_sections[key],
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-sm">
      <h3 className="font-display !text-base font-semibold text-ink">Public Forward Profile</h3>

      {hasUsername ? (
        <p className="mt-1 font-mono text-sm text-primary-400">{`/u/${profile.username}`}</p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">Set a username above to make a public Forward Profile.</p>
      )}

      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={saving || !hasUsername}
          onChange={handleToggleEnabled}
          aria-label="Make my Forward Profile public"
        />
        Make my Forward Profile public
      </label>

      {isPublic && hasUsername && (
        <>
          <div className="mt-3 space-y-1.5">
            {PUBLIC_PROFILE_SECTION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={profile.public_profile_sections[key]}
                  disabled={saving}
                  onChange={() => handleToggleSection(key)}
                  aria-label={SECTION_LABELS[key]}
                />
                {SECTION_LABELS[key]}
              </label>
            ))}
          </div>

          <Link
            to={`/u/${profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-primary-600 hover:underline"
          >
            Preview as public visitor
          </Link>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-error-600 bg-error-950 px-3 py-2 text-xs text-error-300">{error}</p>
      )}
    </div>
  )
}
