import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'

const APP_URL = 'https://app.getordo.co'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: 'Multi-View Projects',
    description:
      'Switch between List, Kanban, Calendar, Gantt, and Table views without losing context. One data model, five perspectives.',
    icon: '⊞',
  },
  {
    title: 'Knowledge Base',
    description:
      'Notebook-based notes with a rich editor, autosave, and fast switching. Your second brain, always in sync.',
    icon: '◎',
  },
  {
    title: 'Daily Journal',
    description:
      'Structured daily entries for reflections, focus tracking, sleep quality, and mood. Build the habit of clarity.',
    icon: '◈',
  },
  {
    title: 'Local-First Sync',
    description:
      'Your data lives on your device first. Sync happens over WebSockets to the edge. Works offline, ships fast.',
    icon: '⟐',
  },
  {
    title: 'Unified Timeline',
    description:
      'Every action is logged. See what changed, when, and why — across tasks, notes, and projects.',
    icon: '⊡',
  },
  {
    title: 'CRM & Integrations',
    description:
      'Connect X, Google, and more. Manage contacts and relationships alongside your projects.',
    icon: '⬡',
  },
]

const CAPABILITIES = [
  { label: 'Inbox capture', detail: 'Quick-add tasks with project assignment' },
  { label: 'Five views', detail: 'List · Kanban · Calendar · Gantt · Table' },
  { label: 'Rich editor', detail: 'Block-based notes with slash commands' },
  { label: 'Drag-and-drop', detail: 'Reorder tasks, move across views' },
  { label: 'Offline mode', detail: 'Full functionality without a connection' },
  { label: 'Dark & light', detail: 'Tuned themes for day and night work' },
]

const BLOG_POSTS = [
  {
    slug: 'why-local-first',
    title: 'Why We Chose Local-First Architecture',
    excerpt:
      'Most productivity apps treat your data as theirs. We built Ordo so your tasks and notes live on your device first, syncing to the edge only when you choose.',
    date: 'Feb 28, 2026',
    readTime: '6 min read',
    category: 'Engineering',
  },
  {
    slug: 'five-views-one-model',
    title: 'Five Views, One Data Model: How Ordo Keeps Your Projects in Sync',
    excerpt:
      'List, Kanban, Calendar, Gantt, and Table — every view reads from the same source of truth. Here\'s how we designed the schema to make that seamless.',
    date: 'Feb 20, 2026',
    readTime: '8 min read',
    category: 'Product',
  },
  {
    slug: 'building-on-cloudflare',
    title: 'Building a Real-Time Sync Engine on Cloudflare Durable Objects',
    excerpt:
      'Durable Objects gave us per-user WebSocket sync with zero cold starts. This post walks through our sync architecture and the trade-offs we made.',
    date: 'Feb 12, 2026',
    readTime: '10 min read',
    category: 'Engineering',
  },
  {
    slug: 'daily-journaling-for-builders',
    title: 'Daily Journaling for Builders: Why Reflection Beats Hustle',
    excerpt:
      'We added a daily journal to Ordo because shipping fast without reflection is just moving in circles. Here\'s the framework we built around.',
    date: 'Feb 5, 2026',
    readTime: '5 min read',
    category: 'Productivity',
  },
  {
    slug: 'designing-the-knowledge-base',
    title: 'Designing a Knowledge Base That Developers Actually Use',
    excerpt:
      'Most note-taking apps are either too simple or too complex. We aimed for the sweet spot — structured notebooks with a fast, block-based editor.',
    date: 'Jan 28, 2026',
    readTime: '7 min read',
    category: 'Design',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Finally a task manager that doesn\'t fight my workflow. The Gantt + Kanban combo is unmatched.',
    author: 'Early Adopter',
    role: 'Product Engineer',
  },
  {
    quote: 'The local-first architecture means I can work on flights and everything syncs when I land.',
    author: 'Beta User',
    role: 'Startup Founder',
  },
  {
    quote: 'Ordo replaced three separate apps for me — tasks, notes, and journaling in one clean interface.',
    author: 'Power User',
    role: 'Design Lead',
  },
]

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="h-8 w-8" />

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1v2m0 10v2m-7-7h2m10 0h2m-2.5-4.5L11 4.5m-6 7L3.5 12.5m0-9L5 5m6 6 1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 10.07A6.5 6.5 0 0 1 5.93 2.5 6 6 0 1 0 13.5 10.07Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <a href="/" className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold">
            O
          </span>
          <span className="text-sm font-semibold tracking-tight">Ordo</span>
        </a>

        <nav className="hidden items-center gap-8 text-[13px] text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#testimonials" className="transition-colors hover:text-foreground">Testimonials</a>
          <a href="/blog" className="transition-colors hover:text-foreground">Blog</a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggleButton />
          <a
            href={APP_URL}
            className={cn(
              buttonVariants({ size: 'sm' }),
              'rounded-full px-4 text-xs font-medium'
            )}
          >
            Open App
          </a>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,var(--color-muted)/40,transparent)]" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-24 md:pb-28 md:pt-36">
        <Badge
          variant="outline"
          className="mb-6 rounded-full border-border/60 px-3 py-1 text-xs font-normal text-muted-foreground"
        >
          Now in public beta
        </Badge>

        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
          The productivity OS{' '}
          <span className="text-muted-foreground">for people who ship.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Tasks, projects, notes, and daily journaling — unified in one
          local-first workspace. Fast by default. Yours to own.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={APP_URL}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'rounded-full px-6 text-sm font-medium'
            )}
          >
            Start using Ordo
          </a>
          <a
            href="#features"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'rounded-full px-6 text-sm font-medium'
            )}
          >
            See what's inside
          </a>
        </div>

        {/* Stats strip */}
        <div className="mt-16 flex flex-wrap items-center gap-8 border-t border-border/40 pt-8 text-sm text-muted-foreground md:gap-12">
          <div>
            <p className="text-2xl font-semibold text-foreground">5</p>
            <p className="mt-0.5">Project views</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">Local-first</p>
            <p className="mt-0.5">Offline by design</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">Edge sync</p>
            <p className="mt-0.5">Cloudflare Workers</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">Open</p>
            <p className="mt-0.5">Built in public</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="border-t border-border/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-12 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Capabilities
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Ordo is a single workspace that replaces your task manager, note-taking
            app, and daily journal.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group bg-background p-6 transition-colors hover:bg-muted/30 md:p-8"
            >
              <span className="mb-4 block text-xl text-muted-foreground transition-colors group-hover:text-foreground">
                {feature.icon}
              </span>
              <h3 className="text-sm font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-12 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            One workflow, multiple surfaces
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Every view operates on the same data model. Switch freely between
            perspectives without losing context.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.label}
              className="rounded-xl border border-border/60 bg-background p-5 transition-colors hover:border-border"
            >
              <p className="text-sm font-semibold">{cap.label}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{cap.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section id="testimonials" className="border-t border-border/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-12 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            What people say
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Loved by early adopters
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.author}
              className="flex flex-col justify-between rounded-xl border border-border/60 bg-background p-6 md:p-8"
            >
              <p className="text-sm leading-relaxed text-foreground">
                "{t.quote}"
              </p>
              <footer className="mt-6 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {t.author[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}

