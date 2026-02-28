import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NetworkStatus = 'online' | 'offline'

type NetworkStats = {
  currentStatus: NetworkStatus
  lastStatusChangeAt: number
  lastOnlineAt: number | null
  lastOfflineAt: number | null
  totalOnlineMs: number
  totalOfflineMs: number
}

const STORAGE_KEY = 'ordo.network.stats.v1'

function createDefaultStats(now: number, currentStatus: NetworkStatus): NetworkStats {
  return {
    currentStatus,
    lastStatusChangeAt: now,
    lastOnlineAt: currentStatus === 'online' ? now : null,
    lastOfflineAt: currentStatus === 'offline' ? now : null,
    totalOnlineMs: 0,
    totalOfflineMs: 0,
  }
}

function parseStoredStats(value: string | null): NetworkStats | null {
  if (!value) return null

  try {
    const data = JSON.parse(value) as Partial<NetworkStats>
    if (!data || (data.currentStatus !== 'online' && data.currentStatus !== 'offline')) return null
    if (typeof data.lastStatusChangeAt !== 'number') return null
    if (typeof data.totalOnlineMs !== 'number' || typeof data.totalOfflineMs !== 'number') return null

    return {
      currentStatus: data.currentStatus,
      lastStatusChangeAt: data.lastStatusChangeAt,
      lastOnlineAt: typeof data.lastOnlineAt === 'number' ? data.lastOnlineAt : null,
      lastOfflineAt: typeof data.lastOfflineAt === 'number' ? data.lastOfflineAt : null,
      totalOnlineMs: data.totalOnlineMs,
      totalOfflineMs: data.totalOfflineMs,
    }
  } catch {
    return null
  }
}

function saveStats(stats: NetworkStats) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
  return `${remainingSeconds}s`
}

function formatTimestamp(ts: number | null) {
  if (!ts) return 'Never'

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ts)
}

export function NetworkStatusIndicator() {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const currentStatus: NetworkStatus = window.navigator.onLine ? 'online' : 'offline'
    const currentTime = Date.now()
    const stored = parseStoredStats(window.localStorage.getItem(STORAGE_KEY))
    let nextStats = stored ?? createDefaultStats(currentTime, currentStatus)

    const elapsedSinceLastChange = Math.max(0, currentTime - nextStats.lastStatusChangeAt)
    if (elapsedSinceLastChange > 0) {
      if (nextStats.currentStatus === 'online') {
        nextStats = { ...nextStats, totalOnlineMs: nextStats.totalOnlineMs + elapsedSinceLastChange }
      } else {
        nextStats = { ...nextStats, totalOfflineMs: nextStats.totalOfflineMs + elapsedSinceLastChange }
      }
      nextStats = { ...nextStats, lastStatusChangeAt: currentTime }
    }

    if (nextStats.currentStatus !== currentStatus) {
      nextStats = {
        ...nextStats,
        currentStatus,
        lastStatusChangeAt: currentTime,
        lastOnlineAt: currentStatus === 'online' ? currentTime : nextStats.lastOnlineAt,
        lastOfflineAt: currentStatus === 'offline' ? currentTime : nextStats.lastOfflineAt,
      }
    }

    saveStats(nextStats)
    setStats(nextStats)

    const handleStatusChange = (nextStatus: NetworkStatus) => {
      setStats(previous => {
        if (!previous) return previous

        const changedAt = Date.now()
        const elapsed = Math.max(0, changedAt - previous.lastStatusChangeAt)
        const updated: NetworkStats = {
          ...previous,
          totalOnlineMs: previous.totalOnlineMs + (previous.currentStatus === 'online' ? elapsed : 0),
          totalOfflineMs: previous.totalOfflineMs + (previous.currentStatus === 'offline' ? elapsed : 0),
          currentStatus: nextStatus,
          lastStatusChangeAt: changedAt,
          lastOnlineAt: nextStatus === 'online' ? changedAt : previous.lastOnlineAt,
          lastOfflineAt: nextStatus === 'offline' ? changedAt : previous.lastOfflineAt,
        }

        saveStats(updated)
        return updated
      })
    }

    const handleOnline = () => handleStatusChange('online')
    const handleOffline = () => handleStatusChange('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.clearInterval(timer)
    }
  }, [])

  const derived = useMemo(() => {
    if (!stats) return null

    const activeElapsed = Math.max(0, now - stats.lastStatusChangeAt)
    return {
      isOnline: stats.currentStatus === 'online',
      totalOnlineMs: stats.totalOnlineMs + (stats.currentStatus === 'online' ? activeElapsed : 0),
      totalOfflineMs: stats.totalOfflineMs + (stats.currentStatus === 'offline' ? activeElapsed : 0),
      onlineSince: stats.currentStatus === 'online' ? stats.lastStatusChangeAt : stats.lastOnlineAt,
      offlineSince: stats.currentStatus === 'offline' ? stats.lastStatusChangeAt : stats.lastOfflineAt,
    }
  }, [now, stats])

  if (!derived || !stats) {
    return null
  }

  const resetStats = () => {
    const currentStatus: NetworkStatus = window.navigator.onLine ? 'online' : 'offline'
    const currentTime = Date.now()
    const reset = createDefaultStats(currentTime, currentStatus)
    saveStats(reset)
    setStats(reset)
    setNow(currentTime)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" size="sm" className="h-6 gap-2 px-2 text-xs text-muted-foreground" />}
      >
        <span
          aria-hidden
          className={`h-2.5 w-2.5 rounded-full ${derived.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}
        />
        <span>{derived.isOnline ? 'Online' : 'Offline'}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Network Details</div>
          <DropdownMenuSeparator />

          <div className="space-y-1 px-2 py-1 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-foreground">{derived.isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Time online</span>
              <span className="font-medium text-foreground">{formatDuration(derived.totalOnlineMs)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Time offline</span>
              <span className="font-medium text-foreground">{formatDuration(derived.totalOfflineMs)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Last offline</span>
              <span className="text-foreground">{formatTimestamp(stats.lastOfflineAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Last change</span>
              <span className="text-foreground">{formatTimestamp(stats.lastStatusChangeAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Online since</span>
              <span className="text-foreground">{formatTimestamp(derived.onlineSince)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Offline since</span>
              <span className="text-foreground">{formatTimestamp(derived.offlineSince)}</span>
            </div>
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={resetStats}>Reset stats</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
