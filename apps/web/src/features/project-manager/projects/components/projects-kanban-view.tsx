import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/kibo-ui/kanban'

type KanbanColumn = { id: string; name: string }
type KanbanItem = { id: string; name: string; column: string }
type KanbanTaskMeta = { id: number; text: string; priority: number }

type ProjectsKanbanViewProps = {
  columns: KanbanColumn[]
  data: KanbanItem[]
  priorityLabel: Record<number, string>
  taskById: Map<string, KanbanTaskMeta>
  onDataChange: (nextData: KanbanItem[]) => void
  onOpenTaskEditor: (taskId: number) => void
}

export function ProjectsKanbanView({
  columns,
  data,
  priorityLabel,
  taskById,
  onDataChange,
  onOpenTaskEditor,
}: ProjectsKanbanViewProps) {
  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-x-auto overflow-y-hidden p-4">
        <KanbanProvider columns={columns} data={data} onDataChange={onDataChange} className="h-full min-w-max">
          {column => (
            <KanbanBoard id={column.id} key={column.id} className="w-[300px]">
              <KanbanHeader>{column.name}</KanbanHeader>
              <KanbanCards id={column.id}>
                {item => {
                  const task = taskById.get(item.id)
                  if (!task) return null

                  return (
                    <KanbanCard key={item.id} id={item.id} name={item.name} column={item.column}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full cursor-pointer text-left"
                        onClick={() => onOpenTaskEditor(task.id)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onOpenTaskEditor(task.id)
                          }
                        }}
                      >
                        <p className="m-0 font-medium text-sm text-foreground">{task.text}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{priorityLabel[task.priority]}</p>
                      </div>
                    </KanbanCard>
                  )
                }}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      </div>
    </div>
  )
}
