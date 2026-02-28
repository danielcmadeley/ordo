import type { ProjectView } from '@/lib/project-views'

export type TaskFormState = {
  text: string
  description: string
  priority: number
  labels: string
  dueDate: string
  startDate: string
}

export type TaskCreateFormState = TaskFormState & { projectId: number }

export type ProjectCreateFormState = {
  id: string
  name: string
  description: string
}

export type ProjectEditFormState = {
  name: string
  description: string
  startDate: string
}

export type ProjectRow = {
  id: number
  name: string
  description: string
  createdAt: number
  startDate: number
}

export type TaskRow = {
  id: number
  text: string
  description: string
  completed: boolean
  priority: number
  labels: string
  projectId: number
  createdAt: number
  startDate: number
  dueDate: number
}

export const DAY_MS = 24 * 60 * 60 * 1000

export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Critical',
}

export const PRIORITY_COLOR: Record<number, string> = {
  1: 'bg-muted text-muted-foreground',
  2: 'bg-secondary text-secondary-foreground',
  3: 'bg-accent text-accent-foreground',
  4: 'bg-destructive/15 text-destructive',
}

export const PRIORITY_DOT: Record<number, string> = {
  1: '#9ca3af',
  2: '#4b5563',
  3: '#1f2937',
  4: '#dc2626',
}

export const EMPTY_TASK_FORM: TaskFormState = {
  text: '',
  description: '',
  priority: 1,
  labels: '',
  dueDate: '',
  startDate: '',
}

export const EMPTY_TASK_CREATE_FORM: TaskCreateFormState = {
  ...EMPTY_TASK_FORM,
  projectId: 0,
}

export const EMPTY_PROJECT_CREATE_FORM: ProjectCreateFormState = {
  id: '',
  name: '',
  description: '',
}

export const EMPTY_PROJECT_EDIT_FORM: ProjectEditFormState = {
  name: '',
  description: '',
  startDate: '',
}

export const SIDEBAR_EDITOR_VIEWS: ProjectView[] = ['calendar', 'gantt', 'kanban', 'list']

export function parseLabels(raw: string): string[] {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function dateInput(ts: number) {
  if (!ts) return ''
  return new Date(ts).toISOString().slice(0, 10)
}

export function parseProjectId(raw: string): number | null {
  const normalized = raw.trim()
  if (!normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export function toTimestamp(value: string, fallback: number) {
  if (!value) return fallback
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : fallback
}
