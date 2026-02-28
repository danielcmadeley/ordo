import type { ColumnDef } from '@/components/kibo-ui/table'
import {
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableProvider,
  TableRow,
} from '@/components/kibo-ui/table'

type TableRowData = {
  id: number
  text: string
  projectId: number
  priority: number
  startDate: number
  dueDate: number
  completed: boolean
}

type ProjectsTableViewProps = {
  columns: ColumnDef<TableRowData>[]
  rows: TableRowData[]
}

export function ProjectsTableView({ columns, rows }: ProjectsTableViewProps) {
  return (
    <div className="h-full overflow-hidden">
      <div className="h-full overflow-auto p-4">
        <TableProvider columns={columns} data={rows} className="w-full">
          <TableHeader>
            {({ headerGroup }) => (
              <TableHeaderGroup key={headerGroup.id} headerGroup={headerGroup}>
                {({ header }) => <TableHead key={header.id} header={header} />}
              </TableHeaderGroup>
            )}
          </TableHeader>
          <TableBody>
            {({ row }) => (
              <TableRow key={row.id} row={row}>
                {({ cell }) => <TableCell key={cell.id} cell={cell} />}
              </TableRow>
            )}
          </TableBody>
        </TableProvider>
      </div>
    </div>
  )
}
