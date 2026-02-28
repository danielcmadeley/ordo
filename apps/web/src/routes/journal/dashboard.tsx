import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { queryDb } from '@livestore/livestore'
import { useStore } from '@livestore/react'
import { useMemo } from 'react'
import { tables } from '@ordo/shared/livestore-schema'
import { Button } from '@/components/ui/button'
import { requireAuthSession } from '@/lib/auth-guards'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/journal/dashboard')({
  component: JournalDashboardPage,
  beforeLoad: requireAuthSession,
})

type MoodLevel = 1 | 2 | 3 | 4

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hasMeaningfulContent(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
}

function calculateCurrentStreak(dateKeys: string[]) {
  const set = new Set(dateKeys)
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const key = getDateKey(cursor)
    if (!set.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function JournalDashboardPage() {
  const navigate = useNavigate()
  const { store } = useStore()

  const journalEntries$ = useMemo(() => queryDb(() => tables.journalEntries.where({}), { label: 'journal-entries' }), [])
  const allEntries = store.useQuery(journalEntries$)
  const entries = useMemo(() => [...allEntries].sort((a, b) => a.dateKey.localeCompare(b.dateKey)), [allEntries])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MoodLevel>()
    for (const entry of entries) {
      const normalized = Math.min(4, Math.max(1, entry.feeling)) as MoodLevel
      map.set(entry.dateKey, normalized)
    }
    return map
  }, [entries])

  const totalEntries = entries.length
  const currentStreak = useMemo(() => calculateCurrentStreak(entries.map(entry => entry.dateKey)), [entries])
  const activeDays = new Set(entries.map(entry => entry.dateKey)).size
  const savedThoughts = entries.filter(entry => hasMeaningfulContent(entry.entryContent)).length

  const todayKey = getDateKey()
  const hasTodayEntry = entriesByDate.has(todayKey)

  const monthlyMoodCounts = useMemo(() => {
    const counts: Record<MoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    for (let i = 0; i < 30; i += 1) {
      const mood = entriesByDate.get(getDateKey(cursor))
      if (mood) counts[mood] += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return counts
  }, [entriesByDate])

  const moodSeries = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return entriesByDate.get(key) ?? null
    })
  }, [entriesByDate])

  const heatmap = useMemo(() => {
    const year = new Date().getFullYear()
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)

    while (start.getDay() !== 0) start.setDate(start.getDate() - 1)
    while (end.getDay() !== 6) end.setDate(end.getDate() + 1)

    const weeks: Array<Array<string | null>> = []
    const monthLabels: string[] = []
    const cursor = new Date(start)

    while (cursor <= end) {
      const week: Array<string | null> = []
      for (let day = 0; day < 7; day += 1) {
        week.push(cursor.getFullYear() === year ? getDateKey(cursor) : null)
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)

      const firstVisible = week.find(Boolean)
      if (firstVisible) {
        const monthIndex = Number(firstVisible.slice(5, 7)) - 1
        const dayOfMonth = Number(firstVisible.slice(8, 10))
        monthLabels.push(dayOfMonth <= 7 ? MONTHS[monthIndex] : '')
      } else {
        monthLabels.push('')
      }
    }

    return { weeks, monthLabels }
  }, [])

  return (
    <div className="h-full min-h-0 overflow-auto px-6 pb-16 pt-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1440px] space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-medium tracking-tight text-foreground/90">Reflection</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate({ to: '/journal/timeline' })}>Timeline</Button>
            <Button onClick={() => navigate({ to: '/journal/daily-entry' })}>
              {hasTodayEntry ? 'Continue daily entry' : 'Start daily entry'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Streak', value: currentStreak },
            { label: 'Entries', value: totalEntries },
            { label: 'Days', value: activeDays },
            { label: 'Saved Thoughts', value: savedThoughts },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-border/70 bg-content-background/30 p-4">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-right text-5xl font-light leading-none text-foreground/85">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <section className="rounded-2xl border border-border/70 bg-content-background/25 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-medium text-foreground/85">Mood Chart</h2>
              <span className="text-sm text-muted-foreground">This month</span>
            </div>
            <div className="space-y-3">
              {[4, 3, 2, 1].map(level => (
                <div key={level} className="grid grid-cols-[24px_1fr] items-center gap-3">
                  <span className="text-center text-muted-foreground">{level === 4 ? '☺' : level === 3 ? '◕' : level === 2 ? '◔' : '☹'}</span>
                  <div className="h-px bg-border/60" />
                </div>
              ))}
            </div>
            <div className="mt-6 flex h-36 items-end gap-1.5 overflow-hidden">
              {moodSeries.map((mood, index) => (
                <div key={`mood-series-${index}`} className="flex min-w-2 flex-1 items-end">
                  <div
                    className={cn('w-full rounded-sm', mood ? 'bg-foreground/70' : 'bg-border/25')}
                    style={{ height: `${mood ? 20 + mood * 20 : 6}%` }}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-content-background/25 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-medium text-foreground/85">Monthly Moods</h2>
              <span className="text-sm text-muted-foreground">30 days</span>
            </div>
            <div className="mt-8 flex h-44 items-end justify-around gap-4">
              {(Object.entries(monthlyMoodCounts) as Array<[string, number]>).map(([key, value]) => (
                <div key={key} className="flex flex-col items-center gap-3">
                  <div className="flex h-36 items-end">
                    <div
                      className="w-10 rounded-t-sm bg-foreground/80"
                      style={{ height: `${Math.max(10, Math.min(100, value * 12))}%` }}
                    />
                  </div>
                  <span className="text-xl text-muted-foreground">{key === '4' ? '☺' : key === '3' ? '◕' : key === '2' ? '◔' : '☹'}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border/70 bg-content-background/25 p-5">
          <h2 className="text-2xl font-medium text-foreground/85">{totalEntries} Entries in {new Date().getFullYear()}</h2>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="mb-2 grid grid-flow-col gap-1" style={{ gridTemplateColumns: `repeat(${heatmap.monthLabels.length}, minmax(0, 1fr))` }}>
                {heatmap.monthLabels.map((month, index) => (
                  <span key={`month-${index}`} className="text-xs text-muted-foreground">{month}</span>
                ))}
              </div>

              <div className="grid grid-cols-[28px_1fr] gap-2">
                <div className="grid grid-rows-7 gap-1">
                  {DAYS.map(day => (
                    <span key={day} className="text-xs text-muted-foreground">{day.slice(0, 3)}</span>
                  ))}
                </div>

                <div className="grid grid-flow-col gap-1" style={{ gridTemplateColumns: `repeat(${heatmap.weeks.length}, minmax(0, 1fr))` }}>
                  {heatmap.weeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1">
                      {week.map((dateKey, dayIndex) => {
                        const mood = dateKey ? entriesByDate.get(dateKey) : null
                        return (
                          <span
                            key={`cell-${weekIndex}-${dayIndex}`}
                            className={cn(
                              'h-4 w-4 rounded-[3px] border border-border/35',
                              !mood && 'bg-muted/25',
                              mood === 1 && 'bg-muted/40',
                              mood === 2 && 'bg-muted/55',
                              mood === 3 && 'bg-muted/70',
                              mood === 4 && 'bg-foreground/70'
                            )}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
