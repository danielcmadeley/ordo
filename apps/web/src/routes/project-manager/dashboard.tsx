import { createFileRoute } from '@tanstack/react-router'
import { requireAuthSession } from '@/lib/auth-guards'

export const Route = createFileRoute('/project-manager/dashboard')({
  component: ProjectManagerDashboardPage,
  beforeLoad: requireAuthSession,
})

function ProjectManagerDashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground">Project Manager — Dashboard</h1>
      <p className="text-muted-foreground mt-2">Coming soon.</p>
    </div>
  )
}
