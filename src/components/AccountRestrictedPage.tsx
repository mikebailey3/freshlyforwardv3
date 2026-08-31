import { useAuth } from '@/context/AuthContext'
import { ShieldAlert, LogOut, Mail } from 'lucide-react'

interface AccountRestrictedPageProps {
  status: 'suspended' | 'banned'
  reason: string | null
}

export function AccountRestrictedPage({ status, reason }: AccountRestrictedPageProps) {
  const { signOut } = useAuth()

  const title = status === 'banned' ? 'Your account has been banned' : 'Your account is suspended'
  const body =
    status === 'banned'
      ? 'Access to FreshlyForward has been permanently revoked for this account.'
      : 'Your access to FreshlyForward has been temporarily paused.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md border border-neutral-200 border-l-4 border-l-error-600 bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-error-600" />
        <h1 className="mt-4 font-serif text-xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{body}</p>
        {reason && (
          <div className="mt-4 border border-neutral-200 bg-neutral-50 p-3 text-left text-sm text-neutral-700">
            <p className="text-xs font-semibold text-neutral-500">Reason provided</p>
            <p className="mt-1">{reason}</p>
          </div>
        )}
        <p className="mt-4 text-xs text-neutral-500">
          If you believe this is a mistake, please reach out to our support team for assistance.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href="mailto:support@freshlyforward.com"
            className="flex items-center justify-center gap-1.5 border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </a>
          <button
            onClick={() => signOut()}
            className="flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
