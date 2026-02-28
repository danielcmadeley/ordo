import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import {
  BookOpenIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  HomeIcon,
  RectangleGroupIcon,
  Squares2X2Icon,
  TableCellsIcon,
  QueueListIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline'
import { AppSidebar } from '@/components/AppSidebar'
import { FooterLocationClock } from '@/components/FooterLocationClock'
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'

import { makePersistedAdapter } from '@livestore/adapter-web'
import { LiveStoreProvider } from '@livestore/react'
import { schema } from '@ordo/shared/livestore-schema'
import LiveStoreWorker from '@/livestore/livestore.worker.ts?worker'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'
import { getSessionUserId, getSessionWithFallback, type SessionData } from '@/lib/authClient'
import { isProjectView, PROJECT_VIEW_OPTIONS, type ProjectView } from '@/lib/project-views'
import { SessionProvider } from '@/lib/session-context'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const LIVESTORE_STORE_VERSION = 'v6'

const PROJECT_VIEW_ICONS = {
  calendar: CalendarDaysIcon,
  gantt: QueueListIcon,
  kanban: Squares2X2Icon,
  list: ListBulletIcon,
  table: TableCellsIcon,
} as const

type BreadcrumbItem = {
  label: string
  to: string
  search?: Record<string, string | undefined>
}

type RootSearch = Record<string, unknown>

type MobileNavItem = {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  active: (pathname: string) => boolean
  goTo: () => void
}

function getBreadcrumbs(pathname: string, currentProjectView: string): BreadcrumbItem[] {
  if (pathname === '/') {
    return [{ label: 'Dashboard', to: '/' }]
  }

  if (pathname.startsWith('/project-manager')) {
    const base: BreadcrumbItem[] = [{ label: 'Project Manager', to: '/project-manager/dashboard' }]

    if (pathname === '/project-manager/dashboard') return [...base, { label: 'Dashboard', to: '/project-manager/dashboard' }]
    if (pathname === '/project-manager/inbox') return [...base, { label: 'Inbox', to: '/project-manager/inbox' }]
    if (pathname === '/project-manager/projects') return [...base, { label: 'Projects', to: '/project-manager/projects', search: { view: currentProjectView, dialog: undefined } }]
    if (pathname === '/project-manager/tasks') return [...base, { label: 'Tasks', to: '/project-manager/tasks' }]
    if (pathname === '/project-manager/milestones') return [...base, { label: 'Milestones', to: '/project-manager/milestones' }]

    return base
  }

  if (pathname === '/knowledge-base') return [{ label: 'Knowledge Base', to: '/knowledge-base' }]
  if (pathname === '/journal') return [{ label: 'Journal', to: '/journal' }]
  if (pathname === '/crm') return [{ label: 'CRM', to: '/crm' }]
  if (pathname === '/finance') return [{ label: 'Finance', to: '/finance' }]
  if (pathname === '/settings') return [{ label: 'Settings', to: '/settings' }]

  return [{ label: 'App', to: '/' }]
}

const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
})

export const Route = createRootRoute({
  component: RootComponent,
})

