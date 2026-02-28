import { createFileRoute } from '@tanstack/react-router'
import { useStore } from '@livestore/react'
import { queryDb } from '@livestore/livestore'
import { useEffect, useMemo, useState } from 'react'
import { events, tables, type JournalMainFocus } from '@ordo/shared/livestore-schema'
import { requireAuthSession } from '@/lib/auth-guards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/journal')({
  component: JournalPage,
  beforeLoad: requireAuthSession,
})

type JournalFormState = {
  feeling: 1 | 2 | 3 | 4
  sleepQuality: 1 | 2 | 3 | 4
  mainFocus: JournalMainFocus
  entryContent: string
}

const DEFAULT_FORM: JournalFormState = {
  feeling: 3,
  sleepQuality: 3,
  mainFocus: 'projects',
  entryContent: '<p></p>',
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function journalIdForDateKey(dateKey: string) {
  return Number(dateKey.replaceAll('-', ''))
}

function formatDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function JournalPage() {
  const { store } = useStore()
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [form, setForm] = useState<JournalFormState>(DEFAULT_FORM)
  const [saveState, setSaveState] = useState<'saved' | 'unsaved' | 'saving'>('saved')

  const journalEntries$ = useMemo(
    () => queryDb(() => tables.journalEntries.where({}), { label: 'journal-entries' }),
    []
  )

  const allEntries = store.useQuery(journalEntries$)
  const entries = useMemo(
    () => [...allEntries].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [allEntries]
  )

  const todayKey = getDateKey()
  const todayEntry = entries.find(entry => entry.dateKey === todayKey) ?? null
  const selectedEntry = entries.find(entry => entry.id === selectedEntryId) ?? null

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedEntryId(null)
      setForm(DEFAULT_FORM)
      setSaveState('saved')
      return
    }

    if (selectedEntryId !== null && entries.some(entry => entry.id === selectedEntryId)) {
      return
    }

    setSelectedEntryId((todayEntry ?? entries[0]).id)
  }, [entries, selectedEntryId, todayEntry])

  useEffect(() => {
    if (!selectedEntry) {
      setForm(DEFAULT_FORM)
      setSaveState('saved')
      return
    }

    setForm({
      feeling: Math.min(4, Math.max(1, selectedEntry.feeling)) as 1 | 2 | 3 | 4,
      sleepQuality: Math.min(4, Math.max(1, selectedEntry.sleepQuality)) as 1 | 2 | 3 | 4,
      mainFocus: selectedEntry.mainFocus as JournalMainFocus,
      entryContent: selectedEntry.entryContent || '<p></p>',
    })
    setSaveState('saved')
  }, [selectedEntry])

  const isDirty = selectedEntry
    ? selectedEntry.feeling !== form.feeling ||
      selectedEntry.sleepQuality !== form.sleepQuality ||
      selectedEntry.mainFocus !== form.mainFocus ||
      selectedEntry.entryContent !== form.entryContent
    : false

  useEffect(() => {
    if (!selectedEntry) {
      setSaveState('saved')
      return
    }

    setSaveState(isDirty ? 'unsaved' : 'saved')
  }, [isDirty, selectedEntry])

  const recordHistory = (action: string, entityId: number, entityText: string) => {
    const timestamp = Date.now()
    store.commit(
      events.historyRecorded({
        id: timestamp,
        action,
        entityType: 'journal',
        entityId,
        entityText,
        timestamp,
      })
    )
  }

  const createTodayEntry = () => {
    if (todayEntry) {
      setSelectedEntryId(todayEntry.id)
      return
    }

    const dateKey = todayKey
    const id = journalIdForDateKey(dateKey)
    const timestamp = Date.now()

    store.commit(
      events.journalEntryCreated({
        id,
        dateKey,
        feeling: DEFAULT_FORM.feeling,
        sleepQuality: DEFAULT_FORM.sleepQuality,
        mainFocus: DEFAULT_FORM.mainFocus,
        entryContent: DEFAULT_FORM.entryContent,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    )

    recordHistory('Created', id, `Journal ${dateKey}`)
    setSelectedEntryId(id)
  }

  const saveEntry = () => {
    if (!selectedEntry || !isDirty) return

    setSaveState('saving')
    const timestamp = Date.now()
    store.commit(
      events.journalEntryUpdated({
        id: selectedEntry.id,
        feeling: form.feeling,
        sleepQuality: form.sleepQuality,
        mainFocus: form.mainFocus,
        entryContent: form.entryContent,
        updatedAt: timestamp,
      })
    )
    recordHistory('Updated', selectedEntry.id, `Journal ${selectedEntry.dateKey}`)
    setSaveState('saved')
  }

  const deleteEntry = (id: number) => {
    const target = entries.find(entry => entry.id === id)
    if (!target) return

    store.commit(events.journalEntryDeleted({ id }))
    recordHistory('Deleted', id, `Journal ${target.dateKey}`)

    if (selectedEntryId === id) {
      setSelectedEntryId(null)
    }
  }

  const FOCUS_OPTIONS: JournalMainFocus[] = ['projects', 'research', 'exercise', 'recovery']

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal</h1>
          <p className="mt-1 text-sm text-muted-foreground">One entry per day. You can edit or delete any previous entry.</p>
        </div>
        <Button onClick={createTodayEntry} disabled={Boolean(todayEntry)}>
          {todayEntry ? 'Today entry created' : 'Create today entry'}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Entries</CardTitle>
            <CardDescription>{entries.length} total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEntryId(entry.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedEntryId(entry.id)
                  }
                }}
                className={cn(
                  'cursor-pointer rounded-lg border px-3 py-2 transition-colors',
                  selectedEntryId === entry.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-muted/40'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{formatDateKey(entry.dateKey)}</p>
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation()
                      deleteEntry(entry.id)
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Focus: {entry.mainFocus}</p>
              </div>
            ))}

            {entries.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No entries yet. Start by creating today&apos;s entry.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{selectedEntry ? formatDateKey(selectedEntry.dateKey) : 'Select an entry'}</CardTitle>
                <CardDescription>Daily reflection and focus tracking</CardDescription>
              </div>
              <span
                className={cn(
                  'inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-xs font-medium',
                  saveState === 'saved' && 'bg-secondary text-secondary-foreground',
                  saveState === 'unsaved' && 'bg-muted text-muted-foreground',
                  saveState === 'saving' && 'bg-primary/15 text-primary'
                )}
              >
                {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Unsaved'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedEntry ? (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">How are you feeling? (1-4)</h3>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4].map(value => (
                      <Button
                        key={`feeling-${value}`}
                        variant={form.feeling === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setForm(current => ({ ...current, feeling: value as 1 | 2 | 3 | 4 }))}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">How did you sleep last night? (1-4)</h3>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4].map(value => (
                      <Button
                        key={`sleep-${value}`}
                        variant={form.sleepQuality === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setForm(current => ({ ...current, sleepQuality: value as 1 | 2 | 3 | 4 }))}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">What&apos;s your main focus today?</h3>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map(option => (
                      <Button
                        key={option}
                        variant={form.mainFocus === option ? 'default' : 'outline'}
                        size="sm"
                        className="capitalize"
                        onClick={() => setForm(current => ({ ...current, mainFocus: option }))}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Daily entry</h3>
                  <SimpleEditor
                    content={form.entryContent}
                    onChange={html => setForm(current => ({ ...current, entryContent: html }))}
                  />
                </section>

                <div className="flex justify-end">
                  <Button onClick={saveEntry} disabled={!isDirty}>Save entry</Button>
                </div>
              </>
            ) : (
              <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Select an entry from the list or create today&apos;s entry.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
