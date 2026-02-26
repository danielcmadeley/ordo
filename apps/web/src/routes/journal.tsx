import { createFileRoute } from '@tanstack/react-router'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/journal')({
  component: JournalPage,
  beforeLoad: requireAuthSession,
})

function JournalPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800">Journal</h1>
      <p className="text-gray-500 mt-2">Coming soon.</p>
    </div>
  )
}
