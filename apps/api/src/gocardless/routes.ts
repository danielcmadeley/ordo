import type { Hono } from 'hono'
import { createAuth } from '../auth'
import type { Bindings } from '../index'
import { gcFetch } from './client'
import { handleAccountScopeRequest, clearAccountCache } from './cache'
import allInstitutions from './institutions.json'

type SessionUser = {
  id: string
  email: string
  name?: string
}

async function getSessionUser(env: Bindings, headers: Headers, cf?: IncomingRequestCfProperties): Promise<SessionUser | null> {
  const auth = createAuth(env, cf)
  const session = await auth.api.getSession({ headers })
  if (!session?.user || !session?.session) return null
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }
}

function getDefaultReturnTo(reqUrl: string) {
  return reqUrl.includes('localhost') ? 'http://localhost:3000/finance' : 'https://app.getordo.co/finance'
}

function normalizeReturnTo(raw: string | null, reqUrl: string) {
  if (!raw) return getDefaultReturnTo(reqUrl)
  try {
    const parsed = new URL(raw)
    const allowed = new Set([
      'http://localhost:3000',
      'http://localhost:4173',
      'https://ordo-6zh.pages.dev',
      'https://app.getordo.co',
    ])
    if (!allowed.has(parsed.origin)) return getDefaultReturnTo(reqUrl)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return getDefaultReturnTo(reqUrl)
  }
}

type InstitutionRecord = {
  id: string
  name: string
  bic: string | null
  countries: string[]
  transaction_total_days: string
}

