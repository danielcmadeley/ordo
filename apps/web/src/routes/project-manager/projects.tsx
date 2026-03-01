import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useStore } from '@livestore/react'
import { queryDb } from '@livestore/livestore'
import { events, tables } from '@ordo/shared/livestore-schema'
import { requireAuthSession } from '@/lib/auth-guards'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectsCalendarView } from '@/features/project-manager/projects/components/projects-calendar-view'
import { ProjectsGanttView } from '@/features/project-manager/projects/components/projects-gantt-view'
import { ProjectsKanbanView } from '@/features/project-manager/projects/components/projects-kanban-view'
import { ProjectsListView, createEditProjectForm } from '@/features/project-manager/projects/components/projects-list-view'
import { ProjectsTableView } from '@/features/project-manager/projects/components/projects-table-view'
import { TaskEditorSidebar } from '@/features/project-manager/projects/components/task-editor-sidebar'
import {
  DAY_MS,
  EMPTY_PROJECT_CREATE_FORM,
  EMPTY_PROJECT_EDIT_FORM,
  EMPTY_TASK_CREATE_FORM,
  EMPTY_TASK_FORM,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  SIDEBAR_EDITOR_VIEWS,
  dateInput,
  parseLabels,
  parseProjectId,
  toTimestamp,
  type ProjectCreateFormState,
  type ProjectEditFormState,
  type ProjectRow,
  type TaskCreateFormState,
  type TaskFormState,
  type TaskRow,
} from '@/features/project-manager/projects/shared'
import { isProjectView, type ProjectView } from '@/lib/project-views'
import { useEmbedItem } from '@/lib/embed'
import type { Feature as CalendarFeature } from '@/components/kibo-ui/calendar'
import { type GanttFeature } from '@/components/kibo-ui/gantt'
import { type ColumnDef, TableColumnHeader } from '@/components/kibo-ui/table'

export const Route = createFileRoute('/project-manager/projects')({
  validateSearch: (search: Record<string, unknown>) => ({
    view: isProjectView(search.view) ? search.view : undefined,
    dialog: search.dialog === 'project' || search.dialog === 'task' ? search.dialog : undefined,
  }),
  component: ProjectsPage,
  beforeLoad: requireAuthSession,
})

function ProjectsPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const view: ProjectView = search.view ?? 'list'
  const isProjectDialogOpen = search.dialog === 'project'
  const isTaskDialogOpen = search.dialog === 'task'
  const { store } = useStore()
  const embed = useEmbedItem()

  const [createTaskForm, setCreateTaskForm] = useState<TaskCreateFormState>(EMPTY_TASK_CREATE_FORM)
  const [projectForm, setProjectForm] = useState<ProjectCreateFormState>(EMPTY_PROJECT_CREATE_FORM)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [editProjectForm, setEditProjectForm] = useState<ProjectEditFormState>(EMPTY_PROJECT_EDIT_FORM)
  const [editTaskForm, setEditTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [calendarWeekStartsMonday, setCalendarWeekStartsMonday] = useState(false)
  const [calendarShowOutsideDays, setCalendarShowOutsideDays] = useState(true)

  const projects$ = useMemo(() => queryDb(() => tables.projects.where({}), { label: 'projects' }), [])
  const allTasks$ = useMemo(() => queryDb(() => tables.tasks.where({}), { label: 'all-tasks' }), [])
  const projects = store.useQuery(projects$) as ProjectRow[]
  const allTasks = store.useQuery(allTasks$) as TaskRow[]

  const projectLookup = useMemo(
    () => new Map(projects.map(project => [project.id, project])),
    [projects]
  )

  const allProjects = useMemo(
    () => [{ id: 0, name: 'Inbox', description: '', createdAt: 0, startDate: 0 }, ...projects],
    [projects]
  )

  const selectedTask = selectedTaskId === null ? null : allTasks.find(task => task.id === selectedTaskId) ?? null

  const closeDialog = () => {
    navigate({
      to: '/project-manager/projects',
      search: prev => ({ view: prev.view, dialog: undefined }),
      replace: true,
    })
  }

  const hydrateTaskForm = (task: TaskRow): TaskFormState => ({
    text: task.text,
    description: task.description,
    priority: task.priority,
    labels: parseLabels(task.labels).join(', '),
    startDate: dateInput(task.startDate || task.createdAt),
    dueDate: dateInput(task.dueDate),
  })

  const upsertTask = (id: number, updates: Partial<TaskRow>) => {
    const existing = allTasks.find(task => task.id === id)
    if (!existing) return

    const text = (updates.text ?? existing.text).trim()
    if (!text) return
    const description = (updates.description ?? existing.description).trim()
    const priority = updates.priority ?? existing.priority
    const projectId = updates.projectId ?? existing.projectId
    const labels = updates.labels ?? existing.labels
    const baseStart = existing.startDate || existing.createdAt
    const startDate = updates.startDate ?? baseStart
    const dueDate = updates.dueDate ?? existing.dueDate
    const safeDueDate = dueDate > 0 && dueDate < startDate ? startDate : dueDate

    const timestamp = Date.now()
    store.commit(events.taskUpdated({ id, text, description, projectId, priority, labels, startDate, dueDate: safeDueDate }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Updated', entityType: 'task', entityId: id, entityText: text, timestamp }))
    const taskProjectName = projectId === 0 ? 'Inbox' : (projectLookup.get(projectId)?.name ?? 'Unknown project')
    embed.mutate({ id: String(id), type: 'task', action: 'upsert', title: text, content: `Location: ${taskProjectName}. ${description}`.trim() })
  }

  const createProject = () => {
    if (!projectForm.name.trim()) return
    const customId = parseProjectId(projectForm.id)
    const id = customId ?? Date.now()
    if (customId === null && projectForm.id.trim()) return
    if (projects.some(project => project.id === id)) return

    store.commit(events.projectCreated({
      id,
      name: projectForm.name.trim(),
      description: projectForm.description.trim(),
      createdAt: id,
      startDate: id,
    }))
    store.commit(events.historyRecorded({
      id,
      action: 'Created',
      entityType: 'project',
      entityId: id,
      entityText: projectForm.name.trim(),
      timestamp: id,
    }))
    embed.mutate({ id: String(id), type: 'project', action: 'upsert', title: projectForm.name.trim(), content: projectForm.description.trim() })

    setProjectForm(EMPTY_PROJECT_CREATE_FORM)
    closeDialog()
  }

  const saveProjectEdit = () => {
    if (editingProjectId === null || !editProjectForm.name.trim()) return
    const project = projectLookup.get(editingProjectId)
    const fallbackStart = project?.startDate || project?.createdAt || Date.now()
    const startDate = toTimestamp(editProjectForm.startDate, fallbackStart)
    const timestamp = Date.now()

    store.commit(events.projectUpdated({
      id: editingProjectId,
      name: editProjectForm.name.trim(),
      description: editProjectForm.description.trim(),
      startDate,
    }))
    store.commit(events.historyRecorded({
      id: timestamp,
      action: 'Updated',
      entityType: 'project',
      entityId: editingProjectId,
      entityText: editProjectForm.name.trim(),
      timestamp,
    }))
    embed.mutate({ id: String(editingProjectId), type: 'project', action: 'upsert', title: editProjectForm.name.trim(), content: editProjectForm.description.trim() })

    setEditingProjectId(null)
  }

  const deleteProject = (id: number) => {
    const name = projects.find(project => project.id === id)?.name ?? ''
    const timestamp = Date.now()
    store.commit(events.projectDeleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Deleted', entityType: 'project', entityId: id, entityText: name, timestamp }))
    embed.mutate({ id: String(id), type: 'project', action: 'delete', content: '' })
  }

  const createTask = () => {
    if (!createTaskForm.text.trim()) return
    const id = Date.now()
    const labels = JSON.stringify(createTaskForm.labels.split(',').map(label => label.trim()).filter(Boolean))
    const createdAt = id
    const startDate = toTimestamp(createTaskForm.startDate, createdAt)
    const dueDate = createTaskForm.dueDate ? new Date(createTaskForm.dueDate).getTime() : 0
    const safeDueDate = dueDate > 0 && dueDate < startDate ? startDate : dueDate

    store.commit(events.taskCreated({
      id,
      text: createTaskForm.text.trim(),
      description: createTaskForm.description.trim(),
      projectId: createTaskForm.projectId,
      priority: createTaskForm.priority,
      labels,
      createdAt,
      startDate,
      dueDate: safeDueDate,
    }))
    store.commit(events.historyRecorded({ id, action: 'Created', entityType: 'task', entityId: id, entityText: createTaskForm.text.trim(), timestamp: id }))
    const newTaskProjectName = createTaskForm.projectId === 0 ? 'Inbox' : (projectLookup.get(createTaskForm.projectId)?.name ?? 'Unknown project')
    embed.mutate({ id: String(id), type: 'task', action: 'upsert', title: createTaskForm.text.trim(), content: `Location: ${newTaskProjectName}. ${createTaskForm.description.trim()}`.trim() })

    setCreateTaskForm(EMPTY_TASK_CREATE_FORM)
    closeDialog()
  }

  const saveSelectedTask = () => {
    if (!selectedTask || !editTaskForm.text.trim()) return
    const labels = JSON.stringify(editTaskForm.labels.split(',').map(label => label.trim()).filter(Boolean))
    const startDate = toTimestamp(editTaskForm.startDate, selectedTask.startDate || selectedTask.createdAt)
    const dueDate = editTaskForm.dueDate ? new Date(editTaskForm.dueDate).getTime() : 0

    upsertTask(selectedTask.id, {
      text: editTaskForm.text,
      description: editTaskForm.description,
      priority: editTaskForm.priority,
      labels,
      startDate,
      dueDate,
    })
  }

  const deleteTask = (id: number) => {
    const text = allTasks.find(task => task.id === id)?.text ?? ''
    const timestamp = Date.now()
    store.commit(events.taskDeleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action: 'Deleted', entityType: 'task', entityId: id, entityText: text, timestamp }))
    embed.mutate({ id: String(id), type: 'task', action: 'delete', content: '' })
    if (selectedTaskId === id) setSelectedTaskId(null)
  }

  const toggleTask = (id: number, completed: boolean) => {
    const text = allTasks.find(task => task.id === id)?.text ?? ''
    const timestamp = Date.now()
    const action = completed ? 'Uncompleted' : 'Completed'
    store.commit(completed ? events.taskUncompleted({ id }) : events.taskCompleted({ id }))
    store.commit(events.historyRecorded({ id: timestamp, action, entityType: 'task', entityId: id, entityText: text, timestamp }))
  }

  const kanbanColumns = useMemo(
    () => allProjects.map(project => ({ id: `project-${project.id}`, name: project.name })),
    [allProjects]
  )

  const kanbanData = useMemo(
    () => allTasks.map(task => ({ id: String(task.id), name: task.text, column: `project-${task.projectId}` })),
    [allTasks]
  )

  const kanbanTaskById = useMemo(
    () => new Map(allTasks.map(task => [String(task.id), { id: task.id, text: task.text, priority: task.priority }])),
    [allTasks]
  )

  const handleKanbanDataChange = (nextData: { id: string; name: string; column: string }[]) => {
    const previousProjectByTaskId = new Map(allTasks.map(task => [String(task.id), task.projectId]))

    for (const item of nextData) {
      const projectId = Number(item.column.replace('project-', ''))
      if (!Number.isFinite(projectId)) continue
      const beforeProjectId = previousProjectByTaskId.get(item.id)
      if (beforeProjectId === undefined || beforeProjectId === projectId) continue
      upsertTask(Number(item.id), { projectId })
    }
  }

  const calendarFeatures = useMemo<CalendarFeature[]>(() => {
    return allTasks.map(task => {
      const startAt = new Date(task.startDate || task.createdAt)
      return {
        id: String(task.id),
        name: task.text,
        startAt,
        endAt: startAt,
        status: {
          id: String(task.priority),
          name: PRIORITY_LABEL[task.priority],
          color: PRIORITY_DOT[task.priority],
        },
      }
    })
  }, [allTasks])

  const ganttGroups = useMemo(() => {
    return allProjects.map(project => {
      const features: GanttFeature[] = allTasks
        .filter(task => task.projectId === project.id)
        .map(task => {
          const startAt = new Date(task.startDate || task.createdAt)
          const endTs = task.dueDate > 0 ? task.dueDate : (task.startDate || task.createdAt) + DAY_MS
          const endAt = new Date(endTs)

          return {
            id: String(task.id),
            name: task.text,
            startAt,
            endAt,
            status: {
              id: String(task.priority),
              name: PRIORITY_LABEL[task.priority],
              color: PRIORITY_DOT[task.priority],
            },
            lane: String(project.id),
          }
        })

      return { project, features }
    })
  }, [allProjects, allTasks])

  const handleGanttMove = (id: string, startAt: Date, endAt: Date | null) => {
    upsertTask(Number(id), {
      startDate: startAt.getTime(),
      dueDate: endAt ? endAt.getTime() : 0,
    })
  }

  const tableRows = useMemo(
    () => allTasks.map(task => ({
      id: task.id,
      text: task.text,
      projectId: task.projectId,
      priority: task.priority,
      startDate: task.startDate || task.createdAt,
      dueDate: task.dueDate,
      completed: task.completed,
    })),
    [allTasks]
  )

  const tableColumns = useMemo<ColumnDef<(typeof tableRows)[number]>[]>(() => [
    {
      accessorKey: 'text',
      header: ({ column }) => <TableColumnHeader column={column} title="Task" />,
      cell: ({ row }) => (
        <input
          value={row.original.text}
          onChange={event => upsertTask(row.original.id, { text: event.target.value })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        />
      ),
    },
    {
      accessorKey: 'projectId',
      header: ({ column }) => <TableColumnHeader column={column} title="Project" />,
      cell: ({ row }) => (
        <select
          value={row.original.projectId}
          onChange={event => upsertTask(row.original.id, { projectId: Number(event.target.value) })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {allProjects.map(project => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      ),
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => <TableColumnHeader column={column} title="Priority" />,
      cell: ({ row }) => (
        <select
          value={row.original.priority}
          onChange={event => upsertTask(row.original.id, { priority: Number(event.target.value) })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {[1, 2, 3, 4].map(priority => (
            <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>
          ))}
        </select>
      ),
    },
    {
      accessorKey: 'startDate',
      header: ({ column }) => <TableColumnHeader column={column} title="Start" />,
      cell: ({ row }) => (
        <input
          type="date"
          value={dateInput(row.original.startDate)}
          onChange={event => upsertTask(row.original.id, { startDate: toTimestamp(event.target.value, row.original.startDate) })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        />
      ),
    },
    {
      accessorKey: 'dueDate',
      header: ({ column }) => <TableColumnHeader column={column} title="Due" />,
      cell: ({ row }) => (
        <input
          type="date"
          value={dateInput(row.original.dueDate)}
          onChange={event => upsertTask(row.original.id, { dueDate: event.target.value ? new Date(event.target.value).getTime() : 0 })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        />
      ),
    },
  ], [allProjects, tableRows])

  const openTaskEditor = (taskId: number) => {
    const task = allTasks.find(item => item.id === taskId)
    if (!task) return
    setSelectedTaskId(taskId)
    setEditTaskForm(hydrateTaskForm(task))
  }

  return (
    <div className="relative h-full min-h-0">
      <Dialog
        open={isProjectDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setProjectForm(EMPTY_PROJECT_CREATE_FORM)
            closeDialog()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new project to organize tasks.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              type="number"
              min={1}
              step={1}
              value={projectForm.id}
              onChange={e => setProjectForm({ ...projectForm, id: e.target.value })}
              placeholder="Project ID (optional)"
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
            />
            <input
              type="text"
              value={projectForm.name}
              onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="Project name"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
            />
            <textarea
              value={projectForm.description}
              onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setProjectForm(EMPTY_PROJECT_CREATE_FORM)
              closeDialog()
            }}>
              Cancel
            </Button>
            <Button onClick={createProject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTaskDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateTaskForm(EMPTY_TASK_CREATE_FORM)
            closeDialog()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Add a task and assign it to a project or inbox.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              type="text"
              value={createTaskForm.text}
              onChange={e => setCreateTaskForm({ ...createTaskForm, text: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createTask()}
              placeholder="Task name"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
            />
            <textarea
              value={createTaskForm.description}
              onChange={e => setCreateTaskForm({ ...createTaskForm, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md resize-none"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={createTaskForm.projectId}
                onChange={e => setCreateTaskForm({ ...createTaskForm, projectId: Number(e.target.value) })}
                className="w-full px-2 py-2 text-sm border border-input bg-background rounded-md"
              >
                {allProjects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <select
                value={createTaskForm.priority}
                onChange={e => setCreateTaskForm({ ...createTaskForm, priority: Number(e.target.value) })}
                className="w-full px-2 py-2 text-sm border border-input bg-background rounded-md"
              >
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
                <option value={4}>Critical</option>
              </select>
              <input
                type="date"
                value={createTaskForm.startDate}
                onChange={e => setCreateTaskForm({ ...createTaskForm, startDate: e.target.value })}
                className="w-full px-2 py-2 text-sm border border-input bg-background rounded-md"
              />
              <input
                type="date"
                value={createTaskForm.dueDate}
                onChange={e => setCreateTaskForm({ ...createTaskForm, dueDate: e.target.value })}
                className="w-full px-2 py-2 text-sm border border-input bg-background rounded-md"
              />
            </div>
            <input
              type="text"
              value={createTaskForm.labels}
              onChange={e => setCreateTaskForm({ ...createTaskForm, labels: e.target.value })}
              placeholder="Labels (comma separated)"
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateTaskForm(EMPTY_TASK_CREATE_FORM)
              closeDialog()
            }}>
              Cancel
            </Button>
            <Button onClick={createTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {view === 'list' && (
        <ProjectsListView
          projects={projects}
          allTasks={allTasks}
          editingProjectId={editingProjectId}
          editProjectForm={editProjectForm}
          onEditProjectFormChange={setEditProjectForm}
          onStartProjectEdit={(project) => {
            setEditingProjectId(project.id)
            setEditProjectForm(createEditProjectForm(project))
          }}
          onCancelProjectEdit={() => setEditingProjectId(null)}
          onSaveProjectEdit={saveProjectEdit}
          onDeleteProject={deleteProject}
          onToggleTask={toggleTask}
          onOpenTaskEditor={openTaskEditor}
          onDeleteTask={deleteTask}
        />
      )}

      {view === 'kanban' && (
        <ProjectsKanbanView
          columns={kanbanColumns}
          data={kanbanData}
          priorityLabel={PRIORITY_LABEL}
          taskById={kanbanTaskById}
          onDataChange={handleKanbanDataChange}
          onOpenTaskEditor={openTaskEditor}
        />
      )}

      {view === 'table' && <ProjectsTableView columns={tableColumns} rows={tableRows} />}

      {view === 'calendar' && (
        <ProjectsCalendarView
          features={calendarFeatures}
          weekStartsOnMonday={calendarWeekStartsMonday}
          showOutsideDays={calendarShowOutsideDays}
          onWeekStartsOnMondayChange={setCalendarWeekStartsMonday}
          onShowOutsideDaysChange={setCalendarShowOutsideDays}
          onOpenTaskEditor={openTaskEditor}
        />
      )}

      {view === 'gantt' && (
        <ProjectsGanttView
          groups={ganttGroups}
          onOpenTaskEditor={openTaskEditor}
          onMove={handleGanttMove}
        />
      )}

      {projects.length === 0 && !isProjectDialogOpen && (
        <p className="text-center text-muted-foreground mt-12">No projects yet. Create one above!</p>
      )}

      {SIDEBAR_EDITOR_VIEWS.includes(view) && (
        <TaskEditorSidebar
          task={selectedTask}
          form={editTaskForm}
          onChange={setEditTaskForm}
          onSave={saveSelectedTask}
          onDelete={() => selectedTask && deleteTask(selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}