function Blog() {
  return (
    <section id="blog" className="border-t border-border/40 bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Blog
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              From the team
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Engineering deep-dives, product thinking, and lessons from building
              Ordo in public.
            </p>
          </div>
          <a
            href="/blog"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'shrink-0 rounded-full px-4 text-xs'
            )}
          >
            View all posts
          </a>
        </div>

        {/* Featured post */}
        <a
          href={`/blog/${BLOG_POSTS[0].slug}`}
          className="group mb-6 block rounded-xl border border-border/60 bg-background p-6 transition-colors hover:border-border md:p-8"
        >
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary" className="rounded-full text-[11px]">
              {BLOG_POSTS[0].category}
            </Badge>
            <span>{BLOG_POSTS[0].date}</span>
            <span className="hidden sm:inline">&middot;</span>
            <span className="hidden sm:inline">{BLOG_POSTS[0].readTime}</span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight transition-colors group-hover:text-muted-foreground md:text-2xl">
            {BLOG_POSTS[0].title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {BLOG_POSTS[0].excerpt}
          </p>
        </a>

        {/* Rest of posts */}
        <div className="grid gap-4 sm:grid-cols-2">
          {BLOG_POSTS.slice(1).map((post) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-xl border border-border/60 bg-background p-5 transition-colors hover:border-border md:p-6"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {post.category}
                </Badge>
                <span>{post.date}</span>
                <span>&middot;</span>
                <span>{post.readTime}</span>
              </div>
              <h3 className="mt-2.5 text-sm font-semibold leading-snug transition-colors group-hover:text-muted-foreground">
                {post.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                {post.excerpt}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Ready to focus on what matters?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
            Start organizing tasks, projects, and notes in one clean system.
            Free during beta.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={APP_URL}
              className={cn(
                buttonVariants({ size: 'lg' }),
                'rounded-full px-8 text-sm font-medium'
              )}
            >
              Get started
            </a>
            <a
              href="mailto:hello@getordo.co"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'rounded-full px-8 text-sm font-medium'
              )}
            >
              Contact the team
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background text-xs font-bold">
                O
              </span>
              <span className="text-sm font-semibold">Ordo</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The productivity OS for people who ship.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Product
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="transition-colors hover:text-foreground">Features</a></li>
              <li><a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a></li>
              <li><a href={APP_URL} className="transition-colors hover:text-foreground">Open App</a></li>
              <li><a href="/blog" className="transition-colors hover:text-foreground">Blog</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Company
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="mailto:hello@getordo.co" className="transition-colors hover:text-foreground">Contact</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Legal
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="transition-colors hover:text-foreground">Privacy</a></li>
              <li><a href="#" className="transition-colors hover:text-foreground">Terms</a></li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-border/40" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <p>&copy; {year} Ordo. All rights reserved.</p>
          <p>Built local-first on Cloudflare.</p>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function MarketingContent() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Blog />
        <CTA />
      </main>
      <Footer />
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