export function registerGocardlessRoutes(app: Hono<{ Bindings: Bindings }>) {
  // GET /api/gocardless/institutions — list banks by country (static data, no auth required)
  app.get('/api/gocardless/institutions', async (c) => {
    const country = c.req.query('country') ?? 'GB'
    const filtered = (allInstitutions as InstitutionRecord[])
      .filter((inst) => inst.countries.includes(country))
      .sort((a, b) => a.name.localeCompare(b.name))
    return c.json(filtered)
  })

  // GET /api/gocardless/connect — create agreement + requisition, redirect to bank auth
  app.get('/api/gocardless/connect', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const institutionId = c.req.query('institution_id')
    if (!institutionId) {
      return c.json({ error: 'institution_id is required' }, 400)
    }

    const institutionName = c.req.query('institution_name') ?? null
    const returnTo = normalizeReturnTo(c.req.query('returnTo') ?? null, c.req.url)

    // Build the callback URL on the *frontend* origin so it goes through the Vite proxy in dev
    // and stays on the same domain as auth cookies in production
    const returnToUrl = new URL(returnTo)
    const callbackUrl = new URL('/api/gocardless/callback', returnToUrl.origin)
    callbackUrl.searchParams.set('returnTo', returnTo)

    // Create an end-user agreement
    const agreementRes = await gcFetch(c.env, '/agreements/enduser/', {
      method: 'POST',
      body: JSON.stringify({
        institution_id: institutionId,
        max_historical_days: 730,
        access_valid_for_days: 90,
        access_scope: ['details', 'balances', 'transactions'],
      }),
    })
    const agreement = await agreementRes.json<{ id: string }>()

    if (!agreementRes.ok) {
      return c.json({ error: 'Failed to create GoCardless agreement', details: agreement }, 502)
    }

    // Create the requisition
    const reference = crypto.randomUUID()
    const reqRes = await gcFetch(c.env, '/requisitions/', {
      method: 'POST',
      body: JSON.stringify({
        redirect: callbackUrl.toString(),
        institution_id: institutionId,
        agreement: agreement.id,
        reference,
      }),
    })
    const requisition = await reqRes.json<{ id: string; link: string }>()

    if (!reqRes.ok || !requisition.link) {
      return c.json({ error: 'Failed to create GoCardless requisition', details: requisition }, 502)
    }

    // Save the requisition to D1
    const now = Date.now()
    await c.env.auth_db
      .prepare(
        `INSERT INTO gocardless_requisitions (id, user_id, institution_id, institution_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           id = excluded.id,
           institution_id = excluded.institution_id,
           institution_name = excluded.institution_name,
           account_ids = NULL,
           status = 'pending',
           updated_at = excluded.updated_at`
      )
      .bind(requisition.id, user.id, institutionId, institutionName, now, now)
      .run()

    // Redirect to the bank authorization page
    return c.redirect(requisition.link, 302)
  })

  // GET /api/gocardless/callback — handle bank return
  app.get('/api/gocardless/callback', async (c) => {
    const returnTo = normalizeReturnTo(c.req.query('returnTo') ?? null, c.req.url)

    const redirectToReturn = (status: string, reason?: string) => {
      const url = new URL(returnTo)
      url.searchParams.set('gc', status)
      if (reason) url.searchParams.set('gc_reason', reason)
      return url.toString()
    }

    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) {
      return c.redirect(redirectToReturn('error', 'auth_required'), 302)
    }

    // Look up the pending requisition for this user
    const requisition = await c.env.auth_db
      .prepare('SELECT id, institution_id FROM gocardless_requisitions WHERE user_id = ? AND status = ?')
      .bind(user.id, 'pending')
      .first<{ id: string; institution_id: string }>()

    if (!requisition) {
      return c.redirect(redirectToReturn('error', 'no_pending_requisition'), 302)
    }

    // Check the requisition status upstream
    const upstream = await gcFetch(c.env, `/requisitions/${requisition.id}/`)
    const reqData = await upstream.json<{ id: string; status: string; accounts: string[] }>()

    if (!upstream.ok) {
      return c.redirect(redirectToReturn('error', 'requisition_check_failed'), 302)
    }

    if (reqData.status === 'LN' && reqData.accounts?.length > 0) {
      // Successfully linked
      const accountIds = JSON.stringify(reqData.accounts)
      const now = Date.now()
      await c.env.auth_db
        .prepare('UPDATE gocardless_requisitions SET account_ids = ?, status = ?, updated_at = ? WHERE id = ?')
        .bind(accountIds, 'linked', now, requisition.id)
        .run()

      return c.redirect(redirectToReturn('connected'), 302)
    }

    if (reqData.status === 'CR') {
      // Still pending — user might not have completed bank auth
      return c.redirect(redirectToReturn('pending', 'bank_auth_not_completed'), 302)
    }

    // Other status (expired, rejected, etc.)
    const now = Date.now()
    await c.env.auth_db
      .prepare('UPDATE gocardless_requisitions SET status = ?, updated_at = ? WHERE id = ?')
      .bind('expired', now, requisition.id)
      .run()

    return c.redirect(redirectToReturn('error', `requisition_status_${reqData.status}`), 302)
  })

  // GET /api/gocardless/accounts — get linked accounts for current user
  app.get('/api/gocardless/accounts', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const requisition = await c.env.auth_db
      .prepare('SELECT id, institution_id, institution_name, account_ids, status FROM gocardless_requisitions WHERE user_id = ?')
      .bind(user.id)
      .first<{
        id: string
        institution_id: string
        institution_name: string | null
        account_ids: string | null
        status: string
      }>()

    if (!requisition) {
      return c.json({ connected: false, accounts: [] })
    }

    // If still pending, check upstream to see if it completed
    if (requisition.status === 'pending') {
      const upstream = await gcFetch(c.env, `/requisitions/${requisition.id}/`)
      const data = await upstream.json<{ id: string; status: string; accounts: string[] }>()

      if (upstream.ok && data.status === 'LN' && data.accounts?.length > 0) {
        const accountIds = JSON.stringify(data.accounts)
        const now = Date.now()
        await c.env.auth_db
          .prepare('UPDATE gocardless_requisitions SET account_ids = ?, status = ?, updated_at = ? WHERE id = ?')
          .bind(accountIds, 'linked', now, requisition.id)
          .run()
        requisition.account_ids = accountIds
        requisition.status = 'linked'
      }
    }

    const accountIds: string[] = requisition.account_ids ? JSON.parse(requisition.account_ids) : []

    return c.json({
      connected: requisition.status === 'linked',
      requisitionId: requisition.id,
      institutionId: requisition.institution_id,
      institutionName: requisition.institution_name,
      status: requisition.status,
      accountIds,
    })
  })

  // GET /api/gocardless/accounts/:accountId/balances
  app.get('/api/gocardless/accounts/:accountId/balances', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const accountId = c.req.param('accountId')
    const result = await handleAccountScopeRequest(c.env, accountId, 'balances')
    return c.json(result.data, result.status as 200)
  })

  // GET /api/gocardless/accounts/:accountId/transactions
  app.get('/api/gocardless/accounts/:accountId/transactions', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const accountId = c.req.param('accountId')
    const result = await handleAccountScopeRequest(c.env, accountId, 'transactions')
    return c.json(result.data, result.status as 200)
  })

  // GET /api/gocardless/accounts/:accountId/details
  app.get('/api/gocardless/accounts/:accountId/details', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const accountId = c.req.param('accountId')
    const result = await handleAccountScopeRequest(c.env, accountId, 'details')
    return c.json(result.data, result.status as 200)
  })

  // POST /api/gocardless/disconnect — remove requisition + clear cache
  app.post('/api/gocardless/disconnect', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const requisition = await c.env.auth_db
      .prepare('SELECT account_ids FROM gocardless_requisitions WHERE user_id = ?')
      .bind(user.id)
      .first<{ account_ids: string | null }>()

    if (requisition?.account_ids) {
      const accountIds: string[] = JSON.parse(requisition.account_ids)
      await clearAccountCache(c.env, accountIds)
    }

    await c.env.auth_db
      .prepare('DELETE FROM gocardless_requisitions WHERE user_id = ?')
      .bind(user.id)
      .run()

    return c.json({ ok: true })
  })
}
