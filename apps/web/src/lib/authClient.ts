import { createAuthClient } from "better-auth/client";
import { cloudflareClient } from "better-auth-cloudflare/client";
import { cacheSession, clearCachedSession, getCachedSession } from '@/lib/session-cache'

const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

const authClient = createAuthClient({
  baseURL: apiUrl,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [cloudflareClient()],
});

export type SessionData = {
  session?: {
    userId?: string
  } | null
  user?: {
    id?: string
    name?: string
    email?: string
    image?: string | null
  } | null
}

export function hasActiveSession(session: SessionData | null): session is SessionData & { session: NonNullable<SessionData['session']> } {
  return Boolean(session?.session)
}

export function getSessionUserId(session: SessionData | null) {
  return session?.session?.userId || session?.user?.id || null
}

export async function getSessionWithFallback(): Promise<SessionData | null> {
  try {
    const response = await authClient.getSession()
    const session = response?.data ?? null

    if (session?.session) {
      cacheSession(session)
    } else {
      clearCachedSession()
    }

    return session
  } catch {
    return getCachedSession<SessionData>()
  }
}

export default authClient;
