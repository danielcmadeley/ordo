# CLAUDE.md

## Project Overview

A local-first todo app monorepo demonstrating authentication with LiveStore. Uses:
- **Frontend** (`apps/web`): React 19 + Vite 7 + TanStack Router + LiveStore + Tailwind CSS 4 + shadcn/ui
- **Marketing** (`apps/marketing`): Astro 5 + React islands + Tailwind CSS 4 + shadcn/ui
- **Backend** (`apps/api`): Hono on Cloudflare Workers + BetterAuth + Cloudflare D1 + Durable Objects
- **Shared** (`packages/shared`): LiveStore schema + BetterAuth Drizzle schema
- **Design System** (`packages/design-system`): shared shadcn/ui components, theme provider, and tokens used by both web + marketing

## Monorepo Structure

```
apps/
  web/          # @ordo/web — frontend, port 3000
  marketing/    # marketing site (Astro + React islands)
  api/          # @ordo/api — Cloudflare Workers backend, port 3001
packages/
  shared/       # @ordo/shared — shared schemas
  design-system/ # @ordo/design-system — shared UI + styles + theme infra
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
| `apps/web/src/routes/settings.tsx` | Settings page (appearance, activity, connected accounts) |
| `apps/marketing/src/pages/index.astro` | Marketing landing page entry |
| `apps/marketing/src/components/marketing/MarketingPage.tsx` | Marketing page content + theme toggle |
| `apps/web/src/lib/authClient.ts` | BetterAuth client + offline session fallback |
| `apps/web/src/lib/app-chrome-context.tsx` | Route-to-layout slots for global top-right and bottom-center nav content |
| `apps/web/src/lib/session-cache.ts` | Local session cache helpers |
| `apps/web/src/lib/auth-guards.ts` | Shared route guard helpers |
| `apps/web/src/hooks/useCurrentUser.ts` | Shared current-user loading hook |
| `packages/design-system/src/ui/*` | Shared shadcn/ui primitives consumed by web + marketing |
| `packages/design-system/src/styles.css` | Shared design tokens and base theme |
| `packages/design-system/src/theme-provider.tsx` | Shared next-themes provider |
| `apps/web/src/livestore/livestore.worker.ts` | LiveStore worker + sync URL resolution (`VITE_SYNC_URL` / `VITE_API_URL`) |
| `apps/api/src/index.ts` | Hono app entry + route registration |
| `apps/api/src/auth/index.ts` | BetterAuth server config |
| `apps/api/src/accounts/routes.ts` | Connected account status endpoint (`/api/accounts/status`) |
| `apps/api/src/x/routes.ts` | X OAuth + CRM integration routes |
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
- The shared package exports via path aliases: `@ordo/shared/livestore-schema` and `@ordo/shared/auth-schema`
- Design system exports via `@ordo/design-system/*` and app aliases map `@/components/ui/*`, `@/lib/utils`, and `@/components/theme-provider` to shared package files
- TanStack Router uses file-based routing under `apps/web/src/routes/`
- App chrome slots are managed through `AppChromeProvider` (`apps/web/src/lib/app-chrome-context.tsx`), letting routes publish global header/footer metadata without wiring route state through URL params.

## Knowledge Base UX Notes

- Route: `apps/web/src/routes/knowledge-base.tsx`
- Main split (notebooks/notes vs editor) is resizable via shared design-system primitive `@/components/ui/resizable`.
- Note title is edited inside the editor content area (document-style), not in a separate top input row.
- Save state badge (`Saved`, `Saving...`, `Unsaved`) is rendered in the global top nav via app chrome slot content.
- Word count + last edited metadata is rendered in the global desktop bottom nav; on mobile, it falls back to the global top nav.
- Editor body uses `SimpleEditor` in borderless mode with placeholder text: `Start writing your note...`.

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
X_CLIENT_ID=...                         # X OAuth 2.0 Client ID (not API Key)
X_CLIENT_SECRET=...                     # X OAuth 2.0 Client Secret
X_REDIRECT_URI=http://localhost:3000/api/x/callback
X_SCOPES=tweet.read tweet.write users.read bookmark.read offline.access
```

### X OAuth Notes (CRM)

- Per-user X connections are implemented via API routes under `/api/x/*`.
- OAuth `returnTo` supports full allowed app URLs (for example `/crm` and `/settings`) and callback status is returned via `x`, `x_reason`, and `x_http_status`.
- Use OAuth 2.0 Client ID/Secret from X “User authentication settings”; do not use API Key/Secret for this flow.
- For local dev, prefer `X_REDIRECT_URI=http://localhost:3000/api/x/callback` so callback stays on web origin and is proxied to API.
- X app settings should include callback URLs for both local and prod:
  - `http://localhost:3000/api/x/callback`
  - `https://api.getordo.co/api/x/callback` (prod)

### Connected Accounts (Settings)

- The settings page includes a Connected Accounts section for Google and X.
- Status is loaded from `GET /api/accounts/status`.
- `googleConnected` is sourced from BetterAuth `accounts` (`provider_id = 'google'`).
- `xConnected`, `xUsername`, and `xProfilePending` are sourced from `x_accounts`.

### D1 Migration Notes

- `bun run db:migrate` uses Drizzle with `d1-http` and applies to the D1 configured in root `.env` (remote), not local SQLite.
- To test migrations locally, use Wrangler local D1 migrations:

```bash
bunx wrangler d1 migrations apply react-vite-tanstack-router --local --config apps/api/wrangler.jsonc
```

### Secret Hygiene

- Never commit secrets or post raw credentials in issues/chat.
- If a secret is exposed, rotate it immediately (BetterAuth, Google OAuth, X OAuth).

`apps/web/.env.production`:
```
VITE_API_URL=https://api.<your-domain>
# optional override if sync runs on a different host
VITE_SYNC_URL=https://api.<your-domain>
```

## Known TODOs

- Auth token not verified on WebSocket sync connections — any user who knows a `storeId` can connect to another user's sync endpoint. Fix: pass auth token in WS headers/query params and verify in `onPush`/`onPull` handlers.
