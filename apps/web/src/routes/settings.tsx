import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { requireAuthSession } from '@/lib/auth-guards'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useStore } from '@livestore/react'
import { tables } from '@ordo/shared/livestore-schema'
import { queryDb } from '@livestore/livestore'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  beforeLoad: requireAuthSession,
})

const ACTION_STYLES: Record<string, string> = {
  Created: 'bg-secondary text-secondary-foreground',
  Completed: 'bg-accent text-accent-foreground',
  Uncompleted: 'bg-muted text-muted-foreground',
  Deleted: 'bg-destructive/15 text-destructive',
  Updated: 'bg-primary/15 text-primary',
}

const ENTITY_STYLES: Record<string, string> = {
  task: 'bg-muted text-muted-foreground',
  project: 'bg-secondary text-secondary-foreground',
  notebook: 'bg-accent text-accent-foreground',
  note: 'bg-primary/15 text-primary',
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SettingsPage() {
  const { user: sessionUser, isLoading } = useCurrentUser()
  const { store } = useStore()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const history$ = useMemo(
    () => queryDb(() => tables.history.where({}), { label: 'history' }),
    []
  )
  const historyRows = store.useQuery(history$)
  const sortedHistory = [...historyRows].sort((a, b) => b.timestamp - a.timestamp)

  const user = sessionUser?.id && sessionUser?.email
    ? {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      image: sessionUser.image,
    }
    : null

  if (isLoading) {
    return (
      <div className="h-full text-foreground flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-full text-foreground flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Unable to load user information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 text-foreground">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="min-h-0 overflow-auto border-b border-border/60 p-4 lg:border-r lg:border-b-0">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">Settings</h1>

          <section className="rounded-xl border border-border/70 bg-card/70 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">User ID</label>
                <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-sm">{user.id}</div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">{user.email}</div>
              </div>

              {user.name && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">{user.name}</div>
                </div>
              )}

              {user.image && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-muted-foreground">Profile Picture</label>
                  <img src={user.image} alt="Profile" className="h-16 w-16 rounded-full border border-border/70" />
                </div>
              )}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-border/70 bg-card/70 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Appearance</h2>
            <p className="mb-3 text-sm text-muted-foreground">Choose how Ordo looks. Default follows your device setting.</p>

            <div className="inline-flex w-full gap-2 rounded-lg border border-border/70 bg-muted/30 p-1">
              {(['system', 'light', 'dark'] as const).map(mode => (
                <Button
                  key={mode}
                  size="sm"
                  variant={theme === mode ? 'default' : 'ghost'}
                  onClick={() => setTheme(mode)}
                  className="h-8 flex-1 capitalize"
                >
                  {mode}
                </Button>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">Current mode: {mounted ? (resolvedTheme ?? 'system') : 'system'}</p>
          </section>
        </aside>

        <section className="min-h-0 overflow-auto p-4 lg:p-6">
          <div className="mb-6 rounded-xl border border-border/70 bg-card/70 p-4 lg:p-5">
            <h2 className="mb-1 text-lg font-semibold">Activity History</h2>
            <p className="text-sm text-muted-foreground">{sortedHistory.length} events recorded</p>
          </div>

          {sortedHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
              No activity yet. Create some tasks, notes, or projects to populate your timeline.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/60 px-3 py-2"
                >
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[entry.action] ?? 'bg-muted text-muted-foreground'}`}>
                      {entry.action}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ENTITY_STYLES[entry.entityType] ?? 'bg-muted text-muted-foreground'}`}>
                      {entry.entityType}
                    </span>
                  </div>
                  <span className="flex-1 truncate text-sm text-foreground/90">{entry.entityText}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-border/70 bg-card/60 p-4">
            <h2 className="mb-2 text-lg font-semibold">Application</h2>
            <p className="text-sm text-muted-foreground">
              <strong>Ordo</strong> - Your personal task management workspace.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Built with React, TanStack Router, LiveStore, and oRPC.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
