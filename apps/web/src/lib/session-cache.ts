const SESSION_KEY = 'cached_session'

export function cacheSession<T>(session: T) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // no-op
  }
}

export function getCachedSession<T>(): T | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearCachedSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // no-op
  }
}
