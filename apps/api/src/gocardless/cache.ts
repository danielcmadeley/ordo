import type { Bindings } from '../index'
import { gcFetchJson, type RateLimitHeaders } from './client'

type AccountScope = 'details' | 'balances' | 'transactions'

type ScopeResponseMeta = {
  scope: AccountScope
  accountId: string
  fromCache: boolean
  stale: boolean
  cachedAt: string | null
  cacheTtlSeconds: number
  rateLimit: RateLimitHeaders
}

type CacheRecord = {
  data: unknown
  cachedAtMs: number
  expiresAtMs: number
  rateLimit: RateLimitHeaders
}

const scopeTtlSeconds: Record<AccountScope, number> = {
  details: 24 * 60 * 60,
  balances: 15 * 60,
  transactions: 30 * 60,
}

function makeCacheKey(accountId: string, scope: AccountScope): string {
  return `gc:account:${accountId}:${scope}`
}

function withMeta(payload: unknown, meta: ScopeResponseMeta) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      _meta: meta,
    }
  }
  return { data: payload, _meta: meta }
}

function buildMeta(params: {
  scope: AccountScope
  accountId: string
  fromCache: boolean
  stale: boolean
  cachedAtMs: number | null
  rateLimit: RateLimitHeaders
}): ScopeResponseMeta {
  return {
    scope: params.scope,
    accountId: params.accountId,
    fromCache: params.fromCache,
    stale: params.stale,
    cachedAt: params.cachedAtMs ? new Date(params.cachedAtMs).toISOString() : null,
    cacheTtlSeconds: scopeTtlSeconds[params.scope],
    rateLimit: params.rateLimit,
  }
}

async function readCache(env: Bindings, key: string): Promise<CacheRecord | null> {
  if (!env.GOCARDLESS_CACHE) return null
  const raw = await env.GOCARDLESS_CACHE.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CacheRecord
  } catch {
    return null
  }
}

async function writeCache(env: Bindings, key: string, record: CacheRecord): Promise<void> {
  if (!env.GOCARDLESS_CACHE) return
  const ttl = Math.max(Math.ceil((record.expiresAtMs - Date.now()) / 1000), 60)
  // Store with longer TTL than expiry so we can serve stale on 429
  await env.GOCARDLESS_CACHE.put(key, JSON.stringify(record), {
    expirationTtl: ttl + 300,
  })
}

export async function handleAccountScopeRequest(
  env: Bindings,
  accountId: string,
  scope: AccountScope,
) {
  const cacheKey = makeCacheKey(accountId, scope)
  const now = Date.now()
  const cached = await readCache(env, cacheKey)

  if (cached && cached.expiresAtMs > now) {
    const meta = buildMeta({
      scope,
      accountId,
      fromCache: true,
      stale: false,
      cachedAtMs: cached.cachedAtMs,
      rateLimit: cached.rateLimit,
    })
    return { data: withMeta(cached.data, meta), status: 200 }
  }

  const upstream = await gcFetchJson(env, `/accounts/${accountId}/${scope}/`)

  if (!upstream.ok) {
    if (upstream.status === 429 && cached) {
      const meta = buildMeta({
        scope,
        accountId,
        fromCache: true,
        stale: true,
        cachedAtMs: cached.cachedAtMs,
        rateLimit: upstream.rateLimit,
      })
      return { data: withMeta(cached.data, meta), status: 200 }
    }

    const errorMeta = buildMeta({
      scope,
      accountId,
      fromCache: false,
      stale: false,
      cachedAtMs: null,
      rateLimit: upstream.rateLimit,
    })
    return { data: withMeta(upstream.data, errorMeta), status: upstream.status }
  }

  const ttlSeconds = scopeTtlSeconds[scope]
  const record: CacheRecord = {
    data: upstream.data,
    cachedAtMs: now,
    expiresAtMs: now + ttlSeconds * 1000,
    rateLimit: upstream.rateLimit,
  }
  await writeCache(env, cacheKey, record)

  const successMeta = buildMeta({
    scope,
    accountId,
    fromCache: false,
    stale: false,
    cachedAtMs: now,
    rateLimit: upstream.rateLimit,
  })

  return { data: withMeta(upstream.data, successMeta), status: 200 }
}

export async function clearAccountCache(env: Bindings, accountIds: string[]): Promise<void> {
  if (!env.GOCARDLESS_CACHE) return
  const scopes: AccountScope[] = ['details', 'balances', 'transactions']
  for (const accountId of accountIds) {
    for (const scope of scopes) {
      await env.GOCARDLESS_CACHE.delete(makeCacheKey(accountId, scope))
    }
  }
}
