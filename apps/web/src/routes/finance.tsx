import { createFileRoute } from '@tanstack/react-router'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/finance')({
  component: FinancePage,
  beforeLoad: requireAuthSession,
})

function FinancePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800">Finance</h1>
      <p className="text-gray-500 mt-2">Coming soon.</p>
    </div>
  )
}
