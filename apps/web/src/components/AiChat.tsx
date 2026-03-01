import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const apiBase = import.meta.env.VITE_API_URL || ''
const chatApiUrl = `${apiBase}/api/ai/chat`
const MAX_ERROR_LENGTH = 400

function normalizeChatError(error: Error | undefined) {
  if (!error) return null

  const raw = error.message?.trim() || 'Unknown error.'
  let detail = raw

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string }
      detail = parsed.error || parsed.message || raw
    } catch {
      detail = raw
    }
  }

  const shortDetail = detail.length > MAX_ERROR_LENGTH
    ? `${detail.slice(0, MAX_ERROR_LENGTH)}...`
    : detail

  return shortDetail
}

const chatFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)

  if (response.ok) {
    return response
  }

  let detail = ''

  try {
    const body = await response.text()
    if (body) {
      if ((response.headers.get('content-type') || '').includes('application/json')) {
        try {
          const parsed = JSON.parse(body) as { error?: string; message?: string }
          detail = parsed.error || parsed.message || body
        } catch {
          detail = body
        }
      } else {
        detail = body
      }
    }
  } catch {
    detail = ''
  }

  const statusLabel = `${response.status} ${response.statusText}`.trim()
  throw new Error(detail ? `${statusLabel}: ${detail}` : statusLabel || 'Chat request failed')
}

export function AiChat() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: chatApiUrl,
      credentials: 'include',
      fetch: chatFetch,
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const errorDetail = normalizeChatError(error)
  const errorName = error?.name || 'Error'
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown'
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-2">
        {messages.length === 0 && (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            Ask anything about your notes, journal, tasks, or projects.
          </div>
        )}

        {messages.map(m => {
          const text = m.parts
            .filter(p => p.type === 'text')
            .map(p => ('text' in p ? p.text : ''))
            .join('')

          return (
            <div
              key={m.id}
              className={cn(
                'flex',
                m.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                <p className="whitespace-pre-wrap">{text}</p>
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <p className="font-medium">Request failed.</p>
            <p className="mt-1 whitespace-pre-wrap break-words"><span className="font-medium">{errorName}:</span> {errorDetail}</p>
            <p className="mt-2 whitespace-pre-wrap break-all text-xs text-destructive/80">endpoint: {chatApiUrl}</p>
            <p className="whitespace-pre-wrap break-all text-xs text-destructive/80">origin: {currentOrigin}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your notes, tasks, journal..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  )
}
