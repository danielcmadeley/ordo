import { Button } from '@/components/ui/button'
import type { TaskFormState, TaskRow } from '@/features/project-manager/projects/shared'

type TaskEditorSidebarProps = {
  task: TaskRow | null
  form: TaskFormState
  onChange: (value: TaskFormState) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

export function TaskEditorSidebar({
  task,
  form,
  onChange,
  onSave,
  onDelete,
  onClose,
}: TaskEditorSidebarProps) {
  const isOpen = task !== null

  return (
    <>
      <div
        className={`absolute inset-0 z-40 bg-black/30 transition-opacity ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute top-0 right-0 z-50 h-full border-l border-border bg-card p-4 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: '50vw', maxWidth: '100%' }}
      >
        {task ? (
          <div className="flex h-full flex-col gap-3 overflow-auto">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Edit task</h3>
              <div className="flex items-center gap-2">
                <button onClick={onDelete} className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded">Delete</button>
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              </div>
            </div>
            <InlineTaskForm form={form} onChange={onChange} onSubmit={onSave} onCancel={onClose} submitLabel="Save changes" />
          </div>
        ) : null}
      </aside>
    </>
  )
}

function InlineTaskForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: TaskFormState
  onChange: (f: TaskFormState) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
}) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={form.text}
        onChange={e => onChange({ ...form, text: e.target.value })}
        onKeyDown={e => e.key === 'Enter' && onSubmit()}
        placeholder="Task name"
        autoFocus
        className="w-full px-3 py-1.5 text-sm border border-input bg-background rounded-md"
      />
      <textarea
        value={form.description}
        onChange={e => onChange({ ...form, description: e.target.value })}
        placeholder="Description (optional)"
        rows={2}
        className="w-full px-3 py-1.5 text-sm border border-input bg-background rounded-md resize-none"
      />
      <div className="flex gap-2">
        <select
          value={form.priority}
          onChange={e => onChange({ ...form, priority: Number(e.target.value) })}
          className="flex-1 px-2 py-1.5 text-sm border border-input bg-background rounded-md"
        >
          <option value={1}>Low</option>
          <option value={2}>Medium</option>
          <option value={3}>High</option>
          <option value={4}>Critical</option>
        </select>
        <input
          type="date"
          value={form.startDate}
          onChange={e => onChange({ ...form, startDate: e.target.value })}
          className="flex-1 px-2 py-1.5 text-sm border border-input bg-background rounded-md"
        />
        <input
          type="date"
          value={form.dueDate}
          onChange={e => onChange({ ...form, dueDate: e.target.value })}
          className="flex-1 px-2 py-1.5 text-sm border border-input bg-background rounded-md"
        />
      </div>
      <input
        type="text"
        value={form.labels}
        onChange={e => onChange({ ...form, labels: e.target.value })}
        placeholder="Labels (comma separated)"
        className="w-full px-3 py-1.5 text-sm border border-input bg-background rounded-md"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        <Button onClick={onSubmit}>{submitLabel}</Button>
      </div>
    </div>
  )
}
