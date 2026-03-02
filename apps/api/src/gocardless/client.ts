import type { Bindings } from '../index'

type TokenResponse = {
  access: string
  access_expires?: number
}

export type RateLimitHeaders = {
  limit: number | null
  remaining: number | null
  resetSeconds: number | null
  accountSuccessLimit: number | null
  accountSuccessRemaining: number | null
  accountSuccessResetSeconds: number | null
}

export type GoCardlessResponse<T = unknown> = {
  ok: boolean
  status: number
  data: T
  rateLimit: RateLimitHeaders
}

const TOKEN_KV_KEY = 'gocardless:token'

function parseHeaderNumber(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function readRateLimitHeaders(response: Response): RateLimitHeaders {
  const h = (key: string) => response.headers.get(key)
  return {
    limit: parseHeaderNumber(h('X-RATELIMIT-LIMIT') ?? h('HTTP_X_RATELIMIT_LIMIT')),
    remaining: parseHeaderNumber(h('X-RATELIMIT-REMAINING') ?? h('HTTP_X_RATELIMIT_REMAINING')),
    resetSeconds: parseHeaderNumber(h('X-RATELIMIT-RESET') ?? h('HTTP_X_RATELIMIT_RESET')),
    accountSuccessLimit: parseHeaderNumber(h('X-RATELIMIT-ACCOUNT-SUCCESS-LIMIT') ?? h('HTTP_X_RATELIMIT_ACCOUNT_SUCCESS_LIMIT')),
    accountSuccessRemaining: parseHeaderNumber(h('X-RATELIMIT-ACCOUNT-SUCCESS-REMAINING') ?? h('HTTP_X_RATELIMIT_ACCOUNT_SUCCESS_REMAINING')),
    accountSuccessResetSeconds: parseHeaderNumber(h('X-RATELIMIT-ACCOUNT-SUCCESS-RESET') ?? h('HTTP_X_RATELIMIT_ACCOUNT_SUCCESS_RESET')),
  }
}

async function getToken(env: Bindings): Promise<string> {
  // Check KV cache first
  if (env.GOCARDLESS_CACHE) {
    const cached = await env.GOCARDLESS_CACHE.get(TOKEN_KV_KEY)
    if (cached) return cached
  }

  const response = await fetch(`${env.GOCARDLESS_BASE_URL}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret_id: env.GOCARDLESS_SECRET_ID,
      secret_key: env.GOCARDLESS_SECRET_KEY,
    }),
  })

  if (!response.ok) {
    const errorPayload = await response.text()
    throw new Error(`Failed to get GoCardless token (${response.status}): ${errorPayload}`)
  }

  const tokenData = (await response.json()) as TokenResponse
  const expiresInSeconds = tokenData.access_expires ?? 24 * 60 * 60
  // Store in KV with TTL, subtract 60s buffer
  const ttl = Math.max(expiresInSeconds - 60, 60)

  if (env.GOCARDLESS_CACHE) {
    await env.GOCARDLESS_CACHE.put(TOKEN_KV_KEY, tokenData.access, { expirationTtl: ttl })
  }

  return tokenData.access
}

export async function gcFetch(env: Bindings, path: string, options?: RequestInit) {
  const token = await getToken(env)
  return fetch(`${env.GOCARDLESS_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
}

export async function gcFetchJson<T = unknown>(
  env: Bindings,
  path: string,
  options?: RequestInit,
): Promise<GoCardlessResponse<T>> {
  const response = await gcFetch(env, path, options)
  const data = (await response.json()) as T

  return {
    ok: response.ok,
    status: response.status,
    data,
    rateLimit: readRateLimitHeaders(response),
  }
}
