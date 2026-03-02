import type { Hono } from 'hono'
import { createAuth } from '../auth'
import type { Bindings } from '../index'

type SessionUser = {
  id: string
  email: string
  name?: string
}

type AccountRow = {
  id: string
}

type XAccountRow = {
  username: string
  x_user_id: string
}

type GocardlessRequisitionRow = {
  institution_name: string | null
  status: string
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

export function registerAccountRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.get('/api/accounts/status', async (c) => {
    const user = await getSessionUser(c.env, c.req.raw.headers, c.req.raw.cf as IncomingRequestCfProperties)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const googleAccount = await c.env.auth_db
      .prepare('SELECT id FROM accounts WHERE user_id = ? AND provider_id = ? LIMIT 1')
      .bind(user.id, 'google')
      .first<AccountRow>()

    const xAccount = await c.env.auth_db
      .prepare('SELECT username, x_user_id FROM x_accounts WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<XAccountRow>()

    const gcRequisition = await c.env.auth_db
      .prepare('SELECT institution_name, status FROM gocardless_requisitions WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<GocardlessRequisitionRow>()

    return c.json({
      googleConnected: Boolean(googleAccount),
      xConnected: Boolean(xAccount),
      xUsername: xAccount?.username,
      xProfilePending: xAccount ? (xAccount.x_user_id === 'me' || xAccount.username === 'connected') : false,
      gocardlessConnected: gcRequisition?.status === 'linked',
      gocardlessInstitution: gcRequisition?.institution_name ?? null,
    })
  })
}
