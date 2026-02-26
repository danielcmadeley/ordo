import { createFileRoute } from '@tanstack/react-router'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/crm')({
  component: CrmPage,
  beforeLoad: requireAuthSession,
})

function CrmPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800">CRM</h1>
      <p className="text-gray-500 mt-2">Coming soon.</p>
    </div>
  )
}
