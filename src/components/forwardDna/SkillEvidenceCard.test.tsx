import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SkillEvidenceCard } from './SkillEvidenceCard'

describe('SkillEvidenceCard', () => {
  it('highlights the current state and calls onChangeState when a new one is picked', () => {
    const onChangeState = vi.fn().mockResolvedValue(undefined)
    render(
      <SkillEvidenceCard
        skills={[{ id: 'k1', user_id: 'u1', skill_name: 'excel', state: 'claimed', evidence_note: null, created_at: '', updated_at: '' }]}
        onChangeState={onChangeState}
      />
    )
    expect(screen.getByText('excel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demonstrated' }))
    expect(onChangeState).toHaveBeenCalledWith('excel', 'demonstrated')
  })
})
