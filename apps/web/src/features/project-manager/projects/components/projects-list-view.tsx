import { Button } from '@/components/ui/button'
import {
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  dateInput,
  formatDate,
  parseLabels,
  type ProjectEditFormState,
  type ProjectRow,
  type TaskRow,
} from '@/features/project-manager/projects/shared'

type ProjectsListViewProps = {
  projects: ProjectRow[]
  allTasks: TaskRow[]
  editingProjectId: number | null
  editProjectForm: ProjectEditFormState
  onEditProjectFormChange: (value: ProjectEditFormState) => void
  onStartProjectEdit: (project: ProjectRow) => void
  onCancelProjectEdit: () => void
  onSaveProjectEdit: () => void
  onDeleteProject: (projectId: number) => void
  onToggleTask: (taskId: number, completed: boolean) => void
  onOpenTaskEditor: (taskId: number) => void
  onDeleteTask: (taskId: number) => void
}

export function ProjectsListView({
  projects,
  allTasks,
  editingProjectId,
  editProjectForm,
  onEditProjectFormChange,
  onStartProjectEdit,
  onCancelProjectEdit,
  onSaveProjectEdit,
  onDeleteProject,
  onToggleTask,
  onOpenTaskEditor,
  onDeleteTask,
}: ProjectsListViewProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="space-y-4 p-4">
        {projects.map(project => {
          const projectTasks = allTasks.filter(task => task.projectId === project.id)
          const isEditingProject = editingProjectId === project.id

          return (
            <div key={project.id} className="bg-card text-card-foreground rounded-xl border border-border">
              {isEditingProject ? (
                <div className="p-4 border-b border-border">
                  <input
                    type="text"
                    value={editProjectForm.name}
                    onChange={e => onEditProjectFormChange({ ...editProjectForm, name: e.target.value })}
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md mb-2"
                  />
                  <textarea
                    value={editProjectForm.description}
                    onChange={e => onEditProjectFormChange({ ...editProjectForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md mb-2 resize-none"
                  />
                  <input
                    type="date"
                    value={editProjectForm.startDate}
                    onChange={e => onEditProjectFormChange({ ...editProjectForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md mb-3"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={onCancelProjectEdit} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                    <Button onClick={onSaveProjectEdit}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{project.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">#{project.id}</span>
                      <span className="text-xs text-muted-foreground">{projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}</span>
                    </div>
                    {project.description && <p className="text-xs text-muted-foreground mt-0.5">{project.description}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onStartProjectEdit(project)}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteProject(project.id)}
                      className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-border">
                {projectTasks.map(task => (
                  <div key={task.id} className={`flex items-start gap-3 px-4 py-3 ${task.completed ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggleTask(task.id, task.completed)}
                      className="mt-0.5 w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenTaskEditor(task.id)}
                          className={`text-sm font-medium text-foreground hover:underline ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                        >
                          {task.text}
                        </button>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[task.priority]}`}>
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                        {parseLabels(task.labels).map(label => (
                          <span key={label} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{label}</span>
                        ))}
                      </div>
                      {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                      <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                        <span>Start {formatDate(task.startDate || task.createdAt)}</span>
                        {task.dueDate > 0 && <span>Due {formatDate(task.dueDate)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => onOpenTaskEditor(task.id)}
                        className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-2" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function createEditProjectForm(project: ProjectRow): ProjectEditFormState {
  return {
    name: project.name,
    description: project.description,
    startDate: dateInput(project.startDate || project.createdAt),
  }
}
