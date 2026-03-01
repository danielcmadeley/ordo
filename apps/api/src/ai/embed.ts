import { Hono } from 'hono'
import { z } from 'zod'
import type { Bindings } from '../index'
import { createAuth } from '../auth'

const embedSchema = z.object({
  id: z.string(),
  type: z.enum(['note', 'journal', 'task', 'project']),
  action: z.enum(['upsert', 'delete']),
  title: z.string().optional(),
  content: z.string(),
})

export function registerEmbedRoute(app: Hono<{ Bindings: Bindings }>) {
  app.post('/api/ai/embed', async (c) => {
    const auth = createAuth(c.env, c.req.raw.cf as IncomingRequestCfProperties)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const parsed = embedSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400)
    }

    const input = parsed.data
    const user = session.user

    if (input.action === 'delete') {
      await c.env.VECTORIZE.deleteByIds([input.id])
      return c.json({ ok: true })
    }

    const text = [input.title, input.content].filter(Boolean).join(' ')
    if (!text.trim()) {
      return c.json({ ok: true }) // nothing to embed
    }

    const ai = c.env.AI as unknown as { run: (model: string, params: { text: string }) => Promise<{ data: number[][] }> }
    const result = await ai.run('@cf/baai/bge-base-en-v1.5', { text })

    console.log('[embed] embedding generated, vector length:', result.data[0]?.length, 'for id:', input.id, 'userId:', user.id)

    const upsertResult = await c.env.VECTORIZE.upsert([
      {
        id: input.id,
        values: result.data[0],
        metadata: {
          userId: user.id,
          type: input.type,
          title: input.title ?? '',
          content: input.content.slice(0, 8000),
        },
      },
    ])

    console.log('[embed] upsert result:', JSON.stringify(upsertResult))

    return c.json({ ok: true })
  })
}
