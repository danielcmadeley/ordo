import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/crm')({
  component: CrmPage,
  beforeLoad: requireAuthSession,
})

const apiBase = import.meta.env.VITE_API_URL || ''

type XStatusResponse = {
  connected: boolean
  username?: string
  xUserId?: string
  profilePending?: boolean
}

type BookmarkItem = {
  id: string
  text: string
  created_at?: string
  author_id?: string
  attachments?: {
    media_keys?: string[]
  }
}

type BookmarkMedia = {
  media_key: string
  type: 'photo' | 'video' | 'animated_gif' | string
  url?: string
  preview_image_url?: string
  alt_text?: string
  width?: number
  height?: number
}

type BookmarksResponse = {
  data?: BookmarkItem[]
  includes?: {
    users?: Array<{ id: string; username: string; name?: string; profile_image_url?: string }>
    media?: BookmarkMedia[]
  }
  meta?: {
    next_token?: string
    previous_token?: string
    result_count?: number
  }
  error?: string
}

type ScheduledPost = {
  id: string
  text: string
  scheduledFor: number
  status: 'pending' | 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
  attemptCount: number
  lastError: string | null
  xTweetId: string | null
  sentAt: number | null
  cancelledAt: number | null
  createdAt: number
  updatedAt: number
}

function toLocalDateTimeInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  const json = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) {
    throw new Error(json.error || 'Request failed')
  }
  return json
}

