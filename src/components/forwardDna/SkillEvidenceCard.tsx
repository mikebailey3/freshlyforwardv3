import { useState } from 'react'
import type { CareerSkill, SkillState } from '@/types/forwardDna'

const STATE_LABELS: Record<SkillState, string> = {
  claimed: 'Claimed',
  demonstrated: 'Demonstrated',
  supported: 'Supported',
}

const STATE_ORDER: SkillState[] = ['claimed', 'demonstrated', 'supported']

interface SkillEvidenceCardProps {
  skills: CareerSkill[]
  onChangeState: (skillName: string, state: SkillState) => Promise<void>
}

export function SkillEvidenceCard({ skills, onChangeState }: SkillEvidenceCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-6">
      <h3 className="font-serif text-base font-semibold text-neutral-900">Skills</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Claimed = you say you have it. Demonstrated = you've used it on the job. Supported = a strategist or reference has backed it up.
      </p>
      <div className="mt-4 space-y-3">
        {skills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} onChangeState={onChangeState} />
        ))}
      </div>
    </div>
  )
}

function SkillRow({ skill, onChangeState }: { skill: CareerSkill; onChangeState: SkillEvidenceCardProps['onChangeState'] }) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (state: SkillState) => {
    setSaving(true)
    try {
      await onChangeState(skill.skill_name, state)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
      <span className="font-mono text-sm font-medium text-primary-700">{skill.skill_name}</span>
      <div className="flex gap-1">
        {STATE_ORDER.map((state) => (
          <button
            key={state}
            disabled={saving}
            onClick={() => handleChange(state)}
            className={`px-2.5 py-1 text-xs font-semibold ${skill.state === state ? 'bg-primary-600 text-white' : 'border border-neutral-300 text-neutral-600 hover:border-primary-300'}`}
          >
            {STATE_LABELS[state]}
          </button>
        ))}
      </div>
    </div>
  )
}
