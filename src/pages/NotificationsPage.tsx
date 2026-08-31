import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/communication'
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_ICONS,
} from '@/types'
import { timeAgo, cn } from '@/lib/utils'
import {
  MessageSquare, Search, AlertCircle, FileText, Calendar,
  Clock, User, FileCheck, CreditCard, Bell, CheckCheck,
  Loader2, CheckCircle2, ExternalLink, Filter,
} from 'lucide-react'
import type { Notification } from '@/types'

const iconMap: Record<string, typeof Bell> = {
  MessageSquare,
  Search,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
  User,
  FileCheck,
  CreditCard,
  Bell,
}

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    loadNotifications()
  }, [user])

  const loadNotifications = async () => {
    if (!user) return
    const data = await getNotifications(user.id)
    setNotifications(data)
    setLoading(false)
  }

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Build filter options from available notification types
  const availableTypes = Array.from(new Set(notifications.map((n) => n.notification_type)))

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications.filter((n) => n.notification_type === filter)

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Stay up to date on your career search activity.
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 border border-primary-300 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex flex-shrink-0 items-center gap-2 border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Filter className="h-3.5 w-3.5" />
          Filter:
        </span>
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'border-b-2 px-3 py-1.5 font-mono text-xs font-medium transition-colors',
            filter === 'all'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          )}
          aria-pressed={filter === 'all'}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn(
            'border-b-2 px-3 py-1.5 font-mono text-xs font-medium transition-colors',
            filter === 'unread'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          )}
          aria-pressed={filter === 'unread'}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
        {availableTypes.map((type) => {
          const label = NOTIFICATION_TYPE_LABELS[type] || type
          const IconName = NOTIFICATION_TYPE_ICONS[type]
          const Icon = IconName ? iconMap[IconName] : null
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-1.5 font-mono text-xs font-medium transition-colors',
                filter === type
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              )}
              aria-pressed={filter === type}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {label}
            </button>
          )
        })}
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            {filter === 'unread'
              ? "You're all caught up! No unread notifications."
              : "No notifications yet. You'll see updates here as your career search progresses."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => {
            const IconName = NOTIFICATION_TYPE_ICONS[notification.notification_type]
            const Icon = IconName ? iconMap[IconName] : Bell
            const label = NOTIFICATION_TYPE_LABELS[notification.notification_type] || notification.notification_type
            return (
              <div
                key={notification.id}
                className={cn(
                  'border bg-white p-5 transition-colors border-l-4',
                  notification.is_read ? 'border-neutral-200 border-l-neutral-300' : 'border-primary-200 border-l-primary-600 bg-primary-50/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={cn(
                      'mt-0.5 h-5 w-5 flex-shrink-0',
                      notification.is_read ? 'text-neutral-500' : 'text-primary-600'
                    )}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="border border-neutral-300 px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                        {label}
                      </span>
                      {!notification.is_read && (
                        <span className="flex items-center gap-1 border border-primary-300 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                          New
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-serif text-base font-semibold text-neutral-900">
                      {notification.title}
                    </h3>
                    {notification.body && (
                      <p className="mt-1 text-sm text-neutral-600">{notification.body}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-neutral-400">
                        {timeAgo(notification.created_at)}
                      </span>
                      {notification.link && (
                        <a
                          href={notification.link}
                          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkRead(notification.id)}
                          className="flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-primary-600"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </MemberLayout>
  )
}
