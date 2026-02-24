# Deployment Plan

## Overview

Two things to deploy:
1. **API** → Cloudflare Workers (`apps/api`)
2. **Frontend** → Cloudflare Pages (`apps/web`) with Vite PWA

The API must be deployed **before** the frontend so you have the production API URL to configure.

**Note on PWA Deployment**: Vite PWA generates static files (HTML, CSS, JS, manifest, service worker) that can be deployed to any static host. We recommend **Cloudflare Pages** for seamless integration with your Cloudflare Workers backend.

---

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authenticated (`wrangler login`)
- A Cloudflare account with Workers, D1, and Durable Objects access
- A D1 database created (see step 1 below)
- Root `.env` configured (for Drizzle migrations)
- `apps/api/.dev.vars` configured (for local dev only — not used in production)
- Recommended domain setup: frontend and API on the same registrable domain (e.g. `app.your-domain.com` + `api.your-domain.com`) for reliable OAuth cookie behavior

---

## Step 0 — Setup Vite PWA (First Time Only)

### Install Vite PWA Plugin

```bash
cd apps/web
bun add -D vite-plugin-pwa
```

### Configure vite.config.ts

Update `apps/web/vite.config.ts` to include the PWA plugin:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    viteTsConfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg'],
      manifest: {
        name: 'Ordo - Task Management',
        short_name: 'Ordo',
        description: 'Your personal task management app',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  // ... rest of config
})
```

### Add PWA Icons

Place icon files in `apps/web/public/`:
- `favicon.svg` - Browser favicon
- `apple-touch-icon.svg` - iOS home screen icon

Generate icons using tools like:
- [PWA Asset Generator](https://pwa-asset-generator.nicepkg.cn/)
- [Favicon.io](https://favicon.io/)

---

## Step 1 — Create / Confirm Cloudflare D1 Database

If you haven't created the D1 database yet:

```bash
wrangler d1 create react-vite-tanstack-router
```

Copy the `database_id` from the output and make sure it matches in `apps/api/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "auth_db",
    "database_name": "react-vite-tanstack-router",
    "database_id": "<your-database-id>"
  }
]
```

---

## Step 2 — Run Database Migrations

Apply the Drizzle migrations to Cloudflare D1 (requires root `.env` with D1 credentials):

```bash
bun run db:generate   # only if schema has changed
bun run db:migrate
```

---

## Step 3 — Set Production Secrets on Cloudflare Workers

These are set via Wrangler — do **not** put secrets in `wrangler.jsonc`:

```bash
cd apps/api

wrangler secret put BETTER_AUTH_SECRET
# paste your secret when prompted

wrangler secret put BETTER_AUTH_URL
# paste your production auth API URL e.g. https://api.your-domain.com
```

Optional (only if Google OAuth is enabled):

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

---

## Step 4 — Update Hardcoded CORS / Trusted Origins

Before deploying the API, update the hardcoded localhost origins to include your production URLs.

### `apps/api/src/index.ts` — CORS middleware

```ts
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:4173',
    'http://localhost:5173',
    'https://app.your-domain.com',
  ],
  ...
}))
```

### `apps/api/src/auth/index.ts` — BetterAuth trusted origins

```ts
trustedOrigins: [
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://localhost:3001",
  "https://app.your-domain.com",
  env?.BETTER_AUTH_URL || "",
].filter(Boolean),
```

### `apps/api/src/auth/index.ts` — BetterAuth session cookie cache

Keep `session.cookieCache` enabled for fewer DB lookups during normal auth checks:

```ts
session: {
  cookieCache: {
    enabled: true,
    maxAge: 60 * 60,
  },
},
```

---

## Step 5 — Deploy the API

```bash
cd apps/api
wrangler deploy --keep-vars
# or: cd apps/api && wrangler deploy
```

This single command:
- Bundles and deploys the Hono Worker
- Creates/migrates the `SyncBackendDO` Durable Object class (`v1` migration tag)
- Binds D1 and the Durable Object namespace

Note the deployed Worker URL (e.g. `https://livestore-todo-auth-api.<your-subdomain>.workers.dev`).

---

## Step 6 — Build & Deploy the Frontend (PWA)

### 6a. Configure Production API URL

Update `apps/web/src/lib/authClient.ts` to use the production API URL:

```typescript
const apiUrl = import.meta.env.VITE_API_URL || window.location.origin

const authClient = createAuthClient({
  baseURL: apiUrl,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [cloudflareClient()],
});
```

Create `apps/web/.env.production`:
```
VITE_API_URL=https://api.your-domain.com
# optional if sync uses a different host
VITE_SYNC_URL=https://api.your-domain.com
```

### 6b. Build with PWA

```bash
cd apps/web
bun run build
```

This generates:
- Standard Vite build output in `dist/`
- `manifest.webmanifest` - PWA app metadata
- `sw.js` - Service worker for offline support
- Icon assets and other PWA files

**Verify PWA assets**:
```bash
ls dist/
# Should see: index.html, assets/, manifest.webmanifest, sw.js, icons/
```

### 6c. Deploy to Cloudflare Pages

