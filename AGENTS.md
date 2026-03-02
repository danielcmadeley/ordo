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
├── examples/          # Reference-only example projects (NOT part of Ordo)
└── bunfig.toml        # Bun workspace configuration
```

## Examples Directory

The `examples/` directory contains **reference-only** example projects (e.g. `examples/gocardless`). These exist purely as context and inspiration for building Ordo. **Do not** import, reference, or use any code from `examples/` in the Ordo application. They are not part of any bun workspace and should never be treated as Ordo source code.

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
X_CLIENT_ID=            # X OAuth 2.0 Client ID (not API Key)
X_CLIENT_SECRET=        # X OAuth 2.0 Client Secret
X_REDIRECT_URI=http://localhost:3000/api/x/callback
X_SCOPES=tweet.read tweet.write users.read bookmark.read offline.access
GOCARDLESS_SECRET_ID=   # GoCardless API secret ID
GOCARDLESS_SECRET_KEY=  # GoCardless API secret key
GOCARDLESS_BASE_URL=https://bankaccountdata.gocardless.com/api/v2
```

### X OAuth (CRM) Notes

- X integration is per-user and implemented server-side under `/api/x/*`.
- X OAuth `returnTo` supports full allowed app URLs (for example `/crm` or `/settings`) and callback status is returned via `x`, `x_reason`, and `x_http_status` query params.
- Use OAuth 2.0 Client ID/Secret from X User Auth settings. Do not use API Key/Secret for OAuth 2.0 auth code flow.
- For local development, use callback `http://localhost:3000/api/x/callback` so the callback lands on web origin and is proxied to API.
- Keep both callbacks configured in X app settings:
  - `http://localhost:3000/api/x/callback` (dev)
  - `https://api.getordo.co/api/x/callback` (prod)

### D1 Migration Notes

- `bun run db:migrate` applies via Drizzle `d1-http` to the D1 configured in root `.env` (remote target).
- For local D1 migration testing, use:

```bash
bunx wrangler d1 migrations apply react-vite-tanstack-router --local --config apps/api/wrangler.jsonc
```

### Secret Hygiene

- Never commit or share plaintext secrets in chat/PRs.
- Rotate any exposed credentials immediately.

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
- **`/crm`** - X CRM workspace (protected)
- **`/finance`** - Bank connection + balances + transactions via GoCardless (protected)
- **`/settings`** - User settings (protected)
- **`/login`** - Authentication page (public only)

All routes except `/login` are protected using TanStack Router's `beforeLoad`.

## App Chrome Slots (Web)

- Use `apps/web/src/lib/app-chrome-context.tsx` to publish route-specific UI into global app chrome.
- `topRightContent` renders in the global top header (`apps/web/src/routes/__root.tsx`).
- `bottomCenterContent` renders in the global desktop footer (`apps/web/src/routes/__root.tsx`).
- Prefer this pattern for route status/meta (save state, counts, timestamps) instead of duplicating local pseudo-nav bars inside route content.
- Always clear slot content on route unmount to avoid stale UI leaking into other routes.

## Knowledge Base Conventions

- Keep `apps/web/src/routes/knowledge-base.tsx` layout split resizable using `@/components/ui/resizable`.
- Keep note title editable inside the editor section (document-style heading), not as a separate top input bar.
- Keep save-state indicator in global top nav and note metadata (word count + last edited) in global bottom nav (desktop), with mobile fallback to top nav.
- Keep editor placeholder text: `Start writing your note...`.

## Key Architecture Points

1. **LiveStore per-user**: Store ID includes user ID (`livestore-todo-app-v3-user-{userId}`), ensuring data isolation
2. **Auth flow**: BetterAuth handles auth at `/api/auth/*`, cookies work across ports due to CORS config
3. **oRPC integration**: Type-safe RPC at `/rpc/*` and REST API at `/api/*` with OpenAPI docs at `/docs`
4. **Google OAuth**: For split domains (frontend + API), set `BETTER_AUTH_URL` to the auth API origin and use Google redirect URI `${BETTER_AUTH_URL}/api/auth/callback/google`
5. **CORS**: Fully configured for cross-port communication during development
6. **Security**: Routes protected client-side via `beforeLoad`, data protected server-side via oRPC auth middleware
7. **Offline auth UX**: BetterAuth uses server-validated cookies, so client routes use cached session fallback for offline hard refreshes after an online login
8. **Production sync URL**: LiveStore sync defaults to `VITE_SYNC_URL || VITE_API_URL || location.origin`, so set `VITE_API_URL` (or `VITE_SYNC_URL`) to your API domain in production

## Connected Accounts (Settings)

- Settings now includes a **Connected Accounts** section for Google + X + GoCardless.
- Connection status is served by `GET /api/accounts/status`.
- `googleConnected` is derived from BetterAuth `accounts` (`provider_id = 'google'`).
- `xConnected`, `xUsername`, and `xProfilePending` are derived from `x_accounts`.
- `gocardlessConnected` and `gocardlessInstitution` are derived from `gocardless_requisitions`.

## GoCardless / Finance

- GoCardless uses **app-level API credentials** (secret_id + secret_key → JWT), not per-user OAuth.
- Per-user bank connections use **requisitions** stored in `gocardless_requisitions` D1 table.
- Data endpoints (institutions, accounts, balances, transactions, details, disconnect) are oRPC routes in `apps/api/src/orpc/router.ts`.
- Bank connect/callback redirect flows are raw Hono routes in `apps/api/src/gocardless/routes.ts`.
- Account data caching uses KV with TTLs: details=24h, balances=15min, transactions=30min.
- Finance page UI is at `apps/web/src/routes/finance.tsx`.

## Code Style Guidelines

- Use TypeScript for all new code
- Prefer functional components with hooks
- Use design system components from `@/components/ui/*` (resolved from `packages/design-system`)
- Follow existing naming conventions (PascalCase for components, camelCase for functions/variables)
- Keep components focused and single-responsibility
- Remove unused imports and dead code before committing
- Use `HugeiconsIcon` component for all icons with appropriate Hugeicons icons