function CrmPage() {
  const [status, setStatus] = useState<XStatusResponse>({ connected: false })
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [composerText, setComposerText] = useState('')
  const [postState, setPostState] = useState<'idle' | 'posting' | 'posted'>('idle')
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [usersById, setUsersById] = useState<Record<string, { username: string; name?: string }>>({})
  const [mediaByKey, setMediaByKey] = useState<Record<string, BookmarkMedia>>({})
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [bookmarksLoading, setBookmarksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scheduleText, setScheduleText] = useState('')
  const [scheduleAt, setScheduleAt] = useState(() => {
    const date = new Date(Date.now() + 10 * 60_000)
    date.setSeconds(0, 0)
    return toLocalDateTimeInputValue(date)
  })
  const queryClient = useQueryClient()
  const isDev = import.meta.env.DEV

  const queryParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const queryStatus = queryParams.get('x')
  const queryReason = queryParams.get('x_reason')
  const queryHttpStatus = queryParams.get('x_http_status')
  const isConnectedStatus = queryStatus === 'connected' || queryStatus === 'connected_profile_pending'
  const hasCallbackError = Boolean(queryStatus && !isConnectedStatus)
  const hasProfilePending = queryStatus === 'connected_profile_pending'

  useEffect(() => {
    if (!hasCallbackError) return
    const parts = [
      `X OAuth callback failed (${queryStatus}).`,
      queryHttpStatus ? `HTTP ${queryHttpStatus}.` : '',
      queryReason || '',
    ].filter(Boolean)
    setError(parts.join(' '))
  }, [hasCallbackError, queryHttpStatus, queryReason, queryStatus])

  const loadStatus = async () => {
    setLoadingStatus(true)
    try {
      const data = await apiRequest<XStatusResponse>('/api/x/status')
      setStatus(data)
      if (!hasCallbackError) {
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load X connection status')
    } finally {
      setLoadingStatus(false)
    }
  }

  const loadBookmarks = async (token?: string, reset = false) => {
    if (!status.connected) return
    setBookmarksLoading(true)
    try {
      const query = new URLSearchParams()
      query.set('max_results', '10')
      if (token) query.set('pagination_token', token)
      const data = await apiRequest<BookmarksResponse>(`/api/x/bookmarks?${query.toString()}`)
      const mappedUsers = (data.includes?.users || []).reduce<Record<string, { username: string; name?: string }>>((acc, user) => {
        acc[user.id] = { username: user.username, name: user.name }
        return acc
      }, {})
      const mappedMedia = (data.includes?.media || []).reduce<Record<string, BookmarkMedia>>((acc, media) => {
        acc[media.media_key] = media
        return acc
      }, {})
      setUsersById((current) => ({ ...current, ...mappedUsers }))
      setMediaByKey((current) => ({ ...current, ...mappedMedia }))
      setBookmarks((current) => (reset ? (data.data || []) : [...current, ...(data.data || [])]))
      setNextToken(data.meta?.next_token || null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bookmarks')
    } finally {
      setBookmarksLoading(false)
    }
  }

  const refreshBookmarks = async () => {
    if (!status.connected) return
    try {
      await apiRequest<{ queued: boolean }>('/api/x/bookmarks/refresh', { method: 'POST' })
      await loadBookmarks(undefined, true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh bookmarks')
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  useEffect(() => {
    if (status.connected) {
      void loadBookmarks(undefined, true)
    } else {
      setBookmarks([])
      setUsersById({})
      setMediaByKey({})
      setNextToken(null)
    }
  }, [status.connected])

  const connectX = () => {
    const returnTo = window.location.href
    const connectUrl = `${apiBase}/api/x/connect?returnTo=${encodeURIComponent(returnTo)}`
    window.location.href = connectUrl
  }

  const disconnectX = async () => {
    try {
      await apiRequest('/api/x/disconnect', { method: 'POST' })
      setStatus({ connected: false })
      setComposerText('')
      setPostState('idle')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disconnect X account')
    }
  }

  const submitPost = async () => {
    const text = composerText.trim()
    if (!text) return
    setPostState('posting')
    try {
      await apiRequest('/api/x/post', {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      setComposerText('')
      setPostState('posted')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish post')
      setPostState('idle')
    }
  }

  const postLength = composerText.length
  const scheduleLength = scheduleText.length
  const scheduledPostsQueryKey = useMemo(() => ['x-scheduled-posts', status.connected] as const, [status.connected])

  const scheduledPostsQuery = useQuery({
    queryKey: scheduledPostsQueryKey,
    queryFn: () => apiRequest<{ items: ScheduledPost[] }>('/api/x/scheduled-posts?limit=50'),
    enabled: status.connected,
    refetchInterval: 20_000,
  })

  const schedulePostMutation = useMutation({
    mutationFn: (input: { text: string; scheduledFor: number }) => apiRequest<{ id: string; status: string }>('/api/x/scheduled-posts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduledPostsQueryKey })
    },
  })

  const cancelScheduledPostMutation = useMutation({
    mutationFn: (input: { id: string }) => apiRequest<{ ok: boolean }>(`/api/x/scheduled-posts/${input.id}/cancel`, {
      method: 'POST',
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduledPostsQueryKey })
    },
  })

  const submitScheduledPost = async () => {
    const text = scheduleText.trim()
    if (!text) return
    if (text.length > 280) {
      setError('Scheduled post text must be 280 characters or fewer')
      return
    }

    const scheduledFor = new Date(scheduleAt).getTime()
    if (!Number.isFinite(scheduledFor)) {
      setError('Choose a valid schedule date and time')
      return
    }

    if (scheduledFor < Date.now() + 60_000) {
      setError('Schedule time must be at least 1 minute in the future')
      return
    }

    try {
      await schedulePostMutation.mutateAsync({ text, scheduledFor })
      setScheduleText('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule post')
    }
  }

  const cancelScheduledPost = async (id: string) => {
    try {
      await cancelScheduledPostMutation.mutateAsync({ id })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel scheduled post')
    }
  }

  const runSchedulerNow = async () => {
    try {
      await apiRequest('/api/x/scheduled-posts/dispatch-due', { method: 'POST' })
      await scheduledPostsQuery.refetch()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run scheduler in local dev')
    }
  }

  const scheduledItems = (((scheduledPostsQuery.data as { items?: ScheduledPost[] } | undefined)?.items) || []) as ScheduledPost[]

  const statusClassName = (itemStatus: ScheduledPost['status']) => {
    if (itemStatus === 'sent') return 'bg-primary/15 text-primary'
    if (itemStatus === 'failed') return 'bg-destructive/15 text-destructive'
    if (itemStatus === 'cancelled') return 'bg-muted text-muted-foreground'
    if (itemStatus === 'sending') return 'bg-amber-500/15 text-amber-700'
    return 'bg-secondary text-secondary-foreground'
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="mt-2 text-muted-foreground">Connect your X account, publish text posts, and review your bookmarks.</p>
          {queryStatus === 'connected' && (
            <p className="mt-2 text-sm text-primary">Your X account is connected.</p>
          )}
          {hasProfilePending && (
            <p className="mt-2 text-sm text-amber-600">
              Connected, but profile lookup is temporarily unavailable.
              {queryHttpStatus ? ` HTTP ${queryHttpStatus}.` : ''}
              {queryReason ? ` ${queryReason}` : ''}
            </p>
          )}
        </div>

        <section className="rounded-xl border border-border/70 bg-card/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">X Connection</h2>
              {loadingStatus ? (
                <p className="text-sm text-muted-foreground">Checking connection...</p>
              ) : status.connected ? (
                <p className="text-sm text-muted-foreground">
                  {status.profilePending ? 'Connected to X (profile pending)' : `Connected as @${status.username}`}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No X account connected.</p>
              )}
            </div>
            {status.connected ? (
              <Button variant="outline" onClick={() => { void disconnectX() }}>Disconnect X</Button>
            ) : (
              <Button onClick={connectX}>Connect X</Button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Schedule One-Time Post</h2>
            <span className={`text-xs ${scheduleLength > 280 ? 'text-destructive' : 'text-muted-foreground'}`}>{scheduleLength}/280</span>
          </div>

          <Textarea
            value={scheduleText}
            onChange={(event) => setScheduleText(event.target.value)}
            rows={4}
            placeholder={status.connected ? 'Write the post you want to publish later...' : 'Connect X to schedule posts.'}
            disabled={!status.connected || schedulePostMutation.isPending}
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm text-muted-foreground">
              Schedule for
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                disabled={!status.connected || schedulePostMutation.isPending}
              />
            </label>
            <Button
              onClick={() => { void submitScheduledPost() }}
              disabled={!status.connected || schedulePostMutation.isPending || !scheduleText.trim() || scheduleLength > 280}
            >
              {schedulePostMutation.isPending ? 'Scheduling...' : 'Schedule Post'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Posts are sent within about one minute of the scheduled time.</p>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scheduled Timeline</h3>
              <div className="flex items-center gap-2">
                {isDev && status.connected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { void runSchedulerNow() }}
                    disabled={scheduledPostsQuery.isFetching}
                  >
                    Run scheduler now
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { void scheduledPostsQuery.refetch() }}
                  disabled={!status.connected || scheduledPostsQuery.isFetching}
                >
                  {scheduledPostsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
            </div>

            {!status.connected ? (
              <p className="text-sm text-muted-foreground">Connect X to schedule and track posts.</p>
            ) : scheduledPostsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading scheduled posts...</p>
            ) : scheduledItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled posts yet.</p>
            ) : (
              <div className="space-y-2">
                {scheduledItems.map((item) => (
                  <article key={item.id} className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName(item.status)}`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Scheduled {new Date(item.scheduledFor).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{item.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Attempts: {item.attemptCount}</span>
                      {item.sentAt && <span>Sent {new Date(item.sentAt).toLocaleString()}</span>}
                      {item.lastError && <span className="text-destructive">{item.lastError}</span>}
                      {item.xTweetId && (
                        <a
                          className="text-primary hover:underline"
                          href={`https://x.com/i/web/status/${item.xTweetId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open sent post
                        </a>
                      )}
                    </div>
                    {(item.status === 'pending' || item.status === 'queued') && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { void cancelScheduledPost(item.id) }}
                          disabled={cancelScheduledPostMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Publish Text Post</h2>
            <span className={`text-xs ${postLength > 280 ? 'text-destructive' : 'text-muted-foreground'}`}>{postLength}/280</span>
          </div>
          <Textarea
            value={composerText}
            onChange={(event) => {
              setComposerText(event.target.value)
              if (postState === 'posted') setPostState('idle')
            }}
            rows={6}
            placeholder={status.connected ? 'Write your post...' : 'Connect X to post.'}
            disabled={!status.connected || postState === 'posting'}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Text-only posting enabled for v1.</span>
            <Button
              onClick={() => { void submitPost() }}
              disabled={!status.connected || postState === 'posting' || !composerText.trim() || postLength > 280}
            >
              {postState === 'posting' ? 'Posting...' : 'Post to X'}
            </Button>
          </div>
          {postState === 'posted' && <p className="mt-2 text-sm text-primary">Post published successfully.</p>}
        </section>

        <section className="rounded-xl border border-border/70 bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Bookmarks</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void refreshBookmarks() }}
              disabled={!status.connected || bookmarksLoading}
            >
              Refresh
            </Button>
          </div>

          {!status.connected ? (
            <p className="text-sm text-muted-foreground">Connect X to view your bookmarks.</p>
          ) : bookmarksLoading && bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading bookmarks...</p>
          ) : bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookmarks found.</p>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => {
                const author = bookmark.author_id ? usersById[bookmark.author_id] : undefined
                const media = (bookmark.attachments?.media_keys || [])
                  .map((key) => mediaByKey[key])
                  .filter(Boolean)
                return (
                  <article key={bookmark.id} className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <p className="text-sm leading-6 text-foreground/90 whitespace-pre-wrap">{bookmark.text}</p>
                    {media.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {media.map((item) => {
                          const src = item.url || item.preview_image_url
                          if (!src) return null
                          return (
                            <a
                              key={item.media_key}
                              href={`https://x.com/i/web/status/${bookmark.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-md border border-border/60 bg-muted/30"
                            >
                              <img
                                src={src}
                                alt={item.alt_text || `Bookmark media (${item.type})`}
                                className="h-48 w-full object-cover"
                                loading="lazy"
                              />
                            </a>
                          )
                        })}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {author?.username && <span>@{author.username}</span>}
                      {bookmark.created_at && <span>{new Date(bookmark.created_at).toLocaleString()}</span>}
                      <a
                        className="text-primary hover:underline"
                        href={`https://x.com/i/web/status/${bookmark.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open on X
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {status.connected && nextToken && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => { void loadBookmarks(nextToken, false) }}
                disabled={bookmarksLoading}
              >
                {bookmarksLoading ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
