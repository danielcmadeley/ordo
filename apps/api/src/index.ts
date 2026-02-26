import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as SyncBackend from '@livestore/sync-cf/cf-worker'
import { SyncBackendDO } from './sync/client-ws'
import { createAuth } from './auth'
import { appRouter } from './orpc/router'
import { RPCHandler } from '@orpc/server/fetch'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'

import type { CfTypes } from '@livestore/sync-cf/cf-worker'

type Bindings = {
  auth_db: D1Database
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  SYNC_BACKEND_DO: DurableObjectNamespace<SyncBackendDO>
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for frontend
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4173', 'http://localhost:5173', 'https://ordo-6zh.pages.dev', 'https://app.getordo.co'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'Cookie',
    'X-Better-Auth-CSRF',
    'X-Better-Auth-Callback-URL',
    'X-Requested-With',
  ],
  credentials: true,
}))

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Better Auth handler
app.use('/api/auth/*', async (c) => {
  const auth = createAuth(c.env, c.req.raw.cf as IncomingRequestCfProperties)
  return auth.handler(c.req.raw)
})

// LiveStore sync WebSocket endpoint
app.use('/sync', async (c) => {
  const searchParams = SyncBackend.matchSyncRequest(c.req.raw as unknown as CfTypes.Request)
  if (searchParams !== undefined) {
    return SyncBackend.handleSyncRequest({
      request: c.req.raw as unknown as CfTypes.Request,
      searchParams,
      ctx: c.executionCtx as unknown as CfTypes.ExecutionContext,
      syncBackendBinding: 'SYNC_BACKEND_DO',
    })
  }
  return c.text('Not Found', 404)
})

// Body parser methods that need to be proxied
const BODY_PARSER_METHODS = new Set(['arrayBuffer', 'blob', 'formData', 'json', 'text'] as const)
type BodyParserMethod = typeof BODY_PARSER_METHODS extends Set<infer T> ? T : never

// oRPC handler
const orpcHandler = new RPCHandler(appRouter)

app.use('/rpc/*', async (c, next) => {
  // Create auth instance for this request
  const auth = createAuth({
    auth_db: c.env.auth_db,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
  }, c.req.raw.cf as IncomingRequestCfProperties)

  // Proxy the request to allow Hono's body parsers to work with oRPC
  const request = new Proxy(c.req.raw, {
    get(target, prop) {
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () => c.req[prop as BodyParserMethod]()
      }
      return Reflect.get(target, prop, target)
    }
  })

  const { matched, response } = await orpcHandler.handle(request, {
    prefix: '/rpc',
    context: {
      headers: c.req.raw.headers,
      db: c.env.auth_db,
      auth,
    }
  })

  if (matched) {
    return c.newResponse(response.body, response)
  }

  await next()
})

// OpenAPI handler for REST API
const openAPIHandler = new OpenAPIHandler(appRouter)

app.use('/api/*', async (c, next) => {
  // Create auth instance for this request
  const auth = createAuth({
    auth_db: c.env.auth_db,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
  }, c.req.raw.cf as IncomingRequestCfProperties)

  // Proxy the request to allow Hono's body parsers to work with oRPC
  const request = new Proxy(c.req.raw, {
    get(target, prop) {
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () => c.req[prop as BodyParserMethod]()
      }
      return Reflect.get(target, prop, target)
    }
  })

  const { matched, response } = await openAPIHandler.handle(request, {
    prefix: '/api',
    context: {
      headers: c.req.raw.headers,
      db: c.env.auth_db,
      auth,
    }
  })

  if (matched) {
    return c.newResponse(response.body, response)
  }

  await next()
})

// OpenAPI specification endpoint
app.get('/openapi.json', async (c) => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [
      new ZodToJsonSchemaConverter(),
    ],
  })

  const spec = await generator.generate(appRouter, {
    info: {
      title: 'LiveStore Todo API',
      version: '1.0.0',
      description: 'Type-safe API with oRPC and OpenAPI',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Development server' },
    ],
  })

  return c.json(spec)
})

// Scalar API Documentation UI
app.get('/docs', async (c) => {
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>LiveStore Todo API - Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.js"></script>
    <script>
      Scalar.createApiReference(document.getElementById('app'), {
        url: '/openapi.json',
        title: 'LiveStore Todo API',
        theme: 'purple',
      })
    </script>
  </body>
</html>
  `
  return c.html(html)
})

// Export the Durable Object
export { SyncBackendDO }

// Export default for Cloudflare Workers
export default {
  fetch: app.fetch,
}
