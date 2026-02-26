import { createContext, useCallback, useContext, useState } from 'react'
import { getSessionWithFallback, type SessionData } from '@/lib/authClient'

type SessionContextValue = {
  session: SessionData | null
  isLoading: boolean
  reload: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode
  initialSession: SessionData | null
}) {
  const [session, setSession] = useState<SessionData | null>(initialSession)
  const [isLoading, setIsLoading] = useState(false)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const s = await getSessionWithFallback()
      setSession(s)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <SessionContext.Provider value={{ session, isLoading, reload }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
