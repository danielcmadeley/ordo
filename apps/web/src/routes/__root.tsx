import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'

import { makePersistedAdapter } from '@livestore/adapter-web'
import { LiveStoreProvider } from '@livestore/react'
import { schema } from '@repo/shared/livestore-schema'
import LiveStoreWorker from '@/livestore/livestore.worker.ts?worker'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'
import { getSessionUserId, getSessionWithFallback, type SessionData } from '@/lib/authClient'
import { SessionProvider } from '@/lib/session-context'

const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
})

export const Route = createRootRoute({
  component: RootComponent,
})

function AppLayout() {
  const isLogin = useRouterState({ select: (s) => s.location.pathname === '/login' })

  if (isLogin) {
    return <Outlet />
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-[30px] shrink-0 items-center gap-2 border-b px-2">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
        <footer className="flex h-[20px] shrink-0 items-center border-t px-2" />
      </SidebarInset>
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
          setStoreId(`livestore-app-v5-user-${userId}`)
        } else {
          setStoreId('livestore-app-v5-guest')
        }
      } catch (error) {
        console.error('Failed to initialize store:', error)
        setStoreId('livestore-app-v5-guest')
      } finally {
        setIsLoading(false)
      }
    }
    initStore()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Unable to initialize store</p>
      </div>
    )
  }

  return (
    <SessionProvider initialSession={initialSession}>
      <LiveStoreProvider
        schema={schema}
        adapter={adapter}
        renderLoading={() => (
          <div className="min-h-screen flex items-center justify-center">
            <Spinner size={48} />
          </div>
        )}
        storeId={storeId}
        batchUpdates={batchUpdates}
      >
        <AppLayout />
      </LiveStoreProvider>
    </SessionProvider>
  )
}
