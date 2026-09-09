import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicProfileByUsername } from '@/lib/publicProfile'
import { usePageMeta } from '@/hooks/usePageMeta'
import { isSafeHttpUrl } from '@/lib/url'
import type { PublicProfileViewModel } from '@/types/publicProfile'

function formatDateRange(startDate: string, endDate: string | null, current: boolean): string {
  return `${startDate} — ${current ? 'Present' : endDate || ''}`
}

/**
 * Public, unauthenticated `/u/:username` page -- distinct from the private
 * "Forward Profile" identity layer (CareerProfilePage/ForwardDnaPage). Reads
 * ONLY the typed PublicProfileViewModel from getPublicProfileByUsername,
 * which itself only ever queries the public_forward_profiles allow-list
 * view -- this component has no path to any private member_profiles column
 * even by accident, since it never sees the raw row.
 */
export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [profile, setProfile] = useState<PublicProfileViewModel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) return
    setLoading(true)
    getPublicProfileByUsername(username)
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [username])

  usePageMeta(
    profile ? `${profile.fullName || profile.username} — FreshlyForward` : 'Forward Profile — FreshlyForward',
    profile?.headline || profile?.summary || null,
  )

  if (loading) {
    return (
      <main>
        <div className="public-profile shell">
          <p style={{ color: '#8894a2' }}>Loading&hellip;</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main>
        <div className="public-profile shell public-profile-empty">
          <p className="eyebrow">Forward Profile</p>
          <h1>We couldn&rsquo;t find that Forward Profile.</h1>
          <p>It may not exist, or its owner hasn&rsquo;t made it public.</p>
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="public-profile shell">
        <div className="public-profile-header">
          {profile.avatarUrl ? (
            <img className="public-profile-avatar" src={profile.avatarUrl} alt="" />
          ) : (
            <div className="public-profile-avatar public-profile-avatar-fallback" aria-hidden="true">
              {(profile.fullName || profile.username).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1>{profile.fullName || `@${profile.username}`}</h1>
            {profile.headline && <p className="public-profile-headline">{profile.headline}</p>}
            {profile.location && <p className="public-profile-location">{profile.location}</p>}
            <div className="public-profile-links">
              {isSafeHttpUrl(profile.linkedinUrl) && (
                <a href={profile.linkedinUrl!} target="_blank" rel="noopener noreferrer">LinkedIn</a>
              )}
              {isSafeHttpUrl(profile.portfolioUrl) && (
                <a href={profile.portfolioUrl!} target="_blank" rel="noopener noreferrer">Portfolio</a>
              )}
            </div>
          </div>
        </div>

        {profile.summary && (
          <section>
            <p>{profile.summary}</p>
          </section>
        )}

        {profile.employment.length > 0 && (
          <section>
            <h2>Experience</h2>
            {profile.employment.map((job, i) => (
              <div key={job.id ?? i}>
                <p className="public-profile-entry-title">{job.title}</p>
                <p>{job.company}</p>
                <p className="public-profile-entry-meta">{formatDateRange(job.start_date, job.end_date, job.current)}</p>
                {job.description && <p>{job.description}</p>}
              </div>
            ))}
          </section>
        )}

        {profile.education.length > 0 && (
          <section>
            <h2>Education</h2>
            {profile.education.map((edu, i) => (
              <div key={edu.id ?? i}>
                <p className="public-profile-entry-title">{edu.degree}{edu.field ? `, ${edu.field}` : ''}</p>
                <p>{edu.institution}{edu.graduation_year ? ` — ${edu.graduation_year}` : ''}</p>
              </div>
            ))}
          </section>
        )}

        {profile.certifications.length > 0 && (
          <section>
            <h2>Certifications</h2>
            {profile.certifications.map((cert, i) => (
              <div key={cert.id ?? i}>
                <p className="public-profile-entry-title">{cert.name}</p>
                <p>{cert.issuer}{cert.date ? ` — ${cert.date}` : ''}</p>
              </div>
            ))}
          </section>
        )}

        {profile.skills.length > 0 && (
          <section>
            <h2>Skills</h2>
            <div className="public-profile-skills">
              {profile.skills.map((skill) => (
                <span key={skill} className="public-profile-skill-pill">{skill}</span>
              ))}
            </div>
          </section>
        )}

        {profile.careerGoals && (
          <section>
            <h2>Career Goals</h2>
            <p>{profile.careerGoals}</p>
          </section>
        )}
      </div>
    </main>
  )
}
