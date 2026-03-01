import { createFileRoute } from '@tanstack/react-router'
import { requireAuthSession } from '@/lib/auth-guards'
import { AiChat } from '@/components/AiChat'

export const Route = createFileRoute('/ai')({
  component: AiPage,
  beforeLoad: requireAuthSession,
})

function AiPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold">Ask Ordo</h1>
        <p className="text-xs text-muted-foreground">Search across your notes, journal, tasks, and projects.</p>
      </div>
      <div className="min-h-0 flex-1">
        <AiChat />
      </div>
    </div>
  )
}
