import { createFileRoute } from '@tanstack/react-router'
import { requireAuthSession } from '@/lib/auth-guards'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  beforeLoad: requireAuthSession,
})

function SettingsPage() {
  const { user: sessionUser, isLoading } = useCurrentUser()
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
