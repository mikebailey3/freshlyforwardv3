import { User } from 'lucide-react'

export type ChatPreviewMessage = { from: 'member' | 'strategist'; text: string }

export interface ChatPreviewCardProps {
  label: string
  messages: ChatPreviewMessage[]
}

// Mirrors the real message-bubble styling from MessagesPage.tsx (same
// rounded-2xl/px-4/py-2.5 bubble, same bg-primary-600 vs bg-neutral-100
// split) so this preview looks like the actual product, not an invented
// visual language. Content is illustrative only -- never a real client
// conversation, always labeled "Sample".
export function ChatPreviewCard({ label, messages }: ChatPreviewCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5">
      <div className="h-1.5 bg-primary-600" aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">{label}</p>
          <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-neutral-500">
            Sample
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-2 max-w-[85%] ${message.from === 'member' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100">
                <User className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              </div>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.from === 'member' ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-900'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
