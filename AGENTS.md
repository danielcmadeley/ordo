# Agent Instructions for Ordo Project

## Path Aliases

Always use the `@` import alias instead of relative paths when importing from other files in this project.
- ✅ Use: `import authClient from '@/lib/authClient'`
- ❌ Avoid: `import authClient from '../lib/authClient'` or `import authClient from '../../lib/authClient'`
- The `@` alias maps to `./src/*` and is configured in app tsconfig + bundler config
- This keeps imports cleaner, more maintainable, and consistent across the codebase
- Only use relative paths for imports from external packages (node_modules) or when importing files in the same directory

## Design System Components

**Important**: The design system is now centralized in `packages/design-system/src/`.

- ✅ **DO use** UI primitives through `@/components/ui/*` in both `apps/web` and `apps/marketing`
- ✅ App aliases map those imports to `packages/design-system/src/ui/*`
- ⚠️ **DO NOT create** app-local copies under `apps/web/src/components/ui/` or `apps/marketing/src/components/ui/`
- ⚠️ For design system changes, edit `packages/design-system/src/ui/*` instead
- ✅ Shared theme utilities also live in `packages/design-system/src/theme-provider.tsx` and `packages/design-system/src/lib/utils.ts`

These components are part of our standardized cross-app design system. If you need a new component or variant, add it in `packages/design-system/src/ui/`.

## Project Structure

This is a monorepo with the following structure:

```
├── apps/
│   ├── api/           # Hono backend on Cloudflare Workers
│   ├── web/           # React + Vite + TanStack Router frontend
│   └── marketing/     # Astro + React islands marketing site
├── packages/
│   ├── shared/        # Shared schemas (LiveStore, BetterAuth)
│   └── design-system/ # Shared UI primitives + theme tokens/provider
├── drizzle/           # Database migrations
└── bunfig.toml        # Bun workspace configuration
```

## Technology Stack

- **Package Manager**: Bun
- **Frontend App**: React 19 + Vite 7 + TanStack Router
- **Marketing Site**: Astro 5 + React islands
- **Backend**: Hono on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: BetterAuth with Google OAuth support
- **State**: LiveStore (local-first SQLite with sync)
- **API**: oRPC with OpenAPI + Scalar docs
- **Styling**: Tailwind CSS 4
- **Icons**: @hugeicons/react + @hugeicons/core-free-icons

## Environment Variables

### Root `.env` (for Drizzle Kit)
```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000  # Local: frontend origin; Production: auth API origin
GOOGLE_CLIENT_ID=       # Optional
GOOGLE_CLIENT_SECRET=   # Optional
```

### `apps/api/.dev.vars` (for Wrangler dev)
```bash
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000  # Use active frontend origin in dev/preview (:3000 or :4173)
GOOGLE_CLIENT_ID=       # Optional
GOOGLE_CLIENT_SECRET=   # Optional
```

## Common Commands

```bash
# Run both apps in dev mode
bun run dev

# Run apps separately
bun run dev:api    # Backend on :3001
bun run dev:web    # Frontend on :3000

# Database
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Apply migrations to D1

# Type checking
bun run typecheck    # Check all packages

# Install dependencies
bun install
```

## Route Structure

- **`/`** - Dashboard (protected)
- **`/inbox`** - Todo list using LiveStore (protected)
- **`/settings`** - User settings (protected)
- **`/login`** - Authentication page (public only)

All routes except `/login` are protected using TanStack Router's `beforeLoad`.

## Key Architecture Points

1. **LiveStore per-user**: Store ID includes user ID (`livestore-todo-app-v3-user-{userId}`), ensuring data isolation
2. **Auth flow**: BetterAuth handles auth at `/api/auth/*`, cookies work across ports due to CORS config
3. **oRPC integration**: Type-safe RPC at `/rpc/*` and REST API at `/api/*` with OpenAPI docs at `/docs`
4. **Google OAuth**: For split domains (frontend + API), set `BETTER_AUTH_URL` to the auth API origin and use Google redirect URI `${BETTER_AUTH_URL}/api/auth/callback/google`
5. **CORS**: Fully configured for cross-port communication during development
6. **Security**: Routes protected client-side via `beforeLoad`, data protected server-side via oRPC auth middleware
7. **Offline auth UX**: BetterAuth uses server-validated cookies, so client routes use cached session fallback for offline hard refreshes after an online login
8. **Production sync URL**: LiveStore sync defaults to `VITE_SYNC_URL || VITE_API_URL || location.origin`, so set `VITE_API_URL` (or `VITE_SYNC_URL`) to your API domain in production

## Code Style Guidelines

- Use TypeScript for all new code
- Prefer functional components with hooks
- Use design system components from `@/components/ui/*` (resolved from `packages/design-system`)
- Follow existing naming conventions (PascalCase for components, camelCase for functions/variables)
- Keep components focused and single-responsibility
- Remove unused imports and dead code before committing
- Use `HugeiconsIcon` component for all icons with appropriate Hugeicons icons