function AppLayout() {
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const search = location.search as RootSearch
  const isLogin = location.pathname === '/login'
  const isProjects = location.pathname === '/project-manager/projects'
  const currentProjectView: ProjectView = isProjectView(search.view)
    ? (search.view as ProjectView)
    : 'list'
  const currentDialog = search.dialog
  const isProjectDialogOpen = currentDialog === 'project'
  const isTaskDialogOpen = currentDialog === 'task'
  const breadcrumbs = getBreadcrumbs(location.pathname, currentProjectView)

  const navigateProjectSearch = (next: { view: ProjectView; dialog: string | undefined }) => {
    navigate({
      to: '/project-manager/projects',
      search: {
        view: next.view,
        dialog: next.dialog,
      },
      replace: true,
    })
  }

  if (isLogin) {
    return <Outlet />
  }

  const mobileNavItems: MobileNavItem[] = [
    {
      key: 'home',
      label: 'Home',
      icon: HomeIcon,
      active: pathname => pathname === '/',
      goTo: () => navigate({ to: '/' }),
    },
    {
      key: 'projects',
      label: 'Projects',
      icon: RectangleGroupIcon,
      active: pathname => pathname.startsWith('/project-manager'),
      goTo: () => navigate({ to: '/project-manager/projects', search: { view: 'list', dialog: undefined } }),
    },
    {
      key: 'knowledge',
      label: 'Notes',
      icon: BookOpenIcon,
      active: pathname => pathname === '/knowledge-base',
      goTo: () => navigate({ to: '/knowledge-base' }),
    },
    {
      key: 'journal',
      label: 'Journal',
      icon: CalendarDaysIcon,
      active: pathname => pathname === '/journal',
      goTo: () => navigate({ to: '/journal' }),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: Cog6ToothIcon,
      active: pathname => pathname === '/settings',
      goTo: () => navigate({ to: '/settings' }),
    },
  ]

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[78px] md:pb-[25px]">
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
          <header className="flex h-[30px] shrink-0 items-center gap-2 px-2">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <nav className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((item, index) => (
                <div key={`${item.to}-${item.label}`} className="flex min-w-0 items-center gap-1">
                  {index > 0 && <span>/</span>}
                  <button
                    type="button"
                    className="truncate hover:text-foreground"
                    onClick={() => {
                      navigate({
                        to: item.to,
                        search: item.search,
                      })
                    }}
                  >
                    {item.label}
                  </button>
                </div>
              ))}
            </nav>
            {isProjects && (
              <div className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
                <Button
                  size="sm"
                  variant={isProjectDialogOpen ? 'default' : 'outline'}
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    navigateProjectSearch({ view: currentProjectView, dialog: 'project' })
                  }}
                >
                  New Project
                </Button>
                <Button
                  size="sm"
                  variant={isTaskDialogOpen ? 'default' : 'outline'}
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    navigateProjectSearch({ view: currentProjectView, dialog: 'task' })
                  }}
                >
                  New Task
                </Button>
                {PROJECT_VIEW_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={currentProjectView === option ? 'default' : 'ghost'}
                    className="h-6 w-6 p-0"
                    title={option}
                    aria-label={`Switch to ${option} view`}
                    onClick={() => {
                      navigateProjectSearch({ view: option, dialog: typeof currentDialog === 'string' ? currentDialog : undefined })
                    }}
                  >
                    {(() => {
                      const Icon = PROJECT_VIEW_ICONS[option]
                      return <Icon className="h-4 w-4" />
                    })()}
                  </Button>
                ))}
              </div>
            )}
          </header>
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden rounded-tl-xl border-t border-l border-border bg-content-background/25">
            <div className="h-full overflow-y-auto overflow-x-hidden overscroll-contain">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
      </div>
      <footer className="fixed inset-x-0 bottom-0 z-50 hidden h-[25px] items-center justify-between border-t border-border px-3 md:flex">
        <NetworkStatusIndicator />
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-3 w-px bg-border" />
          <FooterLocationClock />
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map(item => {
            const Icon = item.icon
            const isActive = item.active(location.pathname)

            return (
              <button
                key={item.key}
                type="button"
                onClick={item.goTo}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] transition-colors',
                  isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
                aria-label={item.label}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </SidebarProvider>
  )
}

function RootComponent() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [initialSession, setInitialSession] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initStore = async () => {
      try {
        const session = await getSessionWithFallback()
        const userId = getSessionUserId(session)

        setInitialSession(session)

        if (userId) {
          setStoreId(`livestore-app-${LIVESTORE_STORE_VERSION}-user-${userId}`)
        } else {
          setStoreId(`livestore-app-${LIVESTORE_STORE_VERSION}-guest`)
        }
      } catch (error) {
        console.error('Failed to initialize store:', error)
        setStoreId(`livestore-app-${LIVESTORE_STORE_VERSION}-guest`)
      } finally {
        setIsLoading(false)
      }
    }
    initStore()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Unable to initialize store</p>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <SessionProvider initialSession={initialSession}>
        <LiveStoreProvider
          schema={schema}
          adapter={adapter}
          renderLoading={() => (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
              <Spinner size={48} />
            </div>
          )}
          storeId={storeId}
          batchUpdates={batchUpdates}
        >
          <AppLayout />
        </LiveStoreProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
