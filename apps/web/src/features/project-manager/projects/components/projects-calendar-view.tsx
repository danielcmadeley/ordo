import type { Feature as CalendarFeature } from '@/components/kibo-ui/calendar'
import { CalendarBody, CalendarHeader, CalendarItem, CalendarProvider } from '@/components/kibo-ui/calendar'
import { CalendarFullscreenToolbar } from '@/features/project-manager/projects/components/calendar-fullscreen-toolbar'

type ProjectsCalendarViewProps = {
  features: CalendarFeature[]
  weekStartsOnMonday: boolean
  showOutsideDays: boolean
  onWeekStartsOnMondayChange: (value: boolean) => void
  onShowOutsideDaysChange: (value: boolean) => void
  onOpenTaskEditor: (taskId: number) => void
}

export function ProjectsCalendarView({
  features,
  weekStartsOnMonday,
  showOutsideDays,
  onWeekStartsOnMondayChange,
  onShowOutsideDaysChange,
  onOpenTaskEditor,
}: ProjectsCalendarViewProps) {
  return (
    <div className="h-full">
      <div className="h-full overflow-hidden">
        <CalendarProvider className="h-full" startDay={weekStartsOnMonday ? 1 : 0}>
          <CalendarFullscreenToolbar
            weekStartsOnMonday={weekStartsOnMonday}
            showOutsideDays={showOutsideDays}
            onWeekStartsOnMondayChange={onWeekStartsOnMondayChange}
            onShowOutsideDaysChange={onShowOutsideDaysChange}
          />
          <CalendarHeader />
          <CalendarBody features={features} showOutsideDays={showOutsideDays}>
            {({ feature }) => (
              <button
                key={feature.id}
                type="button"
                className="w-full text-left"
                onClick={() => onOpenTaskEditor(Number(feature.id))}
              >
                <CalendarItem feature={feature} className="text-[11px]" />
              </button>
            )}
          </CalendarBody>
        </CalendarProvider>
      </div>
    </div>
  )
}
