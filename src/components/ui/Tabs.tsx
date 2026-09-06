type Tab = { id: string; label: string }

type TabsProps = {
  tabs: Tab[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeId, onChange, className = '' }: TabsProps) {
  return (
    <div role="tablist" className={`flex gap-1 border-b border-border ${className}`}>
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              active ? 'border-primary-400 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
