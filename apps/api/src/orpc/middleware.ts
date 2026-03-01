import { os, ORPCError } from '@orpc/server'
import type { createAuth } from '../auth'
import type { Bindings } from '../index'

export const base = os.$context<{
  headers: Headers
  db: D1Database
  auth: ReturnType<typeof createAuth>
  env: Bindings
}>()

export const authMiddleware = base.middleware(async ({ context, next }) => {
  const sessionData = await context.auth.api.getSession({
    headers: context.headers,
  })

  if (!sessionData?.session || !sessionData?.user) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Authentication required',
    })
  }

  return next({
    context: {
      session: sessionData.session,
      user: sessionData.user,
    },
  })
})

export const authorized = base.use(authMiddleware)
