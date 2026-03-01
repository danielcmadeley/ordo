import { useForm } from '@tanstack/react-form'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { queryDb } from '@livestore/livestore'
import { useStore } from '@livestore/react'
import { useEffect, useMemo, useState } from 'react'
import { createStandardSchemaV1, parseAsNumberLiteral, useQueryState } from 'nuqs'
import { events, tables, type JournalMainFocus } from '@ordo/shared/livestore-schema'
import { Button } from '@/components/ui/button'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { requireAuthSession } from '@/lib/auth-guards'
import { cn } from '@/lib/utils'
import { useEmbedItem, stripHtml } from '@/lib/embed'

type JournalFormState = {
  feeling: 1 | 2 | 3 | 4 | null
  sleepQuality: 1 | 2 | 3 | 4 | null
  mainFocus: JournalMainFocus | null
  entryContent: string
}

type JournalStep = 0 | 1 | 2 | 3 | 4

const JOURNAL_STEPS = [0, 1, 2, 3, 4] as const

export const Route = createFileRoute('/journal/daily-entry')({
  validateSearch: createStandardSchemaV1({
    step: parseAsNumberLiteral(JOURNAL_STEPS),
  }, { partialOutput: true }),
  component: JournalDailyEntryPage,
  beforeLoad: requireAuthSession,
})

const DEFAULT_FORM: JournalFormState = {
  feeling: null,
  sleepQuality: null,
  mainFocus: null,
  entryContent: '<p></p>',
}

const FEELING_COPY: Record<1 | 2 | 3 | 4, string> = {
  1: 'I feel low.',
  2: 'I feel a bit off.',
  3: 'I feel ok.',
  4: 'I feel great.',
}

const SLEEP_COPY: Record<1 | 2 | 3 | 4, string> = {
  1: 'Sleep was rough.',
  2: 'Sleep was light.',
  3: 'Sleep was moderate.',
  4: 'Sleep was solid.',
}

const FEELING_FACES: Record<1 | 2 | 3 | 4, string> = {
  1: '☹',
  2: '◔',
  3: '◕',
  4: '☺',
}

const FOCUS_OPTIONS: JournalMainFocus[] = ['projects', 'research', 'exercise', 'recovery']

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

function hasMeaningfulContent(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
}

function getFirstIncompleteStep(progress: { feeling: boolean; sleep: boolean; focus: boolean; entry: boolean }): JournalStep {
  if (!progress.feeling) return 0
  if (!progress.sleep) return 1
  if (!progress.focus) return 2
  if (!progress.entry) return 3
  return 4
}

