export type ProjectView = 'calendar' | 'gantt' | 'kanban' | 'list' | 'table'

export const PROJECT_VIEW_OPTIONS: ProjectView[] = ['calendar', 'gantt', 'kanban', 'list', 'table']

export function isProjectView(value: unknown): value is ProjectView {
  return typeof value === 'string' && PROJECT_VIEW_OPTIONS.includes(value as ProjectView)
}
