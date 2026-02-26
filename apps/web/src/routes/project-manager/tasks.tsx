import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useStore } from '@livestore/react'
import { tables, events } from '@repo/shared/livestore-schema'
import { queryDb } from '@livestore/livestore'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/project-manager/tasks')({
  component: TasksPage,
  beforeLoad: requireAuthSession,
})

const PRIORITY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' }
const PRIORITY_COLOR: Record<number, string> = {
  1: 'bg-gray-100 text-gray-500',
  2: 'bg-blue-100 text-blue-600',
  3: 'bg-orange-100 text-orange-600',
  4: 'bg-red-100 text-red-600',
}

function parseLabels(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function TasksPage() {
  const { store } = useStore()
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Completed'>('All')
  const [filterPriority, setFilterPriority] = useState<number | 'All'>('All')
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate' | 'priority'>('createdAt')

  const tasks$ = useMemo(() => queryDb(() => tables.tasks.where({}), { label: 'all-tasks-view' }), [])
  const projects$ = useMemo(() => queryDb(() => tables.projects.where({}), { label: 'projects-for-tasks' }), [])
  const allTasks = store.useQuery(tasks$)
  const projects = store.useQuery(projects$)

  const projectMap = useMemo(() =>
    Object.fromEntries(projects.map(p => [p.id, p.name])), [projects]
  )

  const filtered = allTasks
    .filter(t => filterStatus === 'All' ? true : filterStatus === 'Completed' ? t.completed : !t.completed)
    .filter(t => filterPriority === 'All' ? true : t.priority === filterPriority)
    .sort((a, b) => {
      if (sortBy === 'priority') return b.priority - a.priority
      if (sortBy === 'dueDate') return (a.dueDate || Infinity) - (b.dueDate || Infinity)
      return b.createdAt - a.createdAt
    })

  const toggleTask = (id: number, completed: boolean) => {
    const text = allTasks.find(t => t.id === id)?.text ?? ''
    const timestamp = Date.now()
    const action = completed ? 'Uncompleted' : 'Completed'
    store.commit(completed ? events.taskUncompleted({ id }) : events.taskCompleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action, entityType: 'task', entityId: id, entityText: text, timestamp }))
  }

  const deleteTask = (id: number) => {
    const text = allTasks.find(t => t.id === id)?.text ?? ''
    const timestamp = Date.now()
    store.commit(events.taskDeleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Deleted', entityType: 'task', entityId: id, entityText: text, timestamp }))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">All Tasks</h1>
        <span className="text-sm text-gray-400">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {(['All', 'Active', 'Completed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${filterStatus === s ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {(['All', 1, 2, 3, 4] as const).map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${filterPriority === p ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {p === 'All' ? 'All' : PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="createdAt">Sort: Created</option>
          <option value="dueDate">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
        </select>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.map(task => {
          const labels = parseLabels(task.labels)
          const projectName = task.projectId === 0 ? 'Inbox' : (projectMap[task.projectId] ?? 'Unknown project')
          return (
            <div key={task.id} className={`bg-white rounded-lg border px-4 py-3 ${task.completed ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id, task.completed)} className="mt-0.5 w-4 h-4 cursor-pointer shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium text-gray-800 ${task.completed ? 'line-through text-gray-400' : ''}`}>{task.text}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">{projectName}</span>
                    {labels.map(l => (
                      <span key={l} className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">{l}</span>
                    ))}
                  </div>
                  {task.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    {task.dueDate > 0 && (
                      <span className={`text-xs ${task.dueDate < Date.now() && !task.completed ? 'text-red-500' : 'text-gray-400'}`}>
                        Due {formatDate(task.dueDate)}
                      </span>
                    )}
                    <span className="text-xs text-gray-300">Created {formatDate(task.createdAt)}</span>
                  </div>
                </div>
                <button onClick={() => deleteTask(task.id)} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors shrink-0">Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 mt-12">No tasks match the current filters.</p>
      )}
    </div>
  )
}
