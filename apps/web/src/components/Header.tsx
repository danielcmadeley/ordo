import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Menu01Icon,
  Cancel01Icon,
  Logout01Icon,
  UserIcon,
  Home01Icon,
  Folder01Icon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import authClient from '@/lib/authClient'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { clearCachedSession } from '@/lib/session-cache'

export default function Header() {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const [isOpen, setIsOpen] = useState(false)
  const { user, isLoading } = useCurrentUser(routerState.location.pathname)

  const handleLogout = async () => {
    try {
      await authClient.signOut()
      clearCachedSession()
      navigate({ to: '/login' })
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  return (
    <>
      <header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
        <div className="flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <HugeiconsIcon icon={Menu01Icon} size={24} />
          </button>
          <h1 className="ml-4 text-xl font-semibold">
            <Link to="/">
              Ordo
            </Link>
          </h1>
        </div>
        
        {/* User Info & Logout */}
        {!isLoading && (
          <>
            {user ? (
              <div className="flex items-center gap-4">
                <Link
                  to="/settings"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                  <HugeiconsIcon icon={UserIcon} size={18} />
                  <span className="hidden sm:inline">{user.name || user.email}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                  aria-label="Logout"
                >
                  <HugeiconsIcon icon={Logout01Icon} size={16} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 text-sm font-medium bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
              >
                Login
              </Link>
            )}
          </>
        )}
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <HugeiconsIcon icon={Home01Icon} size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>

          <Link
            to="/inbox"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <HugeiconsIcon icon={Folder01Icon} size={20} />
            <span className="font-medium">Inbox</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <HugeiconsIcon icon={Settings01Icon} size={20} />
            <span className="font-medium">Settings</span>
          </Link>
        </nav>
      </aside>
    </>
  )
}
