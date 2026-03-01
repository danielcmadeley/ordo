import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useStore } from '@livestore/react'
import { queryDb } from '@livestore/livestore'
import { tables } from '@ordo/shared/livestore-schema'
import { requireAuthSession } from '@/lib/auth-guards'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Route = createFileRoute('/')({
  component: DashboardPage,
  beforeLoad: requireAuthSession,
})

type ProjectRow = { id: number; name: string }
type TaskRow = {
  id: number
  text: string
  completed: boolean
  priority: number
  projectId: number
  dueDate: number
  labels: string
}
type NoteRow = { id: number; createdAt: number }
type JournalRow = { id: number; dateKey: string }
type HistoryRow = { id: number; action: string; timestamp: number }

function parseLabels(raw: string): string[] {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function DashboardPage() {
  const { user } = useCurrentUser()
  const { store } = useStore()
  const navigate = useNavigate()

  const projects$ = useMemo(() => queryDb(() => tables.projects.where({}), { label: 'home-projects' }), [])
  const tasks$ = useMemo(() => queryDb(() => tables.tasks.where({}), { label: 'home-tasks' }), [])
  const notes$ = useMemo(() => queryDb(() => tables.notes.where({}), { label: 'home-notes' }), [])
  const journal$ = useMemo(() => queryDb(() => tables.journalEntries.where({}), { label: 'home-journal' }), [])
  const history$ = useMemo(() => queryDb(() => tables.history.where({}), { label: 'home-history' }), [])

  const projects = store.useQuery(projects$) as readonly ProjectRow[]
  const tasks = store.useQuery(tasks$) as readonly TaskRow[]
  const notes = store.useQuery(notes$) as readonly NoteRow[]
  const journalEntries = store.useQuery(journal$) as readonly JournalRow[]
  const history = store.useQuery(history$) as readonly HistoryRow[]

  const now = new Date()

  const dayLabel = now.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long' }).toUpperCase()
  const day = now.getDate()

  const suffix = (() => {
    if (day % 100 >= 11 && day % 100 <= 13) return 'TH'
    if (day % 10 === 1) return 'ST'
    if (day % 10 === 2) return 'ND'
    if (day % 10 === 3) return 'RD'
    return 'TH'
  })()

  const dateLabel = `${day}${suffix} ${monthLabel}`

  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000
  const weekAhead = todayStart + 7 * 24 * 60 * 60 * 1000

  const openTasks = useMemo(() => tasks.filter(task => !task.completed), [tasks])

  const openProjectIds = useMemo(() => {
    const ids = new Set<number>()
    openTasks.forEach(task => {
      if (task.projectId > 0) ids.add(task.projectId)
    })
    return ids
  }, [openTasks])

  const activeProjectsThisWeek = useMemo(() => {
    const ids = new Set<number>()
    openTasks.forEach(task => {
      const due = task.dueDate
      if (task.projectId <= 0) return
      if (due > 0 && due <= weekAhead) ids.add(task.projectId)
    })
    return ids.size > 0 ? ids.size : openProjectIds.size
  }, [openProjectIds.size, openTasks, weekAhead])

  const todayPriorities = useMemo(() => {
    const scored = openTasks.map(task => {
      const due = task.dueDate
      const isOverdue = due > 0 && due < todayStart
      const isToday = due >= todayStart && due < tomorrowStart
      return { task, due, isOverdue, isToday }
    })

    return scored
      .sort((a, b) => {
        if (a.isToday !== b.isToday) return a.isToday ? -1 : 1
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
        if (a.task.priority !== b.task.priority) return b.task.priority - a.task.priority
        if (a.due === 0 && b.due !== 0) return 1
        if (a.due !== 0 && b.due === 0) return -1
        return a.due - b.due
      })
      .slice(0, 5)
      .map(entry => entry.task)
  }, [openTasks, todayStart, tomorrowStart])

  const blockedAwaiting = useMemo(
    () => openTasks.filter(task => parseLabels(task.labels).some(label => /blocked|await|waiting/i.test(label))).slice(0, 5),
    [openTasks]
  )

  const projectSnapshots = useMemo(() => {
    const projectById = new Map(projects.map(project => [project.id, project.name]))

    return Array.from(openProjectIds)
      .map(projectId => {
        const projectTasks = openTasks.filter(task => task.projectId === projectId)
        const urgent = projectTasks.filter(task => task.priority >= 3).length
        return {
          id: projectId,
          name: projectById.get(projectId) ?? `Project #${projectId}`,
          total: projectTasks.length,
          urgent,
        }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [openProjectIds, openTasks, projects])

  const reviewsAndQa = useMemo(
    () => openTasks.filter(task => parseLabels(task.labels).some(label => /review|qa|test/i.test(label))).slice(0, 5),
    [openTasks]
  )

  const completedToday = useMemo(
    () => history.filter(entry => entry.action === 'Completed' && entry.timestamp >= todayStart && entry.timestamp < tomorrowStart).length,
    [history, todayStart, tomorrowStart]
  )

  const overdueCount = useMemo(
    () => openTasks.filter(task => task.dueDate > 0 && task.dueDate < todayStart).length,
    [openTasks, todayStart]
  )

  const notesThisWeek = useMemo(() => notes.filter(note => note.createdAt >= todayStart - 6 * 24 * 60 * 60 * 1000).length, [notes, todayStart])
  const journalThisWeek = useMemo(() => {
    const keyFromTs = (ts: number) => {
      const d = new Date(ts)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    const oldest = keyFromTs(todayStart - 6 * 24 * 60 * 60 * 1000)
    const newest = keyFromTs(todayStart)
    return journalEntries.filter(entry => entry.dateKey >= oldest && entry.dateKey <= newest).length
  }, [journalEntries, todayStart])

  return (
    <div className="h-full min-h-0 overflow-auto p-4 md:p-6">
      <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col justify-center">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-muted-foreground/70">Good Morning</p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">{user?.name || user?.email},</h1>
          </div>
          <div className="pt-2 text-right">
            <p className="text-4xl font-semibold tracking-tight text-foreground/75">{dayLabel}</p>
            <p className="text-sm font-medium tracking-wide text-muted-foreground">{dateLabel}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="relative min-h-[220px] overflow-visible rounded-sm border border-border/70 bg-card/45 p-5">
            <div className="absolute inset-0 m-3 rounded-sm border border-border/40 bg-card/30" />
            <div className="absolute inset-0 rotate-[-6deg] rounded-sm border border-border/70 bg-card/70 p-5">
              <h2 className="text-2xl font-medium text-foreground/75">Weekly Summary</h2>
              <p className="mt-4 max-w-[32ch] text-3xl leading-snug text-foreground/85">
                You have {activeProjectsThisWeek} active projects this week involving {openTasks.length} open tasks.
              </p>
            </div>
          </article>

          <article className="min-h-[220px] rounded-sm border border-border/70 bg-card/45 p-5">
            <h2 className="text-2xl font-medium text-foreground/75">Todays Priorities</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {todayPriorities.length === 0 && <li className="text-muted-foreground">No priorities for today.</li>}
              {todayPriorities.map(task => (
                <li key={task.id} className="truncate">• {task.text}</li>
              ))}
            </ul>
          </article>

          <article className="min-h-[220px] rounded-sm border border-border/70 bg-card/45 p-5">
            <h2 className="text-2xl font-medium text-foreground/75">Blocked/Awaiting</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {blockedAwaiting.length === 0 && <li className="text-muted-foreground">No blocked items tagged.</li>}
              {blockedAwaiting.map(task => (
                <li key={task.id} className="truncate">• {task.text}</li>
              ))}
            </ul>
          </article>

          <article className="min-h-[220px] rounded-sm border border-border/70 bg-card/45 p-5">
            <h2 className="text-2xl font-medium text-foreground/75">My Projects</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {projectSnapshots.length === 0 && <li className="text-muted-foreground">No active projects yet.</li>}
              {projectSnapshots.map(project => (
                <li key={project.id} className="truncate">
                  • {project.name} ({project.total} open{project.urgent > 0 ? `, ${project.urgent} urgent` : ''})
                </li>
              ))}
            </ul>
          </article>

          <article className="min-h-[220px] rounded-sm border border-border/70 bg-card/45 p-5">
            <h2 className="text-2xl font-medium text-foreground/75">Reviews & QAs</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {reviewsAndQa.length === 0 && <li className="text-muted-foreground">No review or QA tasks tagged.</li>}
              {reviewsAndQa.map(task => (
                <li key={task.id} className="truncate">• {task.text}</li>
              ))}
            </ul>
          </article>

          <article className="min-h-[220px] rounded-sm border border-border/70 bg-card/45 p-5">
            <h2 className="text-2xl font-medium text-foreground/75">Focus & Metrics</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border/60 bg-card/50 p-2">
                <p className="text-muted-foreground">Completed Today</p>
                <p className="text-xl font-semibold text-foreground">{completedToday}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card/50 p-2">
                <p className="text-muted-foreground">Overdue</p>
                <p className="text-xl font-semibold text-foreground">{overdueCount}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card/50 p-2">
                <p className="text-muted-foreground">Notes (7d)</p>
                <p className="text-xl font-semibold text-foreground">{notesThisWeek}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-card/50 p-2">
                <p className="text-muted-foreground">Journal (7d)</p>
                <p className="text-xl font-semibold text-foreground">{journalThisWeek}</p>
              </div>
            </div>
          </article>
        </section>

        <button
          type="button"
          onClick={() => navigate({ to: '/ai' })}
          className="mx-auto mt-8 w-full max-w-5xl rounded-2xl border border-border/70 bg-card/60 p-3 text-left transition-colors hover:border-border"
        >
          <div className="rounded-lg bg-background/40 px-2 py-2 text-sm text-muted-foreground">Ask Anything...</div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-lg">+</span>
              <span className="text-base">⚡</span>
              <span className="text-base">◎</span>
              <span className="text-base">↻</span>
            </div>
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              ↑
            </div>
          </div>
        </button>

        <div className="h-4" />
      </div>
    </div>
  )
}
