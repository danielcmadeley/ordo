const CACHE_TTL_SECONDS = 300
const DEFAULT_LIMIT = 10

type BookmarkItem = {
  id: string
  text: string
  created_at?: string
  author_id?: string
  attachments?: {
    media_keys?: string[]
  }
}

type BookmarkMedia = {
  media_key: string
  type: string
  url?: string
  preview_image_url?: string
  alt_text?: string
  width?: number
  height?: number
}

type BookmarksResponse = {
  data?: BookmarkItem[]
  includes?: {
    users?: Array<{ id: string; username: string; name?: string; profile_image_url?: string }>
    media?: BookmarkMedia[]
  }
  meta?: {
    next_token?: string
    previous_token?: string
    result_count?: number
  }
  error?: string
}

type CacheEnv = {
  X_CACHE?: KVNamespace
}

type BookmarkRow = {
  bookmark_id: string
  text: string
  author_id: string | null
  created_at: string
  raw_json: string
}

type MediaRow = {
  bookmark_id: string
  media_key: string
  type: string
  url: string | null
  preview_image_url: string | null
  alt_text: string | null
  width: number | null
  height: number | null
}

type SyncStateRow = {
  last_synced_at: number | null
  next_pagination_token: string | null
  last_sync_status: string | null
  last_error: string | null
}

function encodeCursor(createdAt: string, bookmarkId: string) {
  return `d1:${btoa(`${createdAt}|${bookmarkId}`)}`
}

function decodeCursor(token: string | null) {
  if (!token || !token.startsWith('d1:')) return null
  try {
    const raw = atob(token.slice(3))
    const [createdAt, bookmarkId] = raw.split('|')
    if (!createdAt || !bookmarkId) return null
    return { createdAt, bookmarkId }
  } catch {
    return null
  }
}

export function buildBookmarkCacheKey(userId: string, paginationToken: string | null, limit: number) {
  if (!paginationToken) return `x:bookmarks:v1:${userId}:first:${limit}`
  return `x:bookmarks:v1:${userId}:cursor:${paginationToken}:${limit}`
}

export async function readBookmarksCache(env: CacheEnv, userId: string, paginationToken: string | null, limit: number) {
  if (!env.X_CACHE) return null
  const key = buildBookmarkCacheKey(userId, paginationToken, limit)
  const cached = await env.X_CACHE.get(key)
  if (!cached) return null
  try {
    return JSON.parse(cached) as BookmarksResponse
  } catch {
    return null
  }
}

export async function writeBookmarksCache(env: CacheEnv, userId: string, paginationToken: string | null, limit: number, payload: BookmarksResponse) {
  if (!env.X_CACHE) return
  const key = buildBookmarkCacheKey(userId, paginationToken, limit)
  await env.X_CACHE.put(key, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS })
}

export async function clearFirstPageBookmarksCache(env: CacheEnv, userId: string, limit = DEFAULT_LIMIT) {
  if (!env.X_CACHE) return
  const key = buildBookmarkCacheKey(userId, null, limit)
  await env.X_CACHE.delete(key)
}

export async function getBookmarkSyncState(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT last_synced_at, next_pagination_token, last_sync_status, last_error
       FROM x_bookmark_sync_state
       WHERE user_id = ?`
    )
    .bind(userId)
    .first<SyncStateRow>()
}

export function isBookmarkSyncStale(lastSyncedAt: number | null | undefined, staleMs = 5 * 60_000) {
  if (!lastSyncedAt) return true
  return Date.now() - lastSyncedAt > staleMs
}

export async function upsertBookmarkSyncState(
  db: D1Database,
  input: {
    userId: string
    lastSyncedAt?: number | null
    nextPaginationToken?: string | null
    lastSyncStatus?: string | null
    lastError?: string | null
  }
) {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO x_bookmark_sync_state
       (user_id, last_synced_at, next_pagination_token, last_sync_status, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         last_synced_at = excluded.last_synced_at,
         next_pagination_token = excluded.next_pagination_token,
         last_sync_status = excluded.last_sync_status,
         last_error = excluded.last_error,
         updated_at = excluded.updated_at`
    )
    .bind(
      input.userId,
      input.lastSyncedAt ?? null,
      input.nextPaginationToken ?? null,
      input.lastSyncStatus ?? null,
      input.lastError ?? null,
      now,
    )
    .run()
}

