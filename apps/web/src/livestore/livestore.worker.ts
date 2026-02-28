import { makeWorker } from '@livestore/adapter-web/worker'
import { makeWsSync } from '@livestore/sync-cf/client'

import { schema } from '@ordo/shared/livestore-schema'

const syncBaseUrl = import.meta.env.VITE_SYNC_URL || import.meta.env.VITE_API_URL || location.origin
const syncUrl = new URL('/sync', syncBaseUrl)

if (syncUrl.protocol === 'https:') {
  syncUrl.protocol = 'wss:'
} else if (syncUrl.protocol === 'http:') {
  syncUrl.protocol = 'ws:'
}

makeWorker({
  schema,
  sync: {
    backend: makeWsSync({ url: syncUrl.toString() }),
  }
})
