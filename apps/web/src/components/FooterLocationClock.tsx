import { useEffect, useMemo, useState } from 'react'

function getCityLabel() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const city = timeZone.split('/').pop() ?? 'Local'
  return city.replaceAll('_', ' ')
}

function formatDateTime(date: Date) {
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)

  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return { dateLabel, timeLabel }
}

export function FooterLocationClock() {
  const [now, setNow] = useState(() => new Date())
  const cityLabel = useMemo(() => getCityLabel(), [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const { dateLabel, timeLabel } = formatDateTime(now)

  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span>{cityLabel}</span>
      <span>{dateLabel}</span>
      <span>{timeLabel}</span>
    </div>
  )
}
