import { Hono } from 'hono'
import { streamText, convertToModelMessages } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import type { Bindings } from '../index'
import { createAuth } from '../auth'

export function registerChatRoute(app: Hono<{ Bindings: Bindings }>) {
  app.post('/api/ai/chat', async (c) => {
    const auth = createAuth(c.env, c.req.raw.cf as IncomingRequestCfProperties)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json<{ messages: unknown[] }>()
    const uiMessages = body.messages ?? []

    // AI SDK v6 UIMessages use `parts` (not `content`) for structured content
    type UIMsg = { role?: string; parts?: { type: string; text?: string }[]; content?: string }
    const lastMessage = uiMessages[uiMessages.length - 1] as UIMsg | undefined
    const lastText =
      lastMessage?.parts?.filter(p => p.type === 'text').map(p => p.text ?? '').join(' ').trim() ||
      (typeof lastMessage?.content === 'string' ? lastMessage.content.trim() : '') ||
      ''

    if (!lastText) {
      return c.json({ error: 'No message text found' }, 400)
    }

    // Embed the question using Workers AI
    const ai = c.env.AI as unknown as { run: (model: string, params: { text: string }) => Promise<{ data: number[][] }> }
    const queryEmbedding = await ai.run('@cf/baai/bge-base-en-v1.5', { text: lastText })

    // Broad search — topK=20, low threshold so listing queries ("what projects do I have?") get full recall
    const matches = await c.env.VECTORIZE.query(queryEmbedding.data[0], {
      topK: 20,
      returnMetadata: 'all',
      filter: { userId: session.user.id },
    })

    console.log('[chat] vectorize returned', matches.matches.length, 'matches:', JSON.stringify(matches.matches.map(m => ({ id: m.id, score: m.score, type: m.metadata?.type, title: m.metadata?.title }))))

    // Low threshold (0.2) to ensure listing queries return all matching items
    const relevantMatches = matches.matches.filter(m => m.score > 0.2)

    const context = relevantMatches.length > 0
      ? relevantMatches.map(m => {
          const type = String(m.metadata?.type ?? '').toUpperCase()
          const title = m.metadata?.title ?? 'Untitled'
          const content = m.metadata?.content ?? ''
          return `[${type} — "${title}"]\n${content}`
        }).join('\n\n---\n\n')
      : 'No items found in your data.'

    const workersAI = createWorkersAI({ binding: c.env.AI })

    const result = streamText({
      model: workersAI('@cf/meta/llama-3.1-8b-instruct'),
      system: `You are a personal productivity assistant for Ordo. You have access to the user's data retrieved via semantic search.

DATA MODEL:
- NOTE: notes written by the user (stored in Knowledge Base)
- JOURNAL: daily journal entries
- TASK: tasks — content shows which project they belong to. Tasks starting with "Inbox" or in the "Inbox" section have no project assigned. Tasks show "Project: <name>" if they belong to a project.
- PROJECT: user projects that group tasks together

RULES:
- Answer directly and helpfully based on the context items provided.
- For listing questions ("what tasks do I have?", "what projects do I have?"), enumerate ALL items of that type found in the context.
- A task is in the "inbox" if its content starts with "Inbox" or says "Location: Inbox".
- Always mention the item title when referencing it.
- If you don't find enough data to answer, say what you DID find and suggest the user add more data.
- Do NOT say "I don't have access" — if the context is empty, say "I couldn't find any [type] in your data yet."

CONTEXT (${relevantMatches.length} items retrieved):
${context}`,
      messages: await convertToModelMessages(uiMessages as Parameters<typeof convertToModelMessages>[0]),
    })

    return result.toUIMessageStreamResponse()
  })
}