function calculateCurrentStreak(dateKeys: string[]) {
  const set = new Set(dateKeys)
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const yyyy = cursor.getFullYear()
    const mm = String(cursor.getMonth() + 1).padStart(2, '0')
    const dd = String(cursor.getDate()).padStart(2, '0')
    const key = `${yyyy}-${mm}-${dd}`
    if (!set.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function JournalDailyEntryPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { store } = useStore()
  const embed = useEmbedItem()
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [stepQuery, setStepQuery] = useQueryState(
    'step',
    parseAsNumberLiteral(JOURNAL_STEPS)
      .withDefault(0)
      .withOptions({ history: 'replace' })
  )
  const [saveState, setSaveState] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const [formValues, setFormValues] = useState<JournalFormState>(DEFAULT_FORM)
  const currentStep = stepQuery as JournalStep
  const hasStepInUrl = typeof search.step === 'number'

  const setCurrentStep = (step: JournalStep) => {
    void setStepQuery(step)
  }

  const form = useForm({
    defaultValues: DEFAULT_FORM,
  })

  const setFeeling = (value: 1 | 2 | 3 | 4) => {
    setFormValues(current => ({ ...current, feeling: value }))
    form.setFieldValue('feeling', value)
  }

  const setSleepQuality = (value: 1 | 2 | 3 | 4) => {
    setFormValues(current => ({ ...current, sleepQuality: value }))
    form.setFieldValue('sleepQuality', value)
  }

  const setMainFocus = (value: JournalMainFocus) => {
    setFormValues(current => ({ ...current, mainFocus: value }))
    form.setFieldValue('mainFocus', value)
  }

  const setEntryContent = (value: string) => {
    setFormValues(current => ({ ...current, entryContent: value }))
    form.setFieldValue('entryContent', value)
  }

  const journalEntries$ = useMemo(() => queryDb(() => tables.journalEntries.where({}), { label: 'journal-entries' }), [])
  const allEntries = store.useQuery(journalEntries$)
  const entries = useMemo(() => [...allEntries].sort((a, b) => b.dateKey.localeCompare(a.dateKey)), [allEntries])

  const todayKey = getDateKey()
  const todayEntry = entries.find(entry => entry.dateKey === todayKey) ?? null
  const selectedEntry = entries.find(entry => entry.id === selectedEntryId) ?? null

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedEntryId(null)
      form.reset(DEFAULT_FORM)
      setFormValues(DEFAULT_FORM)
      setCurrentStep(0)
      setSaveState('saved')
      return
    }

    if (selectedEntryId !== null && entries.some(entry => entry.id === selectedEntryId)) return

    setSelectedEntryId((todayEntry ?? entries[0]).id)
  }, [entries, form, selectedEntryId, todayEntry])

  useEffect(() => {
    if (!selectedEntry) {
      form.reset(DEFAULT_FORM)
      setFormValues(DEFAULT_FORM)
      setCurrentStep(0)
      setSaveState('saved')
      return
    }

    const nextValues: JournalFormState = {
      feeling: Math.min(4, Math.max(1, selectedEntry.feeling)) as 1 | 2 | 3 | 4,
      sleepQuality: Math.min(4, Math.max(1, selectedEntry.sleepQuality)) as 1 | 2 | 3 | 4,
      mainFocus: selectedEntry.mainFocus as JournalMainFocus,
      entryContent: selectedEntry.entryContent || '<p></p>',
    }
    form.reset(nextValues)
    setFormValues(nextValues)

    const entryFilled = hasMeaningfulContent(nextValues.entryContent)
    const hadEdited = selectedEntry.updatedAt !== selectedEntry.createdAt
    if (!hasStepInUrl) {
      setCurrentStep(
        getFirstIncompleteStep({
          feeling: hadEdited || selectedEntry.feeling !== 3 || entryFilled,
          sleep: hadEdited || selectedEntry.sleepQuality !== 3 || entryFilled,
          focus: hadEdited || selectedEntry.mainFocus !== 'projects' || entryFilled,
          entry: entryFilled,
        })
      )
    }
    setSaveState('saved')
  }, [form, hasStepInUrl, selectedEntry])

  const normalizedFeeling = formValues.feeling ?? 3
  const normalizedSleepQuality = formValues.sleepQuality ?? 3
  const normalizedMainFocus = formValues.mainFocus ?? 'projects'

  const isDirty = selectedEntry
    ? selectedEntry.feeling !== normalizedFeeling ||
      selectedEntry.sleepQuality !== normalizedSleepQuality ||
      selectedEntry.mainFocus !== normalizedMainFocus ||
      selectedEntry.entryContent !== formValues.entryContent
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
    store.commit(events.historyRecorded({ id: timestamp, action, entityType: 'journal', entityId, entityText, timestamp }))
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
        feeling: 3,
        sleepQuality: 3,
        mainFocus: 'projects',
        entryContent: '<p></p>',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    )

    recordHistory('Created', id, `Journal ${dateKey}`)
    embed.mutate({ id: String(id), type: 'journal', action: 'upsert', title: `Journal ${dateKey}`, content: '' })
    setSelectedEntryId(id)
  }

  const saveEntry = () => {
    if (!selectedEntry) return
    if (!isDirty) {
      setSaveState('saved')
      return
    }

    setSaveState('saving')
    const timestamp = Date.now()
    store.commit(
      events.journalEntryUpdated({
        id: selectedEntry.id,
        feeling: normalizedFeeling,
        sleepQuality: normalizedSleepQuality,
        mainFocus: normalizedMainFocus,
        entryContent: formValues.entryContent,
        updatedAt: timestamp,
      })
    )
    recordHistory('Updated', selectedEntry.id, `Journal ${selectedEntry.dateKey}`)
    embed.mutate({
      id: String(selectedEntry.id),
      type: 'journal',
      action: 'upsert',
      title: `Journal ${selectedEntry.dateKey}`,
      content: stripHtml(formValues.entryContent),
    })
    setSaveState('saved')
  }

  const deleteEntry = (id: number) => {
    const target = entries.find(entry => entry.id === id)
    if (!target) return

    store.commit(events.journalEntryDeleted({ id }))
    recordHistory('Deleted', id, `Journal ${target.dateKey}`)
    embed.mutate({ id: String(id), type: 'journal', action: 'delete', content: '' })
    if (selectedEntryId === id) setSelectedEntryId(null)
  }

  const currentStreak = useMemo(() => calculateCurrentStreak(entries.map(entry => entry.dateKey)), [entries])
  const completedStepCount = currentStep === 4 ? 4 : currentStep + 1

  const completeCheckIn = () => {
    if (!hasMeaningfulContent(formValues.entryContent)) return
    saveEntry()
    setCurrentStep(4)
  }

  return (
    <div className="h-full min-h-0 overflow-auto">
      {selectedEntry ? (
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col items-center px-6 pb-16 pt-10 text-center">
          <div className="w-full max-w-5xl text-left">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/journal/dashboard' })}>Back to reflection</Button>
          </div>

          <div className="mt-6 flex w-full max-w-xl items-center justify-center gap-6">
            {[0, 1, 2, 3].map(step => (
              <span
                key={step}
                className={cn('h-1.5 w-32 rounded-full border border-border/70', step < completedStepCount ? 'bg-muted/80' : 'bg-transparent')}
              />
            ))}
          </div>

          <p className="mt-8 text-3xl font-medium text-foreground/80">Daily Check In</p>

          {currentStep === 0 && (
            <div className="mt-40 w-full max-w-xl space-y-8">
              <h2 className="text-4xl font-medium text-foreground/80">
                How are you <span className="font-semibold text-foreground">feeling?</span>
              </h2>
              <div className="flex items-center justify-center gap-8">
                {[1, 2, 3, 4].map(value => (
                  <button
                    key={`feeling-${value}`}
                    type="button"
                    onClick={() => {
                      setFeeling(value as 1 | 2 | 3 | 4)
                      setCurrentStep(1)
                    }}
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-full border text-xl transition-colors',
                      formValues.feeling === value
                        ? 'border-foreground/80 text-foreground'
                        : 'border-border/80 text-muted-foreground hover:border-foreground/60 hover:text-foreground/80'
                    )}
                  >
                    {FEELING_FACES[value as 1 | 2 | 3 | 4]}
                  </button>
                ))}
              </div>
              <p className="text-4xl text-muted-foreground">
                {formValues.feeling ? FEELING_COPY[formValues.feeling].replace('ok.', '') : 'Select one'}
                <span className="font-semibold text-foreground">{formValues.feeling === 3 ? 'ok.' : ''}</span>
              </p>
            </div>
          )}

          {currentStep === 1 && (
            <div className="mt-36 w-full max-w-xl space-y-8">
              <h2 className="text-4xl font-medium text-foreground/80">
                How well did you <span className="font-semibold text-foreground">sleep</span> last night?
              </h2>
              <div className="text-8xl text-foreground/70">🛏</div>
              <p className="text-3xl text-muted-foreground">
                I had a{' '}
                <span className="font-semibold text-foreground">
                  {formValues.sleepQuality
                    ? SLEEP_COPY[formValues.sleepQuality].replace('Sleep was ', '').replace('.', '')
                    : 'moderate'}
                </span>{' '}
                night&apos;s sleep.
              </p>
              <div className="mx-auto max-w-md">
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={formValues.sleepQuality ?? 2}
                  onChange={event => setSleepQuality(Number(event.target.value) as 1 | 2 | 3 | 4)}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(0)}>Back</Button>
                <Button size="sm" onClick={() => setCurrentStep(2)} disabled={!formValues.sleepQuality}>Continue</Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="mt-36 w-full max-w-3xl space-y-10">
              <h2 className="text-4xl font-medium text-foreground/80">
                What&apos;s your <span className="font-semibold text-foreground">main focus</span> for today?
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FOCUS_OPTIONS.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setMainFocus(option)
                      setCurrentStep(3)
                    }}
                    className={cn(
                      'rounded-xl border border-border/70 px-4 py-5 transition-colors',
                      formValues.mainFocus === option ? 'bg-muted/50 text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <p className="text-2xl">{option === 'projects' ? '🗂' : option === 'research' ? '🔬' : option === 'exercise' ? '💪' : '🛌'}</p>
                    <p className="mt-2 text-sm capitalize">{option}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>Back</Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="mt-14 w-full overflow-hidden rounded-2xl border border-border/70 text-left">
              <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[30%_1fr]">
                <div className="flex flex-col items-center justify-center border-b border-border/60 p-8 text-center lg:border-r lg:border-b-0">
                  <p className="text-3xl font-medium text-foreground/80">Daily Check In</p>
                  <p className="mt-24 text-4xl text-muted-foreground">Your <span className="font-semibold text-foreground">daily</span> entry?</p>
                  <div className="mt-8 flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)}>Back</Button>
                    <Button size="sm" onClick={completeCheckIn} disabled={!hasMeaningfulContent(formValues.entryContent)}>Complete</Button>
                  </div>
                </div>
                <div className="p-4 lg:p-6">
                  <h3 className="text-3xl font-medium text-foreground/80">Daily Brain Dump</h3>
                  <p className="mb-4 mt-2 text-muted-foreground">Start Writing...</p>
                  <SimpleEditor
                    content={formValues.entryContent}
                    onChange={html => setEntryContent(html)}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="mt-40 w-full max-w-xl space-y-8">
              <p className="text-sm text-muted-foreground">{currentStreak} Day Streak</p>
              <h2 className="text-4xl font-medium text-foreground/85">
                You completed <span className="font-semibold text-foreground">Daily Check-In!</span>
              </h2>
              <div className="flex items-center justify-center gap-3">
                {Array.from({ length: 7 }).map((_, index) => (
                  <span
                    key={`streak-${index}`}
                    className={cn(
                      'inline-flex h-11 w-11 items-center justify-center rounded-full border text-base',
                      index < Math.min(currentStreak, 7) ? 'border-foreground/70 bg-muted/70 text-foreground' : 'border-border/70 text-muted-foreground'
                    )}
                  >
                    {index < Math.min(currentStreak, 7) ? '🔥' : ''}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Come back tomorrow to keep your streak.</p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(0)}>Go Back</Button>
                <Button variant="outline" size="sm" onClick={() => navigate({ to: '/journal/dashboard' })}>Exit</Button>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateKey(selectedEntry.dateKey)}</span>
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
            <Button variant="outline" size="sm" onClick={() => deleteEntry(selectedEntry.id)}>Delete</Button>
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-[420px] items-center justify-center px-6">
          <div className="text-center">
            <p className="mb-3 text-sm text-muted-foreground">Start your daily check-in.</p>
            <Button onClick={createTodayEntry} disabled={Boolean(todayEntry)}>
              {todayEntry ? 'Today entry created' : 'Create today entry'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
