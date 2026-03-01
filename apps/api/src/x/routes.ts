import type { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createAuth } from '../auth'
import type { Bindings } from '../index'
import { enqueueDueScheduledPosts } from './scheduled'

const OAUTH_COOKIE = 'x_oauth_ctx'
const DEFAULT_SCOPES = 'tweet.read tweet.write users.read bookmark.read offline.access'
const X_API_HOSTS = ['https://api.x.com', 'https://api.twitter.com'] as const
const X_RETRY_STATUSES = new Set([429, 500, 502, 503, 504])
const X_RETRY_DELAYS_MS = [150, 400, 900] as const

type OAuthContext = {
  state: string
  codeVerifier: string
  userId: string
  returnTo: string
}

type SessionUser = {
  id: string
  email: string
  name?: string
}

type XAccountRow = {
  id: string
  user_id: string
  x_user_id: string
  username: string
  access_token: string
  refresh_token: string | null
  scope: string | null
  expires_at: number | null
}

function base64UrlEncode(input: Uint8Array) {
  const binary = Array.from(input, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomUrlSafe(size = 32) {
  const buffer = crypto.getRandomValues(new Uint8Array(size))
  return base64UrlEncode(buffer)
}

async function pkceChallenge(verifier: string) {
  const encoded = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return base64UrlEncode(new Uint8Array(hash))
}

function getScopes(env: Bindings) {
  return env.X_SCOPES || DEFAULT_SCOPES
}

function getDefaultReturnTo(reqUrl: string) {
  return reqUrl.includes('localhost') ? 'http://localhost:3000/crm' : 'https://app.getordo.co/crm'
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

function readOAuthContext(rawCookie: string | undefined): OAuthContext | null {
  if (!rawCookie) return null
  try {
    return JSON.parse(rawCookie) as OAuthContext
  } catch {
    return null
  }
}

function shortReason(message: string | undefined, max = 280) {
  if (!message) return undefined
  const trimmed = message.replace(/\s+/g, ' ').trim()
  if (!trimmed) return undefined
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed
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

async function getXAccount(db: D1Database, userId: string) {
  return db
    .prepare('SELECT id, user_id, x_user_id, username, access_token, refresh_token, scope, expires_at FROM x_accounts WHERE user_id = ?')
    .bind(userId)
    .first<XAccountRow>()
}

async function upsertXAccount(
  db: D1Database,
  row: {
    userId: string
    xUserId: string
    username: string
    accessToken: string
    refreshToken: string | null
    scope: string | null
    expiresAt: number | null
  }
) {
  const now = Date.now()
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO x_accounts (id, user_id, x_user_id, username, access_token, refresh_token, scope, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         x_user_id = excluded.x_user_id,
         username = excluded.username,
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         scope = excluded.scope,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`
    )
    .bind(id, row.userId, row.xUserId, row.username, row.accessToken, row.refreshToken, row.scope, row.expiresAt, now, now)
    .run()
}

async function refreshAccessToken(c: { env: Bindings }, account: XAccountRow) {
  if (!account.refresh_token) return null

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
    client_id: c.env.X_CLIENT_ID,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (c.env.X_CLIENT_SECRET) {
    headers.Authorization = `Basic ${btoa(`${c.env.X_CLIENT_ID}:${c.env.X_CLIENT_SECRET}`)}`
  }

  const response = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers,
    body: form,
  })

  if (!response.ok) {
    return null
  }

  const tokenData = await response.json<{
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }>()

  const expiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null

  const nextAccount: XAccountRow = {
    ...account,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? account.refresh_token,
    scope: tokenData.scope ?? account.scope,
    expires_at: expiresAt,
  }

  await upsertXAccount(c.env.auth_db, {
    userId: account.user_id,
    xUserId: account.x_user_id,
    username: account.username,
    accessToken: nextAccount.access_token,
    refreshToken: nextAccount.refresh_token,
    scope: nextAccount.scope,
    expiresAt: nextAccount.expires_at,
  })

  return nextAccount
}

async function fetchXApi(c: { env: Bindings }, account: XAccountRow, input: string, init?: RequestInit) {
  let active = account
  const stale = active.expires_at !== null && active.expires_at < Date.now() + 60_000
  if (stale && active.refresh_token) {
    active = (await refreshAccessToken(c, active)) ?? active
  }

  const request = () => fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${active.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  let response = await request()
  if (response.status === 401 && active.refresh_token) {
    const refreshed = await refreshAccessToken(c, active)
    if (refreshed) {
      active = refreshed
      response = await request()
    }
  }

  return response
}

async function parseErrorMessage(response: Response) {
  try {
    const json = await response.json<{ error?: string; title?: string; detail?: string; errors?: Array<{ message?: string }> }>()
    return json.error || json.detail || json.title || json.errors?.[0]?.message || `X request failed (${response.status})`
  } catch {
    const text = await response.text()
    return text || `X request failed (${response.status})`
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchXPathWithFallback(path: string, init?: RequestInit) {
  let lastResponse: Response | null = null
  let lastError: unknown = null
  const trace: string[] = []

  for (const host of X_API_HOSTS) {
    const url = `${host}${path}`
    for (let attempt = 0; attempt < X_RETRY_DELAYS_MS.length + 1; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...init,
          headers: {
            'User-Agent': 'ordo-x-integration/1.0',
            Accept: 'application/json',
            ...(init?.headers ?? {}),
          },
        })
        lastResponse = response
        trace.push(`${host}${path}#${attempt + 1}:${response.status}`)

        if (response.ok || !X_RETRY_STATUSES.has(response.status)) {
          return { response, trace: trace.join(' | ') }
        }

        if (attempt < X_RETRY_DELAYS_MS.length) {
          await delay(X_RETRY_DELAYS_MS[attempt])
          continue
        }

        // We've exhausted retries for this host. Try the next host.
        break
      } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : 'fetch_error'
        trace.push(`${host}${path}#${attempt + 1}:error(${message})`)
        if (attempt < X_RETRY_DELAYS_MS.length) {
          await delay(X_RETRY_DELAYS_MS[attempt])
          continue
        }
      }
    }
  }

  if (lastResponse) {
    return { response: lastResponse, trace: trace.join(' | ') }
  }

  const message = lastError instanceof Error ? lastError.message : 'X API request failed'
  throw new Error(`X API request failed: ${message}. trace=${trace.join(' | ')}`)
}

export function registerXRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/api/x/connect', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    if (!c.env.X_CLIENT_ID || !c.env.X_REDIRECT_URI) {
      return c.json({ error: 'Missing X OAuth configuration' }, 500)
    }

    const returnTo = normalizeReturnTo(c.req.query('returnTo') ?? null, c.req.url)
    const state = randomUrlSafe(24)
    const codeVerifier = randomUrlSafe(64)
    const codeChallenge = await pkceChallenge(codeVerifier)
    const scope = getScopes(c.env)

    const authUrl = new URL('https://x.com/i/oauth2/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', c.env.X_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', c.env.X_REDIRECT_URI)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    const secure = new URL(c.req.url).protocol === 'https:'
    setCookie(c, OAUTH_COOKIE, JSON.stringify({ state, codeVerifier, userId: user.id, returnTo } satisfies OAuthContext), {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/api/x',
      maxAge: 60 * 10,
    })

    return c.redirect(authUrl.toString(), 302)
  })

  app.get('/api/x/callback', async (c) => {
    const oauth = readOAuthContext(getCookie(c, OAUTH_COOKIE))
    const fallbackReturnTo = oauth?.returnTo ?? getDefaultReturnTo(c.req.url)
    const redirectToReturnTo = (status: string, reason?: string, httpStatus?: number) => {
      const url = new URL(fallbackReturnTo)
      url.searchParams.set('x', status)
      if (reason) url.searchParams.set('x_reason', reason)
      if (typeof httpStatus === 'number') url.searchParams.set('x_http_status', String(httpStatus))
      return url.toString()
    }

    const incomingState = c.req.query('state')
    const code = c.req.query('code')
    const oauthError = c.req.query('error')
    const oauthErrorDescription = c.req.query('error_description')
    if (oauthError) {
      deleteCookie(c, OAUTH_COOKIE, { path: '/api/x' })
      return c.redirect(redirectToReturnTo('oauth_error', shortReason(oauthErrorDescription || oauthError)), 302)
    }

    if (!oauth || !incomingState || !code || incomingState !== oauth.state) {
      deleteCookie(c, OAUTH_COOKIE, { path: '/api/x' })
      return c.redirect(redirectToReturnTo('invalid_state'), 302)
    }

    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user || user.id !== oauth.userId) {
      deleteCookie(c, OAUTH_COOKIE, { path: '/api/x' })
      return c.redirect(redirectToReturnTo('auth_required'), 302)
    }

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: c.env.X_REDIRECT_URI,
      code_verifier: oauth.codeVerifier,
      client_id: c.env.X_CLIENT_ID,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    if (c.env.X_CLIENT_SECRET) {
      headers.Authorization = `Basic ${btoa(`${c.env.X_CLIENT_ID}:${c.env.X_CLIENT_SECRET}`)}`
    }

    const tokenAttempt = await fetchXPathWithFallback('/2/oauth2/token', {
      method: 'POST',
      headers,
      body: form,
    })
    const tokenResponse = tokenAttempt.response

    if (!tokenResponse.ok) {
      const tokenError = shortReason(`${await parseErrorMessage(tokenResponse)} [${tokenAttempt.trace}]`)
      deleteCookie(c, OAUTH_COOKIE, { path: '/api/x' })
      return c.redirect(redirectToReturnTo('token_error', tokenError, tokenResponse.status), 302)
    }

    const tokenData = await tokenResponse.json<{
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }>()

    let xUserId = 'me'
    let username = 'connected'
    let profilePendingReason: string | undefined
    let profilePendingStatus: number | undefined

    try {
      const meAttempt = await fetchXPathWithFallback('/2/users/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      })
      const meResponse = meAttempt.response

      if (!meResponse.ok) {
        const grantedScope = tokenData.scope ? ` granted_scope=${tokenData.scope}` : ''
        const reason = shortReason(`${await parseErrorMessage(meResponse)}${grantedScope} [${meAttempt.trace}]`)
        const isTransient = X_RETRY_STATUSES.has(meResponse.status)

        if (!isTransient) {
          deleteCookie(c, OAUTH_COOKIE, { path: '/api/x' })
          return c.redirect(redirectToReturnTo('profile_error', reason, meResponse.status), 302)
        }

        profilePendingReason = reason
        profilePendingStatus = meResponse.status
      } else {
        const me = await meResponse.json<{ data?: { id: string; username: string } }>()
        if (!me.data?.id || !me.data?.username) {
          profilePendingReason = 'Missing X user profile data in response'
        } else {
          xUserId = me.data.id
          username = me.data.username
        }
      }
    } catch (error) {
      profilePendingReason = shortReason(error instanceof Error ? error.message : 'Profile request failed')
    }

    const expiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null

    await upsertXAccount(c.env.auth_db, {
      userId: user.id,
      xUserId,
      username,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      scope: tokenData.scope ?? null,
      expiresAt,
    })

    deleteCookie(c, OAUTH_COOKIE, { path: '/api/x' })
    if (profilePendingReason) {
      return c.redirect(redirectToReturnTo('connected_profile_pending', profilePendingReason, profilePendingStatus), 302)
    }
    return c.redirect(redirectToReturnTo('connected'), 302)
  })

  app.get('/api/x/status', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const account = await getXAccount(c.env.auth_db, user.id)
    if (!account) {
      return c.json({ connected: false })
    }

    return c.json({
      connected: true,
      username: account.username,
      xUserId: account.x_user_id,
      profilePending: account.x_user_id === 'me' || account.username === 'connected',
    })
  })

  app.post('/api/x/disconnect', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    await c.env.auth_db.prepare('DELETE FROM x_accounts WHERE user_id = ?').bind(user.id).run()
    return c.json({ ok: true })
  })

  app.post('/api/x/post', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const account = await getXAccount(c.env.auth_db, user.id)
    if (!account) return c.json({ error: 'Connect your X account first' }, 400)

    const body = await c.req.json<{ text?: string }>().catch(() => ({ text: '' }))
    const text = (body.text || '').trim()
    if (!text) return c.json({ error: 'Post text is required' }, 400)
    if (text.length > 280) return c.json({ error: 'Post text must be 280 characters or fewer' }, 400)

    const response = await fetchXApi(c, account, 'https://api.x.com/2/tweets', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const error = await parseErrorMessage(response)
      c.status(response.status as 400 | 401 | 403 | 404 | 429 | 500)
      return c.json({ error })
    }

    const data = await response.json()
    return c.json({ ok: true, data })
  })

  app.get('/api/x/bookmarks', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const account = await getXAccount(c.env.auth_db, user.id)
    if (!account) return c.json({ error: 'Connect your X account first' }, 400)
    if (account.x_user_id === 'me') {
      return c.json({ error: 'X profile is still syncing. Please retry in a moment.' }, 409)
    }

    const paginationToken = c.req.query('pagination_token')
    const rawMax = Number(c.req.query('max_results') || '10')
    const maxResults = Number.isFinite(rawMax) ? Math.max(5, Math.min(100, rawMax)) : 10

    const url = new URL(`https://api.x.com/2/users/${account.x_user_id}/bookmarks`)
    url.searchParams.set('max_results', String(maxResults))
    if (paginationToken) url.searchParams.set('pagination_token', paginationToken)
    url.searchParams.set('tweet.fields', 'created_at,author_id,text,attachments')
    url.searchParams.set('expansions', 'author_id,attachments.media_keys')
    url.searchParams.set('media.fields', 'media_key,type,url,preview_image_url,alt_text,width,height')
    url.searchParams.set('user.fields', 'id,name,username,profile_image_url')

    const response = await fetchXApi(c, account, url.toString(), { method: 'GET' })
    if (!response.ok) {
      const error = await parseErrorMessage(response)
      c.status(response.status as 400 | 401 | 403 | 404 | 429 | 500)
      return c.json({ error })
    }

    const data = await response.json()
    return c.json(data)
  })

  app.get('/api/x/scheduled-posts', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const status = c.req.query('status')
    const validStatuses = new Set(['pending', 'queued', 'sending', 'sent', 'failed', 'cancelled'])
    const rawLimit = Number(c.req.query('limit') || '50')
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50

    if (status && !validStatuses.has(status)) {
      return c.json({ error: 'Invalid status filter' }, 400)
    }

    const rows = status
      ? await c.env.auth_db
        .prepare(
          `SELECT id, text, scheduled_for, status, attempt_count, last_error, x_tweet_id, sent_at, cancelled_at, created_at, updated_at
           FROM x_scheduled_posts
           WHERE user_id = ? AND status = ?
           ORDER BY scheduled_for DESC
           LIMIT ?`
        )
        .bind(user.id, status, limit)
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
      : await c.env.auth_db
        .prepare(
          `SELECT id, text, scheduled_for, status, attempt_count, last_error, x_tweet_id, sent_at, cancelled_at, created_at, updated_at
           FROM x_scheduled_posts
           WHERE user_id = ?
           ORDER BY scheduled_for DESC
           LIMIT ?`
        )
        .bind(user.id, limit)
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

    return c.json({
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
    })
  })

  app.post('/api/x/scheduled-posts', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const account = await getXAccount(c.env.auth_db, user.id)
    if (!account) return c.json({ error: 'Connect your X account before scheduling posts' }, 400)

    const body = await c.req.json<{ text?: string; scheduledFor?: number }>().catch(() => ({ text: '', scheduledFor: NaN }))
    const text = (body.text || '').trim()
    if (!text) return c.json({ error: 'Post text is required' }, 400)
    if (text.length > 280) return c.json({ error: 'Post text must be 280 characters or fewer' }, 400)

    const scheduledFor = typeof body.scheduledFor === 'number' ? body.scheduledFor : NaN
    if (!Number.isFinite(scheduledFor)) return c.json({ error: 'scheduledFor is required' }, 400)

    const now = Date.now()
    if (scheduledFor < now + 60_000) {
      return c.json({ error: 'scheduledFor must be at least 60 seconds in the future' }, 400)
    }

    const id = crypto.randomUUID()
    await c.env.auth_db
      .prepare(
        `INSERT INTO x_scheduled_posts
         (id, user_id, text, scheduled_for, status, attempt_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`
      )
      .bind(id, user.id, text, scheduledFor, now, now)
      .run()

    return c.json({
      id,
      status: 'pending',
      text,
      scheduledFor,
      createdAt: now,
      updatedAt: now,
    })
  })

  app.post('/api/x/scheduled-posts/:id/cancel', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const id = c.req.param('id')
    const now = Date.now()
    const result = await c.env.auth_db
      .prepare(
        `UPDATE x_scheduled_posts
         SET status = 'cancelled', cancelled_at = ?, updated_at = ?
         WHERE id = ?
           AND user_id = ?
           AND status IN ('pending', 'queued')`
      )
      .bind(now, now, id, user.id)
      .run()

    if (!result.success || (result.meta.changes || 0) === 0) {
      return c.json({ error: 'Scheduled post cannot be cancelled in its current state' }, 400)
    }

    return c.json({ ok: true })
  })

  app.post('/api/x/scheduled-posts/dispatch-due', async (c) => {
    const hostname = new URL(c.req.url).hostname
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    if (!isLocal) return c.text('Not Found', 404)

    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    await enqueueDueScheduledPosts(c.env)
    return c.json({ ok: true })
  })
}
