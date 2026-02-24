# CLAUDE.md

## Project Overview

A local-first todo app monorepo demonstrating authentication with LiveStore. Uses:
- **Frontend** (`apps/web`): React 19 + Vite 7 + TanStack Router + LiveStore + Tailwind CSS 4 + shadcn/ui
- **Backend** (`apps/api`): Hono on Cloudflare Workers + BetterAuth + Cloudflare D1 + Durable Objects
- **Shared** (`packages/shared`): LiveStore schema + BetterAuth Drizzle schema

## Monorepo Structure

```
apps/
  web/          # @repo/web — frontend, port 3000
  api/          # @repo/api — Cloudflare Workers backend, port 3001
packages/
  shared/       # @repo/shared — shared schemas
drizzle/        # DB migrations
```

## Package Manager

**Always use `bun`** — this project uses bun workspaces (`bun.lock`, `bunfig.toml`). Never use npm or pnpm.

## Common Commands

```bash
# Dev
bun run dev           # Run all apps concurrently
bun run dev:web       # Frontend only (http://localhost:3000)
bun run dev:api       # API only (http://localhost:3001)

# Type checking
bun run typecheck

# Database (Cloudflare D1 via Drizzle)
bun run db:generate   # Generate migrations
bun run db:migrate    # Apply to D1

# Deploy
bun run deploy:api    # Deploy API to Cloudflare Workers
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/routes/__root.tsx` | Root route with auth guard |
| `apps/web/src/routes/login.tsx` | Login/signup page |
| `apps/web/src/lib/authClient.ts` | BetterAuth client + offline session fallback |
| `apps/web/src/lib/session-cache.ts` | Local session cache helpers |
| `apps/web/src/lib/auth-guards.ts` | Shared route guard helpers |
| `apps/web/src/hooks/useCurrentUser.ts` | Shared current-user loading hook |
| `apps/web/src/livestore/livestore.worker.ts` | LiveStore worker + sync URL resolution (`VITE_SYNC_URL` / `VITE_API_URL`) |
| `apps/api/src/index.ts` | Hono app entry + route registration |
| `apps/api/src/auth/index.ts` | BetterAuth server config |
| `apps/api/src/sync/client-ws.ts` | LiveStore WebSocket sync via Durable Objects |
| `apps/api/src/orpc/router.ts` | oRPC router |
| `packages/shared/src/livestore-schema.ts` | LiveStore events/tables/state |
| `packages/shared/src/auth-schema.ts` | Drizzle schema for BetterAuth |
| `apps/api/wrangler.jsonc` | Cloudflare Workers config |

## Architecture Notes

- Each authenticated user gets their own LiveStore DB instance (full isolation + offline support)
- Sync happens over WebSockets to Cloudflare Durable Objects
- Auth is handled by BetterAuth with credentials stored in Cloudflare D1
- BetterAuth cookie cache is enabled server-side (`session.cookieCache`) to reduce frequent DB reads
- Client auth checks use cached session fallback for offline route loading after an online sign-in
- The shared package exports via path aliases: `@repo/shared/livestore-schema` and `@repo/shared/auth-schema`
- TanStack Router uses file-based routing under `apps/web/src/routes/`

## Environment Setup

Root `.env` (for Drizzle migrations):
```
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_DATABASE_ID=...
CLOUDFLARE_D1_TOKEN=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000  # Local: frontend origin; Production: auth API origin
```

`apps/api/.dev.vars` (for local Wrangler dev):
```
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000  # Use :4173 when running `vite preview`
```

`apps/web/.env.production`:
```
VITE_API_URL=https://api.<your-domain>
# optional override if sync runs on a different host
VITE_SYNC_URL=https://api.<your-domain>
```

## Known TODOs

- Auth token not verified on WebSocket sync connections — any user who knows a `storeId` can connect to another user's sync endpoint. Fix: pass auth token in WS headers/query params and verify in `onPush`/`onPull` handlers.
