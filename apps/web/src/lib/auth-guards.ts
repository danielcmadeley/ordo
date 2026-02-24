import { redirect } from '@tanstack/react-router'
import { getSessionWithFallback, hasActiveSession } from '@/lib/authClient'

export async function requireAuthSession() {
  const session = await getSessionWithFallback()

  if (!hasActiveSession(session)) {
    throw redirect({ to: '/login' })
  }

  return session
}

export async function redirectAuthenticatedUser() {
  const session = await getSessionWithFallback()

  if (hasActiveSession(session)) {
    throw redirect({ to: '/' })
  }

  return session
}
