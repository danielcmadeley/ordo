import { useCallback, useMemo } from 'react'
import type { CalendarState } from '@/components/kibo-ui/calendar'
import { useCalendarMonth, useCalendarYear } from '@/components/kibo-ui/calendar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type CalendarFullscreenToolbarProps = {
  weekStartsOnMonday: boolean
  showOutsideDays: boolean
  onWeekStartsOnMondayChange: (value: boolean) => void
  onShowOutsideDaysChange: (value: boolean) => void
}

export function CalendarFullscreenToolbar({
  weekStartsOnMonday,
  showOutsideDays,
  onWeekStartsOnMondayChange,
  onShowOutsideDaysChange,
}: CalendarFullscreenToolbarProps) {
  const [month, setMonth] = useCalendarMonth()
  const [year, setYear] = useCalendarYear()

  const monthLabel = useMemo(
    () => new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [month, year]
  )

  const goPreviousMonth = useCallback(() => {
    if (month === 0) {
      setMonth(11)
      setYear(year - 1)
      return
    }
    setMonth((month - 1) as CalendarState['month'])
  }, [month, setMonth, setYear, year])

  const goNextMonth = useCallback(() => {
    if (month === 11) {
      setMonth(0)
      setYear(year + 1)
      return
    }
    setMonth((month + 1) as CalendarState['month'])
  }, [month, setMonth, setYear, year])

  const jumpToToday = useCallback(() => {
    const today = new Date()
    setMonth(today.getMonth() as CalendarState['month'])
    setYear(today.getFullYear())
  }, [setMonth, setYear])

  return (
    <div className="flex h-[50px] items-center justify-between border-b border-border px-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={goPreviousMonth} aria-label="Previous month">
          <span aria-hidden>&lt;</span>
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={goNextMonth} aria-label="Next month">
          <span aria-hidden>&gt;</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={jumpToToday}>
          Today
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" />}>
            Options
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuCheckboxItem
              checked={weekStartsOnMonday}
              onCheckedChange={checked => onWeekStartsOnMondayChange(checked === true)}
            >
              Week starts on Monday
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showOutsideDays}
              onCheckedChange={checked => onShowOutsideDaysChange(checked === true)}
            >
              Show adjacent month days
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
