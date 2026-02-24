import { makeDurableObject } from '@livestore/sync-cf/cf-worker'

export class SyncBackendDO extends makeDurableObject({
  onPush: async () => {
    // Handle sync push operations
  },
  onPull: async () => {
    // Handle sync pull operations
  },
}) { }