**Option A: Wrangler CLI**

```bash
wrangler pages deploy apps/web/dist --project-name livestore-todo-auth
```

**Option B: Git Integration (Recommended)**

Connect your repo to Cloudflare Pages in the dashboard:

1. Go to Cloudflare Dashboard → Pages
2. "Create a project" → Connect to Git
3. Select your repository
4. Configure build settings:
   - **Build command**: `cd apps/web && bun run build`
   - **Build output directory**: `apps/web/dist`
   - **Root directory**: `/` (repository root)
5. Add environment variables in dashboard:
   - `VITE_API_URL`: `https://your-worker-url.workers.dev`
6. Deploy

**Why Cloudflare Pages for PWA?**
- Same ecosystem as your Workers backend
- Automatic HTTPS (required for PWA)
- Service workers work perfectly
- Preview deployments for PRs
- Global CDN for fast icon/asset loading
- Custom domains with SSL

### Alternative Static Hosts

While we recommend Cloudflare Pages, Vite PWA works on any static host:

**Vercel:**
```bash
cd apps/web
vercel --prod
```

**Netlify:**
```bash
cd apps/web
netlify deploy --dir=dist --prod
```

---

## Step 7 — Update `BETTER_AUTH_URL` Secret

Once you have the final API custom domain, update the secret on the Worker:

```bash
cd apps/api
wrangler secret put BETTER_AUTH_URL
# enter: https://api.your-domain.com
```

Then redeploy:

```bash
bun run deploy:api
```

If Google OAuth is enabled, also update your Google OAuth client config:

- Authorized JavaScript origin: `https://app.your-domain.com`
- Authorized redirect URI: `https://api.your-domain.com/api/auth/callback/google`

---

## Step 8 — Verify PWA Installation

### Check PWA is Installable

1. Visit the production URL in Chrome/Edge
2. Open DevTools → Application → Manifest
3. Verify manifest is detected with no errors
4. Check "Icons" section shows your icons
5. Look for install prompt in address bar (on mobile or desktop)

### Test Offline Functionality

1. Install the PWA (via browser prompt or "Install" in menu)
2. Sign in while online at least once (primes BetterAuth cookie cache + local session fallback)
3. Create some todos while online
4. Disconnect internet
5. Refresh the app - it should still work!
6. Reconnect - changes should sync via LiveStore

### Test Service Worker

```bash
# In DevTools Console
navigator.serviceWorker.ready.then(reg => console.log('SW active:', reg))

# Check cache
navigator.serviceWorker.ready.then(reg => {
  caches.keys().then(names => console.log('Caches:', names))
})
```

---

## Step 9 — Smoke Test

1. Visit the production frontend URL
2. Install the PWA on your device (mobile/desktop)
3. Sign up with a new user
4. Open a second tab — session should persist
5. Create a todo — it should appear in both tabs instantly (LiveStore sync)
6. **Go offline** — app should still work (PWA + LiveStore + cached auth session)
7. Reconnect — changes should sync
8. Open an incognito window, sign up as a different user — todos should be isolated

---

## Known Issues / TODOs Before Production

### Auth token not verified on WebSocket sync

Anyone who knows/guesses a `storeId` can connect to another user's sync endpoint. This needs to be fixed before a real production deployment:

1. Extract the auth token from the incoming WebSocket request (header or query param)
2. Verify the token using BetterAuth inside the Durable Object sync handlers
3. Enforce that the authenticated user matches the `storeId`

See `apps/api/src/sync/client-ws.ts` and the TODO in `README.md`.

---

## PWA-Specific Considerations

### Update Strategy

Vite PWA uses `registerType: 'autoUpdate'` which:
- Automatically updates the service worker in the background
- Shows update prompt to user when new version available
- User can dismiss and continue using current version

To force immediate updates, set `registerType: 'prompt'` in vite.config.ts

### Icon Requirements

For best PWA experience:
- **192x192**: Required for install prompt
- **512x512**: Required for splash screens
- **Maskable icons**: For adaptive icons on Android
- Use [Maskable.app](https://maskable.app/) to generate maskable versions

### iOS Specific

iOS Safari has limited PWA support:
- Service workers work (iOS 11.3+)
- Add to Home Screen works
- No install prompt (user must manually add)
- Background sync limited

---

## Environment Variable Reference

| Variable | Where | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | root `.env` | For Drizzle D1 migrations |
| `CLOUDFLARE_DATABASE_ID` | root `.env` | For Drizzle D1 migrations |
| `CLOUDFLARE_D1_TOKEN` | root `.env` | For Drizzle D1 migrations |
| `VITE_API_URL` | `apps/web/.env.production` | Production API URL for frontend |
| `VITE_SYNC_URL` | `apps/web/.env.production` | (optional) Production sync URL override |
| `BETTER_AUTH_SECRET` | Wrangler secret | Auth signing secret |
| `BETTER_AUTH_URL` | Wrangler secret | Production auth API base URL |
| `GOOGLE_CLIENT_ID` | Wrangler secret | (optional) Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Wrangler secret | (optional) Google OAuth |
