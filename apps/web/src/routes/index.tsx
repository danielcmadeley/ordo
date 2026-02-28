import { createFileRoute, Link } from '@tanstack/react-router'
import { requireAuthSession } from '@/lib/auth-guards'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const Route = createFileRoute('/')({
  component: DashboardPage,
  beforeLoad: requireAuthSession,
})

function DashboardPage() {
  const { user } = useCurrentUser()

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.name || user?.email}!
          </h1>
          <p className="text-muted-foreground mt-2">Here's your dashboard overview.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/project-manager/inbox"
            className="bg-card text-card-foreground border border-border rounded-xl p-6 transition-colors hover:bg-accent/50"
          >
            <h2 className="text-xl font-semibold text-foreground mb-2">Project Manager</h2>
            <p className="text-muted-foreground">Manage your tasks and todos</p>
          </Link>

          <Link
            to="/knowledge-base"
            className="bg-card text-card-foreground border border-border rounded-xl p-6 transition-colors hover:bg-accent/50"
          >
            <h2 className="text-xl font-semibold text-foreground mb-2">Knowledge Base</h2>
            <p className="text-muted-foreground">Store and retrieve knowledge</p>
          </Link>

          <Link
            to="/journal"
            className="bg-card text-card-foreground border border-border rounded-xl p-6 transition-colors hover:bg-accent/50"
          >
            <h2 className="text-xl font-semibold text-foreground mb-2">Journal</h2>
            <p className="text-muted-foreground">Daily notes and reflections</p>
          </Link>

          <Link
            to="/crm"
            className="bg-card text-card-foreground border border-border rounded-xl p-6 transition-colors hover:bg-accent/50"
          >
            <h2 className="text-xl font-semibold text-foreground mb-2">CRM</h2>
            <p className="text-muted-foreground">Manage contacts and relationships</p>
          </Link>

          <Link
            to="/finance"
            className="bg-card text-card-foreground border border-border rounded-xl p-6 transition-colors hover:bg-accent/50"
          >
            <h2 className="text-xl font-semibold text-foreground mb-2">Finance</h2>
            <p className="text-muted-foreground">Track income and expenses</p>
          </Link>

          <Link
            to="/settings"
            className="bg-card text-card-foreground border border-border rounded-xl p-6 transition-colors hover:bg-accent/50"
          >
            <h2 className="text-xl font-semibold text-foreground mb-2">Settings</h2>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
