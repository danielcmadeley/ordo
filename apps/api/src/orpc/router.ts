import { z } from 'zod'
import { base, authorized } from './middleware'
import { ORPCError } from '@orpc/server'
import { gcFetchJson } from '../gocardless/client'
import { handleAccountScopeRequest, clearAccountCache } from '../gocardless/cache'
import allInstitutions from '../gocardless/institutions.json'

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

export const appRouter = base.router({
  me: getMe,
  xScheduledPostsCreate: authorized
    .meta({
      openapi: {
        method: 'POST',
        path: '/x/scheduled-posts',
        summary: 'Create one-time scheduled X post',
        tags: ['X'],
        security: [{ bearerAuth: [] }],
      },
    })
    .input(z.object({
      text: z.string().trim().min(1).max(280),
      scheduledFor: z.number().int(),
    }))
    .output(z.object({
      id: z.string(),
      status: z.enum(['pending', 'queued', 'sending', 'sent', 'failed', 'cancelled']),
      text: z.string(),
      scheduledFor: z.number(),
      createdAt: z.number(),
      updatedAt: z.number(),
    }))
    .handler(async ({ context, input }) => {
      const now = Date.now()
      if (input.scheduledFor < now + 60_000) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'scheduledFor must be at least 60 seconds in the future',
        })
      }

      const account = await context.db
        .prepare('SELECT id FROM x_accounts WHERE user_id = ?')
        .bind(context.user.id)
        .first<{ id: string }>()

      if (!account) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Connect your X account before scheduling posts',
        })
      }

      const id = crypto.randomUUID()

      await context.db
        .prepare(
          `INSERT INTO x_scheduled_posts
           (id, user_id, text, scheduled_for, status, attempt_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`
        )
        .bind(id, context.user.id, input.text, input.scheduledFor, now, now)
        .run()

      return {
        id,
        status: 'pending',
        text: input.text,
        scheduledFor: input.scheduledFor,
        createdAt: now,
        updatedAt: now,
      }
    }),
  xScheduledPostsList: authorized
    .meta({
      openapi: {
        method: 'GET',
        path: '/x/scheduled-posts',
        summary: 'List scheduled X posts for current user',
        tags: ['X'],
        security: [{ bearerAuth: [] }],
      },
    })
    .input(z.object({
      status: z.enum(['pending', 'queued', 'sending', 'sent', 'failed', 'cancelled']).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }).optional())
    .output(z.object({
      items: z.array(z.object({
        id: z.string(),
        text: z.string(),
        scheduledFor: z.number(),
        status: z.enum(['pending', 'queued', 'sending', 'sent', 'failed', 'cancelled']),
        attemptCount: z.number(),
        lastError: z.string().nullable(),
        xTweetId: z.string().nullable(),
        sentAt: z.number().nullable(),
        cancelledAt: z.number().nullable(),
        createdAt: z.number(),
        updatedAt: z.number(),
      })),
    }))
    .handler(async ({ context, input }) => {
      const limit = input?.limit ?? 50

      const rows = input?.status
        ? await context.db
          .prepare(
            `SELECT id, text, scheduled_for, status, attempt_count, last_error, x_tweet_id, sent_at, cancelled_at, created_at, updated_at
             FROM x_scheduled_posts
             WHERE user_id = ? AND status = ?
             ORDER BY scheduled_for DESC
             LIMIT ?`
          )
          .bind(context.user.id, input.status, limit)
          .all<{
            id: string
            text: string
            scheduled_for: number
            status: 'pending' | 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
            attempt_count: number
            last_error: string | null
            x_tweet_id: string | null
            sent_at: number | null
            cancelled_at: number | null
            created_at: number
            updated_at: number
          }>()
        : await context.db
          .prepare(
            `SELECT id, text, scheduled_for, status, attempt_count, last_error, x_tweet_id, sent_at, cancelled_at, created_at, updated_at
             FROM x_scheduled_posts
             WHERE user_id = ?
             ORDER BY scheduled_for DESC
             LIMIT ?`
          )
          .bind(context.user.id, limit)
          .all<{
            id: string
            text: string
            scheduled_for: number
            status: 'pending' | 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
            attempt_count: number
            last_error: string | null
            x_tweet_id: string | null
            sent_at: number | null
            cancelled_at: number | null
            created_at: number
            updated_at: number
          }>()

      return {
        items: (rows.results || []).map((row) => ({
          id: row.id,
          text: row.text,
          scheduledFor: row.scheduled_for,
          status: row.status,
          attemptCount: row.attempt_count,
          lastError: row.last_error,
          xTweetId: row.x_tweet_id,
          sentAt: row.sent_at,
          cancelledAt: row.cancelled_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      }
    }),
  xScheduledPostsCancel: authorized
    .meta({
      openapi: {
        method: 'POST',
        path: '/x/scheduled-posts/{id}/cancel',
        summary: 'Cancel one-time scheduled X post',
        tags: ['X'],
        security: [{ bearerAuth: [] }],
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ ok: z.boolean() }))
    .handler(async ({ context, input }) => {
      const now = Date.now()
      const result = await context.db
        .prepare(
          `UPDATE x_scheduled_posts
           SET status = 'cancelled', cancelled_at = ?, updated_at = ?
           WHERE id = ?
             AND user_id = ?
             AND status IN ('pending', 'queued')`
        )
        .bind(now, now, input.id, context.user.id)
        .run()

      if (!result.success || (result.meta.changes || 0) === 0) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Scheduled post cannot be cancelled in its current state',
        })
      }

      return { ok: true }
    }),

  // GoCardless routes
  gcInstitutions: authorized
    .meta({
      openapi: {
        method: 'GET',
        path: '/gocardless/institutions',
        summary: 'List banks by country',
        tags: ['GoCardless'],
        security: [{ bearerAuth: [] }],
      },
    })
    .input(z.object({
      country: z.string().min(2).max(2).default('GB'),
    }).optional())
    .output(z.any())
    .handler(async ({ input }) => {
      const country = input?.country ?? 'GB'
      const filtered = (allInstitutions as Array<{ id: string; name: string; bic: string | null; countries: string[]; transaction_total_days: string }>)
        .filter((inst) => inst.countries.includes(country))
        .sort((a, b) => a.name.localeCompare(b.name))
      return filtered
    }),

  gcAccounts: authorized
    .meta({
      openapi: {
        method: 'GET',
        path: '/gocardless/accounts',
        summary: 'Get linked accounts from stored requisition',
        tags: ['GoCardless'],
        security: [{ bearerAuth: [] }],
      },
    })
    .output(z.any())
    .handler(async ({ context }) => {
      const requisition = await context.db
        .prepare('SELECT id, institution_id, institution_name, account_ids, status FROM gocardless_requisitions WHERE user_id = ?')
        .bind(context.user.id)
        .first<{
          id: string
          institution_id: string
          institution_name: string | null
          account_ids: string | null
          status: string
        }>()

      if (!requisition) {
        return { connected: false, accounts: [] }
      }

      if (requisition.status === 'pending') {
        // Check if the requisition has been completed upstream
        const upstream = await gcFetchJson<{ id: string; status: string; accounts: string[] }>(
          context.env,
          `/requisitions/${requisition.id}/`,
        )

        if (upstream.ok && upstream.data.status === 'LN' && upstream.data.accounts?.length > 0) {
          const accountIds = JSON.stringify(upstream.data.accounts)
          const now = Date.now()
          await context.db
            .prepare('UPDATE gocardless_requisitions SET account_ids = ?, status = ?, updated_at = ? WHERE id = ?')
            .bind(accountIds, 'linked', now, requisition.id)
            .run()
          requisition.account_ids = accountIds
          requisition.status = 'linked'
        }
      }

      const accountIds: string[] = requisition.account_ids ? JSON.parse(requisition.account_ids) : []

      return {
        connected: requisition.status === 'linked',
        requisitionId: requisition.id,
        institutionId: requisition.institution_id,
        institutionName: requisition.institution_name,
        status: requisition.status,
        accountIds,
      }
    }),

  gcBalances: authorized
    .meta({
      openapi: {
        method: 'GET',
        path: '/gocardless/accounts/{accountId}/balances',
        summary: 'Fetch account balances (cached)',
        tags: ['GoCardless'],
        security: [{ bearerAuth: [] }],
      },
    })
    .input(z.object({ accountId: z.string() }))
    .output(z.any())
    .handler(async ({ context, input }) => {
      const result = await handleAccountScopeRequest(context.env, input.accountId, 'balances')
      if (result.status !== 200) {
        throw new ORPCError('BAD_REQUEST', {
          message: `Failed to fetch balances (${result.status})`,
        })
      }
      return result.data
    }),

  gcTransactions: authorized
    .meta({
      openapi: {
        method: 'GET',
        path: '/gocardless/accounts/{accountId}/transactions',
        summary: 'Fetch account transactions (cached)',
        tags: ['GoCardless'],
        security: [{ bearerAuth: [] }],
      },
    })
    .input(z.object({ accountId: z.string() }))
    .output(z.any())
    .handler(async ({ context, input }) => {
      const result = await handleAccountScopeRequest(context.env, input.accountId, 'transactions')
      if (result.status !== 200) {
        throw new ORPCError('BAD_REQUEST', {
          message: `Failed to fetch transactions (${result.status})`,
        })
      }
      return result.data
    }),

  gcDetails: authorized
    .meta({
      openapi: {
        method: 'GET',
        path: '/gocardless/accounts/{accountId}/details',
        summary: 'Fetch account details (cached)',
        tags: ['GoCardless'],
        security: [{ bearerAuth: [] }],
      },
    })
    .input(z.object({ accountId: z.string() }))
    .output(z.any())
    .handler(async ({ context, input }) => {
      const result = await handleAccountScopeRequest(context.env, input.accountId, 'details')
      if (result.status !== 200) {
        throw new ORPCError('BAD_REQUEST', {
          message: `Failed to fetch details (${result.status})`,
        })
      }
      return result.data
    }),

  gcDisconnect: authorized
    .meta({
      openapi: {
        method: 'POST',
        path: '/gocardless/disconnect',
        summary: 'Remove requisition and clear cache',
        tags: ['GoCardless'],
        security: [{ bearerAuth: [] }],
      },
    })
    .output(z.object({ ok: z.boolean() }))
    .handler(async ({ context }) => {
      const requisition = await context.db
        .prepare('SELECT account_ids FROM gocardless_requisitions WHERE user_id = ?')
        .bind(context.user.id)
        .first<{ account_ids: string | null }>()

      if (requisition?.account_ids) {
        const accountIds: string[] = JSON.parse(requisition.account_ids)
        await clearAccountCache(context.env, accountIds)
      }

      await context.db
        .prepare('DELETE FROM gocardless_requisitions WHERE user_id = ?')
        .bind(context.user.id)
        .run()

      return { ok: true }
    }),
})

export type AppRouter = typeof appRouter
