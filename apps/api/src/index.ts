import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as SyncBackend from '@livestore/sync-cf/cf-worker'
import { SyncBackendDO } from './sync/client-ws'
import { createAuth } from './auth'
import { appRouter } from './orpc/router'
import { RPCHandler } from '@orpc/server/fetch'
import { registerChatRoute } from './ai/chat'
import { registerEmbedRoute } from './ai/embed'
import { registerAccountRoutes } from './accounts/routes'
import { registerXRoutes } from './x/routes'
import { registerGocardlessRoutes } from './gocardless/routes'
import { enqueueDueScheduledPosts, handleScheduledPostQueue } from './x/scheduled'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'

import type { CfTypes } from '@livestore/sync-cf/cf-worker'

export type Bindings = {
  auth_db: D1Database
  X_CACHE?: KVNamespace
  GOCARDLESS_CACHE?: KVNamespace
  SYNC_BACKEND_DO: DurableObjectNamespace<SyncBackendDO>
  VECTORIZE: VectorizeIndex
  AI: Ai
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  X_CLIENT_ID: string
  X_CLIENT_SECRET?: string
  X_REDIRECT_URI: string
  X_SCOPES?: string
  X_JOBS_QUEUE: Queue
  GOCARDLESS_SECRET_ID: string
  GOCARDLESS_SECRET_KEY: string
  GOCARDLESS_BASE_URL: string
  RESEND_API_KEY?: string
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
    'User-Agent',
    'X-Better-Auth-CSRF',
    'X-Better-Auth-Callback-URL',
    'X-Requested-With',
  ],
  credentials: true,
}))

// AI endpoints
registerChatRoute(app)
registerEmbedRoute(app)
registerAccountRoutes(app)
registerXRoutes(app)
registerGocardlessRoutes(app)

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
    RESEND_API_KEY: c.env.RESEND_API_KEY,
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
      env: c.env,
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
    RESEND_API_KEY: c.env.RESEND_API_KEY,
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
      env: c.env,
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

  // Merge raw Hono AI routes that are not in the oRPC router
  const aiPaths = {
    '/api/ai/embed': {
      post: {
        tags: ['AI'],
        summary: 'Embed a note, journal entry, task, or project',
        description: 'Generates a vector embedding and upserts (or deletes) it in Vectorize. Called client-side after every LiveStore write.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'type', 'action', 'content'],
                properties: {
                  id: { type: 'string', description: 'LiveStore item ID' },
                  type: { type: 'string', enum: ['note', 'journal', 'task', 'project'] },
                  action: { type: 'string', enum: ['upsert', 'delete'] },
                  title: { type: 'string' },
                  content: { type: 'string', description: 'Plain text content (HTML stripped client-side)' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
          '400': { description: 'Invalid input or missing text' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'Streaming RAG chat',
        description: 'Embeds the user question, searches Vectorize for relevant context, and streams a response via AI SDK UI message stream.',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    description: 'AI SDK v6 UIMessage array',
                    items: { type: 'object' },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'AI SDK UI message stream (text/event-stream)' },
          '400': { description: 'No message text found' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
  }

  const utilityPaths = {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } } } },
          },
        },
      },
    },
    '/api/auth/sign-up/email': {
      post: {
        tags: ['Auth'],
        summary: 'Sign up with email + password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'User created and session cookie set' },
          '422': { description: 'Email already in use or invalid input' },
        },
      },
    },
    '/api/auth/sign-in/email': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with email + password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Session cookie set' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/sign-out': {
      post: {
        tags: ['Auth'],
        summary: 'Sign out',
        responses: {
          '200': { description: 'Session cookie cleared' },
        },
      },
    },
    '/api/auth/get-session': {
      get: {
        tags: ['Auth'],
        summary: 'Get current session',
        responses: {
          '200': {
            description: 'Current session and user, or null if unauthenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    session: { type: 'object', nullable: true },
                    user: { type: 'object', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  }

  const merged = {
    ...spec,
    paths: { ...spec.paths, ...aiPaths, ...utilityPaths },
  }

  return c.json(merged)
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
  scheduled: async (_controller: ScheduledController, env: Bindings, _ctx: ExecutionContext) => {
    await enqueueDueScheduledPosts(env)
  },
  queue: async (batch: MessageBatch<unknown>, env: Bindings, _ctx: ExecutionContext) => {
    await handleScheduledPostQueue(batch, env)
  },
}
