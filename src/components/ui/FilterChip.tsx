type FilterChipProps = {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export function FilterChip({ label, active = false, onClick, className = '' }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary-400 bg-primary-950 text-primary-300'
          : 'border-border text-ink-muted hover:border-primary-400 hover:text-ink'
      } ${className}`}
    >
      {label}
    </button>
  )
}
