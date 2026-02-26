import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { requireAuthSession } from '@/lib/auth-guards'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useStore } from '@livestore/react'
import { tables } from '@repo/shared/livestore-schema'
import { queryDb } from '@livestore/livestore'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  beforeLoad: requireAuthSession,
})

const ACTION_STYLES: Record<string, string> = {
  Created: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Uncompleted: 'bg-yellow-100 text-yellow-700',
  Deleted: 'bg-red-100 text-red-700',
  Updated: 'bg-purple-100 text-purple-700',
}

const ENTITY_STYLES: Record<string, string> = {
  task: 'bg-gray-100 text-gray-600',
  project: 'bg-indigo-100 text-indigo-600',
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SettingsPage() {
  const { user: sessionUser, isLoading } = useCurrentUser()
  const { store } = useStore()

  const history$ = useMemo(
    () => queryDb(() => tables.history.where({}), { label: 'history' }),
    []
  )
  const historyRows = store.useQuery(history$)
  const sortedHistory = [...historyRows].sort((a, b) => b.timestamp - a.timestamp)

  const user = sessionUser?.id && sessionUser?.email
    ? {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      image: sessionUser.image,
    }
    : null

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600">Unable to load user information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Settings</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Account Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-800 font-mono text-sm">
                {user.id}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-800">
                {user.email}
              </div>
            </div>

            {user.name && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <div className="px-3 py-2 bg-gray-100 rounded text-gray-800">
                  {user.name}
                </div>
              </div>
            )}

            {user.image && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture</label>
                <img
                  src={user.image}
                  alt="Profile"
                  className="w-16 h-16 rounded-full"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Activity History</h2>
          <p className="text-sm text-gray-500 mb-4">{sortedHistory.length} events recorded</p>

          {sortedHistory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No activity yet. Create some tasks or projects to see your history here.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {sortedHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-gray-50"
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_STYLES[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {entry.action}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_STYLES[entry.entityType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {entry.entityType}
                    </span>
                  </div>
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {entry.entityText}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatDate(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Application</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">
                <strong>Ordo</strong> - Your personal task management app
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Built with React, TanStack Router, LiveStore, and oRPC
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
