import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'

const APP_URL = 'https://app.getordo.co'

const FEATURES = [
  {
    title: 'Project Manager',
    description: 'Run the same task data across List, Kanban, Table, Calendar, and Gantt views without context switching.',
    badge: 'Execution',
  },
  {
    title: 'Knowledge Base',
    description: 'Capture notebook-based notes with a rich editor, autosave flow, and fast note switching.',
    badge: 'Documentation',
  },
  {
    title: 'Daily Journal',
    description: 'Track daily reflections, feeling, sleep quality, and focus in a structured entry with rich text.',
    badge: 'Personal Ops',
  },
  {
    title: 'Task Detail Side Panel',
    description: 'Open and edit task details in-context from planning views without leaving your current board or timeline.',
    badge: 'Focus',
  },
  {
    title: 'Unified History',
    description: 'Every create, update, complete, and delete action is logged so progress stays visible over time.',
    badge: 'Traceability',
  },
  {
    title: 'Auth + Sync Foundation',
    description: 'Secure auth, local-first persistence, and sync-ready architecture for resilient workflows online or offline.',
    badge: 'Reliability',
  },
]

const MODULES = [
  'Inbox capture with project assignment',
  'Project planning across 5 synchronized views',
  'Fullscreen calendar planning with month controls',
  'Gantt timeline updates with drag-to-move',
  'Kanban drag-and-drop with quick task editing',
  'Table editing for fast bulk updates',
  'Knowledge notebooks and rich notes',
  'Daily Journal for reflection and focus tracking',
  'Settings with theme and account controls',
  'Future-ready CRM and Finance routes',
]

function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'
  const label = isDark ? 'Light mode' : 'Dark mode'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle color mode"
    >
      {label}
    </Button>
  )
}

function MarketingContent() {
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
              O
            </span>
            <div>
              <p className="text-sm font-semibold leading-none">Ordo</p>
              <p className="text-xs text-muted-foreground">Focus on what matters</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#cta" className="hover:text-foreground transition-colors">Get Started</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <a href={APP_URL} className={cn(buttonVariants({ size: 'sm' }))}>Open App</a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-6 pb-10 pt-14 md:pt-20">
          <Badge variant="secondary" className="mb-4">Now shipping on Ordo</Badge>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            The calm command center for tasks, projects, and knowledge.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Ordo combines rapid capture, multi-view project planning, structured notes, and daily reflection in one workspace.
            Built for momentum and tuned for clarity in both light and dark mode.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={APP_URL} className={cn(buttonVariants())}>Start using Ordo</a>
            <a href="#features" className={cn(buttonVariants({ variant: 'outline' }))}>Explore features</a>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-6 py-6 md:py-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">Built around real work</h2>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                Everything in the web app is designed for speed, clarity, and continuity.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(feature => (
              <Card key={feature.title} className="border-border bg-card">
                <CardHeader>
                  <Badge variant="outline" className="w-fit">{feature.badge}</Badge>
                  <CardTitle className="mt-2">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto w-full max-w-6xl px-6 py-8 md:py-12">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-2xl">One workflow, multiple surfaces</CardTitle>
              <CardDescription>
                Ordo keeps your focus loop tight from planning through execution and documentation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                {MODULES.map(item => (
                  <li key={item} className="flex items-start gap-2 rounded-lg border border-border bg-background/50 p-3">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section id="cta" className="mx-auto w-full max-w-6xl px-6 pb-16 pt-4 md:pb-24">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl">Ready to run your day with Ordo?</CardTitle>
            <CardDescription>
              Open the app and start organizing tasks, projects, and notes in one clean system.
            </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <a href={APP_URL} className={cn(buttonVariants())}>Go to app.getordo.co</a>
              <a href="mailto:hello@getordo.co" className={cn(buttonVariants({ variant: 'secondary' }))}>Contact the team</a>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5 text-sm text-muted-foreground">
          <p>© {year} Ordo</p>
          <p>Built with the same design system as the web app.</p>
        </div>
      </footer>
    </div>
  )
}

export function MarketingPage() {
  return (
    <ThemeProvider>
      <MarketingContent />
    </ThemeProvider>
  )
}
