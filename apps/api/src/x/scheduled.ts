type XEnv = {
  auth_db: D1Database
  X_CLIENT_ID: string
  X_CLIENT_SECRET?: string
  X_JOBS_QUEUE: Queue
}

type SendScheduledPostMessage = {
  type: 'send_scheduled_post'
  scheduledPostId: string
  userId: string
  traceId: string
}

type XAccountRow = {
  user_id: string
  access_token: string
  refresh_token: string | null
  scope: string | null
  expires_at: number | null
}

type ScheduledPostRow = {
  id: string
  user_id: string
  text: string
  scheduled_for: number
  status: 'pending' | 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
}

const X_API_HOSTS = ['https://api.x.com', 'https://api.twitter.com'] as const
const X_RETRY_DELAYS_MS = [150, 400, 900] as const
const X_TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504])

class TransientQueueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransientQueueError'
  }
}

function base64UrlEncode(input: Uint8Array) {
  const binary = Array.from(input, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
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

async function fetchXPathWithFallback(path: string, init?: RequestInit) {
  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (const host of X_API_HOSTS) {
    const url = `${host}${path}`
    for (let attempt = 0; attempt < X_RETRY_DELAYS_MS.length + 1; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...init,
          headers: {
            'User-Agent': 'ordo-x-scheduler/1.0',
            Accept: 'application/json',
            ...(init?.headers ?? {}),
          },
        })
        lastResponse = response

        if (response.ok || !X_TRANSIENT_STATUSES.has(response.status)) {
          return response
        }

        if (attempt < X_RETRY_DELAYS_MS.length) {
          await delay(X_RETRY_DELAYS_MS[attempt])
          continue
        }

        break
      } catch (error) {
        lastError = error
        if (attempt < X_RETRY_DELAYS_MS.length) {
          await delay(X_RETRY_DELAYS_MS[attempt])
          continue
        }
      }
    }
  }

  if (lastResponse) {
    return lastResponse
  }

  throw (lastError instanceof Error ? lastError : new Error('X API request failed'))
}

async function getXAccount(db: D1Database, userId: string) {
  return db
    .prepare('SELECT user_id, access_token, refresh_token, scope, expires_at FROM x_accounts WHERE user_id = ?')
    .bind(userId)
    .first<XAccountRow>()
}

