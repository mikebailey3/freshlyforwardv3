import { Link } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { TOOL_TILES } from '@/data/tools'
import { Sparkles } from 'lucide-react'

export function ToolsPage() {
  return (
    <MemberLayout>
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary-600" />
        <div>
          <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">Tools</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Everything you need to plan, prep, and manage your job search in one place.
          </p>
        </div>
      </div>

      <div className="border border-neutral-200 bg-white">
        {TOOL_TILES.map((tool, i) => (
          <Link
            key={tool.label}
            to={tool.to}
            className={`flex items-center gap-4 p-5 transition-colors hover:bg-neutral-50 ${i !== TOOL_TILES.length - 1 ? 'border-b border-dashed border-neutral-200' : ''}`}
          >
            <tool.icon className="h-5 w-5 flex-shrink-0 text-primary-600" />
            <div className="flex-1">
              <h3 className="font-serif text-sm font-semibold text-neutral-900">{tool.label}</h3>
              <p className="mt-1 text-xs text-neutral-600">{tool.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </MemberLayout>
  )
}
