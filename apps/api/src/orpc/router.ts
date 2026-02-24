import { os, ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { createAuth } from '../auth'

// Define base context with headers and auth
export const base = os.$context<{
  headers: Headers
  db: D1Database
  auth: ReturnType<typeof createAuth>
}>()

// Auth middleware that validates Better Auth session
export const authMiddleware = base.middleware(async ({ context, next }) => {
  const sessionData = await context.auth.api.getSession({
    headers: context.headers,
  })

  if (!sessionData?.session || !sessionData?.user) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Authentication required',
    })
  }

  // Add session and user to context
  return next({
    context: {
      session: sessionData.session,
      user: sessionData.user,
    },
  })
})

// Authorized base for protected procedures
export const authorized = base.use(authMiddleware)

// Protected: Get current user info
const getMe = authorized
  .meta({
    openapi: {
      method: 'GET',
      path: '/me',
      summary: 'Get current user',
      description: 'Get information about the currently authenticated user',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  })
  .output(z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().optional(),
  }))
  .handler(async ({ context }) => {
    return {
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
    }
  })

// Export the router using base.router() for proper typing with context
export const appRouter = base.router({
  me: getMe,
})

// Export type for client
export type AppRouter = typeof appRouter