export async function readBookmarksFromDb(
  db: D1Database,
  input: {
    userId: string
    limit: number
    paginationToken: string | null
  }
) {
  const decoded = decodeCursor(input.paginationToken)
  const hasExternalToken = Boolean(input.paginationToken && !decoded)

  if (hasExternalToken) {
    return {
      response: {
        data: [],
        includes: { users: [], media: [] },
        meta: { result_count: 0 },
      } satisfies BookmarksResponse,
      hasRows: false,
      usedExternalToken: true,
    }
  }

  const rows = decoded
    ? await db
      .prepare(
        `SELECT bookmark_id, text, author_id, created_at, raw_json
         FROM x_bookmarks
         WHERE user_id = ?
           AND (created_at < ? OR (created_at = ? AND bookmark_id < ?))
         ORDER BY created_at DESC, bookmark_id DESC
         LIMIT ?`
      )
      .bind(input.userId, decoded.createdAt, decoded.createdAt, decoded.bookmarkId, input.limit)
      .all<BookmarkRow>()
    : await db
      .prepare(
        `SELECT bookmark_id, text, author_id, created_at, raw_json
         FROM x_bookmarks
         WHERE user_id = ?
         ORDER BY created_at DESC, bookmark_id DESC
         LIMIT ?`
      )
      .bind(input.userId, input.limit)
      .all<BookmarkRow>()

  const bookmarkRows = rows.results || []
  const bookmarkIds = bookmarkRows.map((row) => row.bookmark_id)

  let mediaRows: MediaRow[] = []
  if (bookmarkIds.length > 0) {
    const placeholders = bookmarkIds.map(() => '?').join(', ')
    const mediaResult = await db
      .prepare(
        `SELECT bookmark_id, media_key, type, url, preview_image_url, alt_text, width, height
         FROM x_bookmark_media
         WHERE user_id = ? AND bookmark_id IN (${placeholders})`
      )
      .bind(input.userId, ...bookmarkIds)
      .all<MediaRow>()
    mediaRows = mediaResult.results || []
  }

  const mediaByBookmark = new Map<string, BookmarkMedia[]>()
  for (const media of mediaRows) {
    const arr = mediaByBookmark.get(media.bookmark_id) || []
    arr.push({
      media_key: media.media_key,
      type: media.type,
      url: media.url ?? undefined,
      preview_image_url: media.preview_image_url ?? undefined,
      alt_text: media.alt_text ?? undefined,
      width: media.width ?? undefined,
      height: media.height ?? undefined,
    })
    mediaByBookmark.set(media.bookmark_id, arr)
  }

  const data: BookmarkItem[] = bookmarkRows.map((row) => {
    const mediaForBookmark = mediaByBookmark.get(row.bookmark_id) || []
    const mediaKeys = mediaForBookmark.map((media) => media.media_key)

    try {
      const parsed = JSON.parse(row.raw_json) as BookmarkItem
      return {
        ...parsed,
        id: parsed.id || row.bookmark_id,
        text: parsed.text || row.text,
        author_id: parsed.author_id || row.author_id || undefined,
        created_at: parsed.created_at || row.created_at,
        attachments: mediaKeys.length > 0 ? { media_keys: mediaKeys } : parsed.attachments,
      }
    } catch {
      return {
        id: row.bookmark_id,
        text: row.text,
        author_id: row.author_id || undefined,
        created_at: row.created_at,
        attachments: mediaKeys.length > 0 ? { media_keys: mediaKeys } : undefined,
      }
    }
  })

  const includesMedia = mediaRows.map((media) => ({
    media_key: media.media_key,
    type: media.type,
    url: media.url ?? undefined,
    preview_image_url: media.preview_image_url ?? undefined,
    alt_text: media.alt_text ?? undefined,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
  }))

  const last = bookmarkRows[bookmarkRows.length - 1]
  const nextToken = bookmarkRows.length === input.limit && last
    ? encodeCursor(last.created_at, last.bookmark_id)
    : undefined

  return {
    response: {
      data,
      includes: {
        users: [],
        media: includesMedia,
      },
      meta: {
        result_count: data.length,
        next_token: nextToken,
      },
    } satisfies BookmarksResponse,
    hasRows: bookmarkRows.length > 0,
    usedExternalToken: false,
  }
}

export async function upsertBookmarksFromApiResponse(
  db: D1Database,
  input: {
    userId: string
    payload: BookmarksResponse
  }
) {
  const data = input.payload.data || []
  const mediaByKey = new Map<string, BookmarkMedia>()
  for (const media of input.payload.includes?.media || []) {
    mediaByKey.set(media.media_key, media)
  }

  const now = Date.now()

  for (const bookmark of data) {
    const createdAt = bookmark.created_at || new Date(now).toISOString()
    await db
      .prepare(
        `INSERT INTO x_bookmarks (user_id, bookmark_id, text, author_id, created_at, raw_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, bookmark_id) DO UPDATE SET
           text = excluded.text,
           author_id = excluded.author_id,
           created_at = excluded.created_at,
           raw_json = excluded.raw_json,
           updated_at = excluded.updated_at`
      )
      .bind(
        input.userId,
        bookmark.id,
        bookmark.text || '',
        bookmark.author_id || null,
        createdAt,
        JSON.stringify(bookmark),
        now,
      )
      .run()

    await db
      .prepare('DELETE FROM x_bookmark_media WHERE user_id = ? AND bookmark_id = ?')
      .bind(input.userId, bookmark.id)
      .run()

    const mediaKeys = bookmark.attachments?.media_keys || []
    for (const mediaKey of mediaKeys) {
      const media = mediaByKey.get(mediaKey)
      if (!media) continue

      await db
        .prepare(
          `INSERT INTO x_bookmark_media
           (user_id, bookmark_id, media_key, type, url, preview_image_url, alt_text, width, height)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.userId,
          bookmark.id,
          media.media_key,
          media.type,
          media.url || null,
          media.preview_image_url || null,
          media.alt_text || null,
          media.width || null,
          media.height || null,
        )
        .run()
    }
  }
}