async function refreshAccessToken(env: XEnv, account: XAccountRow) {
  if (!account.refresh_token) return null

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
    client_id: env.X_CLIENT_ID,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (env.X_CLIENT_SECRET) {
    headers.Authorization = `Basic ${btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`)}`
  }

  const response = await fetchXPathWithFallback('/2/oauth2/token', {
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
  const next: XAccountRow = {
    ...account,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? account.refresh_token,
    scope: tokenData.scope ?? account.scope,
    expires_at: expiresAt,
  }

  await env.auth_db
    .prepare('UPDATE x_accounts SET access_token = ?, refresh_token = ?, scope = ?, expires_at = ?, updated_at = ? WHERE user_id = ?')
    .bind(next.access_token, next.refresh_token, next.scope, next.expires_at, Date.now(), next.user_id)
    .run()

  return next
}

async function createXPost(env: XEnv, account: XAccountRow, text: string) {
  let active = account
  const stale = active.expires_at !== null && active.expires_at < Date.now() + 60_000
  if (stale && active.refresh_token) {
    active = (await refreshAccessToken(env, active)) ?? active
  }

  const doRequest = () => fetchXPathWithFallback('/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${active.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  let response = await doRequest()
  if (response.status === 401 && active.refresh_token) {
    const refreshed = await refreshAccessToken(env, active)
    if (refreshed) {
      active = refreshed
      response = await doRequest()
    }
  }

  if (response.ok) {
    const json = await response.json<{ data?: { id?: string } }>()
    return { ok: true as const, tweetId: json.data?.id ?? null }
  }

  const error = await parseErrorMessage(response)
  if (X_TRANSIENT_STATUSES.has(response.status)) {
    return { ok: false as const, transient: true, status: response.status, error }
  }
  return { ok: false as const, transient: false, status: response.status, error }
}

async function markFailed(db: D1Database, scheduledPostId: string, reason: string) {
  await db
    .prepare("UPDATE x_scheduled_posts SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?")
    .bind(reason, Date.now(), scheduledPostId)
    .run()
}

export async function enqueueDueScheduledPosts(env: XEnv) {
  const now = Date.now()
  const due = await env.auth_db
    .prepare(
      `SELECT id, user_id, text, scheduled_for, status
       FROM x_scheduled_posts
       WHERE status = 'pending' AND scheduled_for <= ?
       ORDER BY scheduled_for ASC
       LIMIT 100`
    )
    .bind(now)
    .all<ScheduledPostRow>()

  for (const row of due.results || []) {
    const lock = await env.auth_db
      .prepare(
        `UPDATE x_scheduled_posts
         SET status = 'queued', updated_at = ?
         WHERE id = ? AND status = 'pending'`
      )
      .bind(now, row.id)
      .run()

    if (!lock.success || (lock.meta.changes || 0) === 0) {
      continue
    }

    const message: SendScheduledPostMessage = {
      type: 'send_scheduled_post',
      scheduledPostId: row.id,
      userId: row.user_id,
      traceId: base64UrlEncode(crypto.getRandomValues(new Uint8Array(12))),
    }

    try {
      await env.X_JOBS_QUEUE.send(message)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to enqueue scheduled post'
      await env.auth_db
        .prepare("UPDATE x_scheduled_posts SET status = 'pending', last_error = ?, updated_at = ? WHERE id = ?")
        .bind(reason, Date.now(), row.id)
        .run()
    }
  }
}

async function processScheduledPost(env: XEnv, body: SendScheduledPostMessage) {
  const row = await env.auth_db
    .prepare('SELECT id, user_id, text, scheduled_for, status FROM x_scheduled_posts WHERE id = ?')
    .bind(body.scheduledPostId)
    .first<ScheduledPostRow>()

  if (!row) return
  if (row.status === 'sent' || row.status === 'cancelled' || row.status === 'failed') return

  const locked = await env.auth_db
    .prepare(
      `UPDATE x_scheduled_posts
       SET status = 'sending', attempt_count = attempt_count + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND status IN ('queued', 'sending')`
    )
    .bind(Date.now(), body.scheduledPostId, body.userId)
    .run()

  if (!locked.success || (locked.meta.changes || 0) === 0) return

  const account = await getXAccount(env.auth_db, body.userId)
  if (!account) {
    await markFailed(env.auth_db, body.scheduledPostId, 'X account is not connected')
    return
  }

  const result = await createXPost(env, account, row.text)
  if (result.ok) {
    await env.auth_db
      .prepare(
        `UPDATE x_scheduled_posts
         SET status = 'sent', x_tweet_id = ?, sent_at = ?, last_error = NULL, updated_at = ?
         WHERE id = ?`
      )
      .bind(result.tweetId, Date.now(), Date.now(), body.scheduledPostId)
      .run()
    return
  }

  if (result.transient) {
    await env.auth_db
      .prepare("UPDATE x_scheduled_posts SET status = 'queued', last_error = ?, updated_at = ? WHERE id = ?")
      .bind(`Transient X error (${result.status}): ${result.error}`, Date.now(), body.scheduledPostId)
      .run()
    throw new TransientQueueError(result.error)
  }

  await markFailed(env.auth_db, body.scheduledPostId, `X error (${result.status}): ${result.error}`)
}

export async function handleScheduledPostQueue(batch: MessageBatch<unknown>, env: XEnv) {
  for (const message of batch.messages) {
    try {
      const body = message.body as Partial<SendScheduledPostMessage>
      if (body.type !== 'send_scheduled_post' || !body.scheduledPostId || !body.userId || !body.traceId) {
        message.ack()
        continue
      }

      await processScheduledPost(env, body as SendScheduledPostMessage)
      message.ack()
    } catch (error) {
      if (error instanceof TransientQueueError) {
        message.retry()
      } else {
        message.ack()
      }
    }
  }
}
