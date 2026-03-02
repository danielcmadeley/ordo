import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'

const apiBase = import.meta.env.VITE_API_URL || ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = createORPCClient<any>(
  new RPCLink({
    url: `${apiBase}/rpc`,
    fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const orpc = createTanstackQueryUtils(client as any)
