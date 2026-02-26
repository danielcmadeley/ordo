import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useStore } from '@livestore/react'
import { tables, events } from '@repo/shared/livestore-schema'
import { queryDb } from '@livestore/livestore'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/project-manager/projects')({
  component: ProjectsPage,
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

const EMPTY_TASK_FORM = { text: '', description: '', priority: 1, labels: '', dueDate: '' }
const EMPTY_PROJECT_FORM = { id: '', name: '', description: '' }

function ProjectsPage() {
  const { store } = useStore()

  // Project form state
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [editProjectForm, setEditProjectForm] = useState(EMPTY_PROJECT_FORM)

  // Task form state — keyed by projectId
  const [taskFormProjectId, setTaskFormProjectId] = useState<number | null>(null)
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTaskForm, setEditTaskForm] = useState(EMPTY_TASK_FORM)

  const projects$ = useMemo(() => queryDb(() => tables.projects.where({}), { label: 'projects' }), [])
  const allTasks$ = useMemo(() => queryDb(() => tables.tasks.where({}), { label: 'all-tasks' }), [])
  const projects = store.useQuery(projects$)
  const allTasks = store.useQuery(allTasks$)

  // ── Projects ──────────────────────────────────────────────────────────────

  const createProject = () => {
    if (!projectForm.name.trim()) return
    const requestedId = projectForm.id.trim()
    const id = requestedId ? Number.parseInt(requestedId, 10) : Date.now()
    if (!Number.isInteger(id) || id <= 0) return
    if (projects.some(project => project.id === id)) return
    store.commit(events.projectCreated({ id, name: projectForm.name.trim(), description: projectForm.description.trim(), createdAt: id }))
    store.commit(events.historyRecorded({ id, action: 'Created', entityType: 'project', entityId: id, entityText: projectForm.name.trim(), timestamp: id }))
    setProjectForm(EMPTY_PROJECT_FORM)
    setShowProjectForm(false)
  }

  const saveProjectEdit = () => {
    if (editingProjectId === null || !editProjectForm.name.trim()) return
    const timestamp = Date.now()
    store.commit(events.projectUpdated({ id: editingProjectId, name: editProjectForm.name.trim(), description: editProjectForm.description.trim() }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Updated', entityType: 'project', entityId: editingProjectId, entityText: editProjectForm.name.trim(), timestamp }))
    setEditingProjectId(null)
  }

  const deleteProject = (id: number) => {
    const name = projects.find(p => p.id === id)?.name ?? ''
    const timestamp = Date.now()
    store.commit(events.projectDeleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Deleted', entityType: 'project', entityId: id, entityText: name, timestamp }))
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const createTask = (projectId: number) => {
    if (!taskForm.text.trim()) return
    const id = Date.now()
    const labels = JSON.stringify(taskForm.labels.split(',').map(l => l.trim()).filter(Boolean))
    const dueDate = taskForm.dueDate ? new Date(taskForm.dueDate).getTime() : 0
    store.commit(events.taskCreated({ id, text: taskForm.text.trim(), description: taskForm.description.trim(), projectId, priority: taskForm.priority, labels, createdAt: id, dueDate }))
    store.commit(events.historyRecorded({ id, action: 'Created', entityType: 'task', entityId: id, entityText: taskForm.text.trim(), timestamp: id }))
    setTaskForm(EMPTY_TASK_FORM)
    setTaskFormProjectId(null)
  }

  const saveTaskEdit = () => {
    if (editingTaskId === null || !editTaskForm.text.trim()) return
    const task = allTasks.find(t => t.id === editingTaskId)
    const timestamp = Date.now()
    const labels = JSON.stringify(editTaskForm.labels.split(',').map(l => l.trim()).filter(Boolean))
    const dueDate = editTaskForm.dueDate ? new Date(editTaskForm.dueDate).getTime() : 0
    store.commit(events.taskUpdated({ id: editingTaskId, text: editTaskForm.text.trim(), description: editTaskForm.description.trim(), projectId: task?.projectId ?? 0, priority: editTaskForm.priority, labels, dueDate }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Updated', entityType: 'task', entityId: editingTaskId, entityText: editTaskForm.text.trim(), timestamp }))
    setEditingTaskId(null)
  }

  const startEditTask = (task: (typeof allTasks)[0]) => {
    setEditingTaskId(task.id)
    const labels = parseLabels(task.labels).join(', ')
    const dueDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
    setEditTaskForm({ text: task.text, description: task.description, priority: task.priority, labels, dueDate })
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
        <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
        {!showProjectForm && (
          <button onClick={() => setShowProjectForm(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors">
            New Project
          </button>
        )}
      </div>

      {/* New project form */}
      {showProjectForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">New Project</h2>
          <input type="number" min={1} step={1} value={projectForm.id} onChange={e => setProjectForm({ ...projectForm, id: e.target.value })}
            placeholder="Project ID (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && createProject()} placeholder="Project name" autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
            placeholder="Description (optional)" rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowProjectForm(false); setProjectForm(EMPTY_PROJECT_FORM) }} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
            <button onClick={createProject} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors">Create</button>
          </div>
        </div>
      )}

      {/* Project list */}
      <div className="space-y-4">
        {projects.map(project => {
          const projectTasks = allTasks.filter(t => t.projectId === project.id)
          const isEditingProject = editingProjectId === project.id

          return (
            <div key={project.id} className="bg-white rounded-lg border border-gray-200">
              {/* Project header */}
              {isEditingProject ? (
                <div className="p-4 border-b border-gray-100">
                  <input type="text" value={editProjectForm.name} onChange={e => setEditProjectForm({ ...editProjectForm, name: e.target.value })}
                    autoFocus className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <textarea value={editProjectForm.description} onChange={e => setEditProjectForm({ ...editProjectForm, description: e.target.value })}
                    rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingProjectId(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                    <button onClick={saveProjectEdit} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600">Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{project.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">#{project.id}</span>
                      <span className="text-xs text-gray-400">{projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}</span>
                    </div>
                    {project.description && <p className="text-xs text-gray-500 mt-0.5">{project.description}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { setEditingProjectId(project.id); setEditProjectForm({ id: String(project.id), name: project.name, description: project.description }) }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">Edit</button>
                    <button onClick={() => deleteProject(project.id)} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors">Delete</button>
                  </div>
                </div>
              )}

              {/* Task list */}
              <div className="divide-y divide-gray-50">
                {projectTasks.map(task =>
                  editingTaskId === task.id ? (
                    <div key={task.id} className="p-4">
                      <InlineTaskForm form={editTaskForm} onChange={setEditTaskForm} onSubmit={saveTaskEdit} onCancel={() => setEditingTaskId(null)} submitLabel="Save" />
                    </div>
                  ) : (
                    <div key={task.id} className={`flex items-start gap-3 px-4 py-3 ${task.completed ? 'opacity-60' : ''}`}>
                      <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id, task.completed)} className="mt-0.5 w-4 h-4 cursor-pointer shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium text-gray-800 ${task.completed ? 'line-through text-gray-400' : ''}`}>{task.text}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>
                          {parseLabels(task.labels).map(l => (
                            <span key={l} className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">{l}</span>
                          ))}
                        </div>
                        {task.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>}
                        {task.dueDate > 0 && (
                          <span className={`text-xs ${task.dueDate < Date.now() && !task.completed ? 'text-red-500' : 'text-gray-400'}`}>
                            Due {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => startEditTask(task)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">Edit</button>
                        <button onClick={() => deleteTask(task.id)} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors">Delete</button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Add task to project */}
              <div className="px-4 py-2">
                {taskFormProjectId === project.id ? (
                  <InlineTaskForm form={taskForm} onChange={setTaskForm}
                    onSubmit={() => createTask(project.id)}
                    onCancel={() => { setTaskFormProjectId(null); setTaskForm(EMPTY_TASK_FORM) }}
                    submitLabel="Add Task" />
                ) : (
                  <button onClick={() => { setTaskFormProjectId(project.id); setTaskForm(EMPTY_TASK_FORM) }}
                    className="text-sm text-blue-500 hover:text-blue-700 transition-colors">
                    + Add task
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {projects.length === 0 && !showProjectForm && (
        <p className="text-center text-gray-400 mt-12">No projects yet. Create one above!</p>
      )}
    </div>
  )
}

type TaskFormState = { text: string; description: string; priority: number; labels: string; dueDate: string }

function InlineTaskForm({ form, onChange, onSubmit, onCancel, submitLabel }: {
  form: TaskFormState
  onChange: (f: TaskFormState) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
}) {
  return (
    <div className="space-y-2">
      <input type="text" value={form.text} onChange={e => onChange({ ...form, text: e.target.value })}
        onKeyDown={e => e.key === 'Enter' && onSubmit()} placeholder="Task name" autoFocus
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <textarea value={form.description} onChange={e => onChange({ ...form, description: e.target.value })}
        placeholder="Description (optional)" rows={2}
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      <div className="flex gap-2">
        <select value={form.priority} onChange={e => onChange({ ...form, priority: Number(e.target.value) })}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={1}>Low</option>
          <option value={2}>Medium</option>
          <option value={3}>High</option>
          <option value={4}>Critical</option>
        </select>
        <input type="date" value={form.dueDate} onChange={e => onChange({ ...form, dueDate: e.target.value })}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <input type="text" value={form.labels} onChange={e => onChange({ ...form, labels: e.target.value })}
        placeholder="Labels (comma separated)"
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button onClick={onSubmit} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600">{submitLabel}</button>
      </div>
    </div>
  )
}
