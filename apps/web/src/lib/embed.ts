import { useMutation } from '@tanstack/react-query'

export type EmbedAction = 'upsert' | 'delete'
export type EmbedType = 'note' | 'journal' | 'task' | 'project'

export interface EmbedPayload {
  id: string
  type: EmbedType
  action: EmbedAction
  title?: string
  content: string
}

/** Strips HTML tags to produce plain text suitable for embedding. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

const apiBase = import.meta.env.VITE_API_URL || ''

/** Fire-and-forget mutation — errors are silently swallowed so offline use never blocks writes. */
export function useEmbedItem() {
  return useMutation({
    mutationFn: async (payload: EmbedPayload) => {
      await fetch(`${apiBase}/api/ai/embed`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onError: () => {
      // Silently ignore — embed failures never block the local LiveStore write
    },
  })
}
