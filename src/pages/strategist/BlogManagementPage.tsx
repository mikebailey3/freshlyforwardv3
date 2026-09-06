import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StrategistLayout } from '@/components/StrategistLayout'
import { getAllPostsForStaff, deletePost } from '@/lib/blog'
import { cn, formatDate } from '@/lib/utils'
import {
  Newspaper, Plus, Search, Pencil, Trash2, Loader2, AlertCircle,
} from 'lucide-react'
import type { BlogPost, BlogPostStatus } from '@/types'

type StatusTab = 'all' | BlogPostStatus

const STATUS_BADGE: Record<BlogPostStatus, string> = {
  published: 'border-success-700 text-success-300',
  draft: 'border-border text-ink-muted',
  scheduled: 'border-warning-700 text-warning-300',
}

export function BlogManagementPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    setLoading(true)
    const data = await getAllPostsForStaff()
    setPosts(data)
    setLoading(false)
  }

  const counts = useMemo(() => {
    return {
      all: posts.length,
      published: posts.filter((p) => p.status === 'published').length,
      draft: posts.filter((p) => p.status === 'draft').length,
      scheduled: posts.filter((p) => p.status === 'scheduled').length,
    }
  }, [posts])

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesStatus = statusTab === 'all' || post.status === statusTab
      const matchesSearch = !searchQuery || post.title.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [posts, statusTab, searchQuery])

  const handleDelete = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return
    setDeletingId(post.id)
    const { error } = await deletePost(post.id)
    if (error) {
      setError(error)
    } else {
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    }
    setDeletingId(null)
  }

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'published', label: `Published (${counts.published})` },
    { key: 'draft', label: `Drafts (${counts.draft})` },
    { key: 'scheduled', label: `Scheduled (${counts.scheduled})` },
  ]

  if (loading) {
    return (
      <StrategistLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </StrategistLayout>
    )
  }

  return (
    <StrategistLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Blog Posts</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage everything published to The Forward Feed.</p>
        </div>
        <button
          onClick={() => navigate('/strategist/blog-posts/new')}
          className="flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add New Post
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 border border-error-700 border-l-4 border-l-error-500 bg-error-950 px-4 py-3 text-sm text-error-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 border border-border bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={cn(
                'border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                statusTab === tab.key ? 'border-primary-700 bg-primary-950 text-primary-300' : 'border-transparent text-ink-muted hover:bg-surface-hover',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            aria-label="Search posts by title"
            className="w-full border border-border bg-surface-card py-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
          />
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="border border-border bg-surface-card p-12 text-center">
          <Newspaper className="mx-auto h-10 w-10 text-ink-muted" />
          <p className="mt-4 text-sm text-ink-muted">
            {posts.length === 0 ? 'No posts yet. Write the first one!' : 'No posts match your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-border bg-surface-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-subtle text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Author</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Published</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="hover:bg-surface-hover">
                  <td className="max-w-xs truncate px-5 py-3.5 font-medium text-ink">{post.title}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{post.category}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{post.author_name || '\u2014'}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn('border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide', STATUS_BADGE[post.status])}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted">
                    {post.published_at ? formatDate(post.published_at) : '\u2014'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/strategist/blog-posts/${post.id}`}
                        className="flex items-center gap-1 border border-border px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(post)}
                        disabled={deletingId === post.id}
                        className="flex items-center gap-1 border border-error-700 px-2.5 py-1.5 text-xs font-medium text-error-400 transition-colors hover:bg-error-950 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StrategistLayout>
  )
}
