import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { queryDb } from '@livestore/livestore'
import { useStore } from '@livestore/react'
import { useMemo } from 'react'
import { tables } from '@ordo/shared/livestore-schema'
import { Button } from '@/components/ui/button'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/journal/timeline')({
  component: JournalTimelinePage,
  beforeLoad: requireAuthSession,
})

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

function moodLabel(value: number) {
  if (value <= 1) return { emoji: '☹', label: 'Low' }
  if (value === 2) return { emoji: '◔', label: 'Off' }
  if (value === 3) return { emoji: '◕', label: 'Okay' }
  return { emoji: '☺', label: 'Great' }
}

function JournalTimelinePage() {
  const navigate = useNavigate()
  const { store } = useStore()
  const journalEntries$ = useMemo(() => queryDb(() => tables.journalEntries.where({}), { label: 'journal-entries' }), [])
  const allEntries = store.useQuery(journalEntries$)
  const entries = useMemo(() => [...allEntries].sort((a, b) => b.dateKey.localeCompare(a.dateKey)), [allEntries])

  return (
    <div className="h-full min-h-0 overflow-auto px-6 pb-16 pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-foreground/90">Journal Timeline</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review all entries in reverse chronological order.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate({ to: '/journal/dashboard' })}>Dashboard</Button>
            <Button onClick={() => navigate({ to: '/journal/daily-entry' })}>Daily Entry</Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-content-background/25 p-8 text-center">
            <p className="text-muted-foreground">No entries yet. Start your first daily check-in.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => {
              const note = stripHtml(entry.entryContent)
              const mood = moodLabel(entry.feeling)
              return (
                <article key={entry.id} className="rounded-2xl border border-border/70 bg-content-background/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{formatDate(entry.dateKey)}</p>
                      <p className="mt-1 text-sm text-foreground/85">Focus: <span className="capitalize">{entry.mainFocus}</span></p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                      <span>{mood.emoji}</span>
                      <span>{mood.label}</span>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-foreground/85">
                    {note || 'No written note for this day.'}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
