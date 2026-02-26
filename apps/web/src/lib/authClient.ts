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

// Module-level cache: deduplicates concurrent calls and avoids re-fetching within TTL
const SESSION_TTL_MS = 10_000
let _cached: { data: SessionData | null; at: number } | null = null
let _inflight: Promise<SessionData | null> | null = null

export function invalidateSessionCache() {
  _cached = null
}

export async function getSessionWithFallback(): Promise<SessionData | null> {
  if (_cached && Date.now() - _cached.at < SESSION_TTL_MS) {
    return _cached.data
  }
  if (_inflight) return _inflight

  _inflight = (async () => {
    try {
      const response = await authClient.getSession()
      const session = response?.data ?? null

      if (session?.session) {
        cacheSession(session)
      } else {
        clearCachedSession()
      }

      _cached = { data: session, at: Date.now() }
      return session
    } catch {
      const fallback = getCachedSession<SessionData>()
      _cached = { data: fallback, at: Date.now() }
      return fallback
    } finally {
      _inflight = null
    }
  })()

  return _inflight
}

export default authClient;
