// See: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('ordo', {
  platform: process.platform,
})
