import { describe, it, expect } from 'vitest'
import { extractMustHaveSkills, extractNiceToHaveSkills, mustHaveSkillsHardConstraint } from './qualifications'
import type { MemberProfile, ScrapedJob } from '@/types'
import type { CareerSkill } from '@/types/forwardDna'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return { skills: [], ...overrides } as MemberProfile
}
function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return { title: 'Data Analyst', description: '', ...overrides } as ScrapedJob
}

const JOB_WITH_SECTIONS = [
  'About Acme.',
  'Must Have:',
  '- SQL',
  '- Excel',
  'Nice to Have:',
  '- Python',
  '- Tableau experience',
].join('\n')

describe('extractMustHaveSkills', () => {
  it('extracts skills from a Must Have section, stopping at Nice to Have', () => {
    expect(extractMustHaveSkills(JOB_WITH_SECTIONS)).toEqual(expect.arrayContaining(['sql', 'excel']))
    expect(extractMustHaveSkills(JOB_WITH_SECTIONS)).not.toContain('python')
  })

  it('recognizes the "Requirements" heading variant', () => {
    const jobText = ['Requirements:', '- SQL', '- Excel', 'Benefits:', '- 401k'].join('\n')
    expect(extractMustHaveSkills(jobText)).toEqual(expect.arrayContaining(['sql', 'excel']))
  })

  it('returns [] when there is no must-have-style heading at all', () => {
    expect(extractMustHaveSkills('General role description with SQL mentioned casually.')).toEqual([])
  })
})

describe('extractNiceToHaveSkills', () => {
  it('extracts skills from a Nice to Have section, stopping at Must Have', () => {
    expect(extractNiceToHaveSkills(JOB_WITH_SECTIONS)).toEqual(expect.arrayContaining(['python']))
    expect(extractNiceToHaveSkills(JOB_WITH_SECTIONS)).not.toContain('sql')
  })

  it('recognizes the "Preferred Qualifications" heading variant', () => {
    const jobText = ['Must Have:', '- Excel', 'Preferred Qualifications:', '- Python'].join('\n')
    expect(extractNiceToHaveSkills(jobText)).toEqual(expect.arrayContaining(['python']))
  })

  it('returns [] when there is no nice-to-have-style heading at all', () => {
    expect(extractNiceToHaveSkills('General role description with Python mentioned casually.')).toEqual([])
  })
})

describe('mustHaveSkillsHardConstraint', () => {
  it('is unknown when the posting has no recognizable must-have section', () => {
    const result = mustHaveSkillsHardConstraint(makeProfile(), makeJob({ description: 'General role.' }), [])
    expect(result.status).toBe('unknown')
  })

  it('confirms met when the member has evidence for at least one stated must-have', () => {
    const result = mustHaveSkillsHardConstraint(
      makeProfile({ skills: ['sql'] }),
      makeJob({ description: 'Must Have:\n- SQL\n- Excel' }),
      []
    )
    expect(result.status).toBe('confirmed_match')
  })

  it('accepts a transferable match as sufficient coverage, not a block', () => {
    const result = mustHaveSkillsHardConstraint(
      makeProfile({ skills: ['data analysis'] }),
      makeJob({ description: 'Must Have:\n- SQL' }),
      []
    )
    expect(result.status).toBe('confirmed_match')
  })

  it('is unknown (never a false block) when the profile is too sparse to confirm absence', () => {
    const result = mustHaveSkillsHardConstraint(makeProfile({ skills: [] }), makeJob({ description: 'Must Have:\n- SQL\n- Excel' }), [])
    expect(result.status).toBe('unknown')
  })

  it('is hard_blocker only when every must-have skill is a confident, confirmed gap', () => {
    const wellDocumentedButUnrelated = ['welding', 'plumbing', 'hvac', 'construction', 'electrical']
    const result = mustHaveSkillsHardConstraint(
      makeProfile({ skills: wellDocumentedButUnrelated }),
      makeJob({ description: 'Must Have:\n- SQL\n- Excel' }),
      []
    )
    expect(result.status).toBe('hard_blocker')
    expect(result.reason).toContain('sql')
  })

  it('lets a Career Vault confirmed capability satisfy a must-have and avoid a block', () => {
    const wellDocumentedButUnrelated = ['welding', 'plumbing', 'hvac', 'construction', 'electrical']
    const result = mustHaveSkillsHardConstraint(
      makeProfile({ skills: wellDocumentedButUnrelated }),
      makeJob({ description: 'Must Have:\n- SQL\n- Excel' }),
      [],
      ['sql']
    )
    expect(result.status).toBe('confirmed_match')
  })

  it('reuses career_skills evidence the same way as scoreSkillsDimension does', () => {
    const wellDocumentedButUnrelated = ['welding', 'plumbing', 'hvac', 'construction', 'electrical']
    const careerSkills: CareerSkill[] = [
      { id: 's1', user_id: 'u1', skill_name: 'sql', state: 'demonstrated', evidence_note: null, created_at: '', updated_at: '' },
    ]
    const result = mustHaveSkillsHardConstraint(
      makeProfile({ skills: wellDocumentedButUnrelated }),
      makeJob({ description: 'Must Have:\n- SQL\n- Excel' }),
      careerSkills
    )
    expect(result.status).toBe('confirmed_match')
  })
})
