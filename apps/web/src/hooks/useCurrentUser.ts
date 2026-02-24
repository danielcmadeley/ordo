import { useCallback, useEffect, useState } from 'react'
import { getSessionWithFallback, type SessionData } from '@/lib/authClient'

type CurrentUser = NonNullable<SessionData['user']>

function useCurrentUser(refreshKey?: string) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUser = useCallback(async () => {
    try {
      const session = await getSessionWithFallback()
      setUser(session?.user || null)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    loadUser()
  }, [loadUser, refreshKey])

  return {
    user,
    isLoading,
    reloadUser: loadUser,
  }
}

export { useCurrentUser }
