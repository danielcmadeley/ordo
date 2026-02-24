import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { Spinner } from '@/components/ui/spinner'

import { makePersistedAdapter } from '@livestore/adapter-web'
import { LiveStoreProvider } from '@livestore/react'
import { schema } from '@repo/shared/livestore-schema'
import LiveStoreWorker from '@/livestore/livestore.worker.ts?worker'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { unstable_batchedUpdates as batchUpdates } from 'react-dom'
import { getSessionUserId, getSessionWithFallback } from '@/lib/authClient'

const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
})

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const [storeId, setStoreId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initStore = async () => {
      try {
        const session = await getSessionWithFallback()
        const userId = getSessionUserId(session)

        if (userId) {
          // Set per-user storeId
          setStoreId(`livestore-todo-app-v3-user-${userId}`)
        } else {
          // For unauthenticated users, use a temporary storeId
          // This allows the app to render, but routes will redirect to login
          setStoreId('livestore-todo-app-v3-guest')
        }
      } catch (error) {
        console.error('Failed to initialize store:', error)
        // Fallback to guest storeId on error
        setStoreId('livestore-todo-app-v3-guest')
      } finally {
        setIsLoading(false)
      }
    }
    initStore()
  }, [])

  // Show loading state while determining storeId
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

  // Only render LiveStoreProvider when we have a storeId
  if (!storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Unable to initialize store</p>
      </div>
    )
  }

  return (
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
      <Header />
      <Outlet />
    </LiveStoreProvider>
  )
}
