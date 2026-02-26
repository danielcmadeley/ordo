import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useStore } from '@livestore/react'
import { tables, events } from '@repo/shared/livestore-schema'
import { queryDb } from '@livestore/livestore'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/project-manager/inbox')({
  component: InboxPage,
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

const EMPTY_FORM = { text: '', description: '', priority: 1, labels: '', dueDate: '', projectId: 0 }

function InboxPage() {
  const { store } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState<'All' | 'Active' | 'Completed'>('All')

  const tasks$ = useMemo(
    () => queryDb(() => tables.tasks.where({ projectId: 0 }), { label: 'inbox-tasks' }),
    []
  )
  const projects$ = useMemo(
    () => queryDb(() => tables.projects.where({}), { label: 'inbox-projects' }),
    []
  )
  const allTasks = store.useQuery(tasks$)
  const projects = store.useQuery(projects$)
  const tasks = allTasks.filter(t =>
    filter === 'All' ? true : filter === 'Completed' ? t.completed : !t.completed
  )

  const commitTask = (id: number, f: typeof EMPTY_FORM) => {
    const createdAt = id
    const labels = JSON.stringify(f.labels.split(',').map(l => l.trim()).filter(Boolean))
    const dueDate = f.dueDate ? new Date(f.dueDate).getTime() : 0
    store.commit(events.taskCreated({ id, text: f.text.trim(), description: f.description.trim(), projectId: f.projectId, priority: f.priority, labels, createdAt, dueDate }))
    store.commit(events.historyRecorded({ id, action: 'Created', entityType: 'task', entityId: id, entityText: f.text.trim(), timestamp: id }))
  }

  const addTask = () => {
    if (!form.text.trim()) return
    commitTask(Date.now(), form)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const saveEdit = () => {
    if (editingId === null || !editForm.text.trim()) return
    const timestamp = Date.now()
    const labels = JSON.stringify(editForm.labels.split(',').map(l => l.trim()).filter(Boolean))
    const dueDate = editForm.dueDate ? new Date(editForm.dueDate).getTime() : 0
    store.commit(events.taskUpdated({ id: editingId, text: editForm.text.trim(), description: editForm.description.trim(), projectId: editForm.projectId, priority: editForm.priority, labels, dueDate }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Updated', entityType: 'task', entityId: editingId, entityText: editForm.text.trim(), timestamp }))
    setEditingId(null)
  }

  const startEdit = (task: (typeof allTasks)[0]) => {
    setEditingId(task.id)
    const labels = parseLabels(task.labels).join(', ')
    const dueDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
    setEditForm({ text: task.text, description: task.description, priority: task.priority, labels, dueDate, projectId: task.projectId })
  }

  const deleteTask = (id: number) => {
    const text = allTasks.find(t => t.id === id)?.text ?? ''
    const timestamp = Date.now()
    store.commit(events.taskDeleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Deleted', entityType: 'task', entityId: id, entityText: text, timestamp }))
  }

  const toggleTask = (id: number, completed: boolean) => {
    const text = allTasks.find(t => t.id === id)?.text ?? ''
    const timestamp = Date.now()
    const action = completed ? 'Uncompleted' : 'Completed'
    store.commit(completed ? events.taskUncompleted({ id }) : events.taskCompleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action, entityType: 'task', entityId: id, entityText: text, timestamp }))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inbox</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors">
            New Task
          </button>
        )}
      </div>

      {showForm && (
        <TaskForm
          form={form}
          projects={projects}
          onChange={setForm}
          onSubmit={addTask}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM) }}
          submitLabel="Add Task"
        />
      )}

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['All', 'Active', 'Completed'] as const).map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-sm -mb-px transition-colors ${filter === tab ? 'text-blue-500 font-semibold border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.map(task =>
          editingId === task.id ? (
            <div key={task.id} className="bg-white rounded-lg border border-blue-200 p-4">
              <TaskForm
                form={editForm}
                projects={projects}
                onChange={setEditForm}
                onSubmit={saveEdit}
                onCancel={() => setEditingId(null)}
                submitLabel="Save"
              />
            </div>
          ) : (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task.id, task.completed)}
              onEdit={() => startEdit(task)}
              onDelete={() => deleteTask(task.id)}
            />
          )
        )}
      </div>

      {tasks.length === 0 && !showForm && (
        <p className="text-center text-gray-400 mt-12">No tasks yet. Add one above!</p>
      )}
    </div>
  )
}

type FormState = { text: string; description: string; priority: number; labels: string; dueDate: string; projectId: number }

function TaskForm({ form, projects, onChange, onSubmit, onCancel, submitLabel }: {
  form: FormState
  projects: readonly { id: number; name: string }[]
  onChange: (f: FormState) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
}) {
  const isSubmitDisabled = !form.text.trim()

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 text-zinc-100">
      <div className="p-4">
        <input
          type="text"
          value={form.text}
          onChange={e => onChange({ ...form, text: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder="Task name"
          autoFocus
          className="mb-2 w-full bg-transparent text-xl font-semibold text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
        <textarea
          value={form.description}
          onChange={e => onChange({ ...form, description: e.target.value })}
          placeholder="Description"
          rows={2}
          className="mb-3 w-full resize-none bg-transparent text-sm text-zinc-300 placeholder:text-zinc-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300">
            <label className="mr-2 text-zinc-500">Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => onChange({ ...form, dueDate: e.target.value })}
              className="bg-transparent text-zinc-200 focus:outline-none"
            />
          </div>
          <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300">
            <label className="mr-2 text-zinc-500">Priority</label>
            <select
              value={form.priority}
              onChange={e => onChange({ ...form, priority: Number(e.target.value) })}
              className="bg-transparent text-zinc-200 focus:outline-none"
            >
              <option value={1}>Low</option>
              <option value={2}>Medium</option>
              <option value={3}>High</option>
              <option value={4}>Critical</option>
            </select>
          </div>
          <input
            type="text"
            value={form.labels}
            onChange={e => onChange({ ...form, labels: e.target.value })}
            placeholder="Labels"
            className="min-w-[180px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-zinc-700 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Project</span>
          <select
            value={form.projectId}
            onChange={e => onChange({ ...form, projectId: Number(e.target.value) })}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none"
          >
            <option value={0}>Inbox</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-600">Cancel</button>
          <button
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, onToggle, onEdit, onDelete }: {
  task: { id: number; text: string; description: string; completed: boolean; priority: number; labels: string; dueDate: number; createdAt: number }
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const labels = parseLabels(task.labels)
  return (
    <div className={`bg-white rounded-lg border px-4 py-3 ${task.completed ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={task.completed} onChange={onToggle} className="mt-0.5 w-4 h-4 cursor-pointer shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium text-gray-800 ${task.completed ? 'line-through text-gray-400' : ''}`}>
              {task.text}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            {labels.map(l => (
              <span key={l} className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">{l}</span>
            ))}
          </div>
          {task.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {task.dueDate > 0 && (
              <span className={`text-xs ${task.dueDate < Date.now() && !task.completed ? 'text-red-500' : 'text-gray-400'}`}>
                Due {formatDate(task.dueDate)}
              </span>
            )}
            <span className="text-xs text-gray-300">Created {formatDate(task.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={onEdit} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">Edit</button>
          <button onClick={onDelete} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}
