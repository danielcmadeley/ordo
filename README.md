# LiveStore Auth Example with React, Vite, TanStack Router, Hono, BetterAuth & Cloudflare

This repo contains an example todo app that showcases how to implement authentication in a local-first app using the following technologies:

- **Frontend**: React + Vite + [TanStack Router](https://tanstack.com/router)
- **Backend**: [Hono](https://hono.dev/) on Cloudflare Workers
- **Data layer**: [LiveStore](https://livestore.dev/)
- **Authentication**: [BetterAuth](https://www.better-auth.com/) & [BetterAuth Cloudflare Plugin](https://github.com/zpg6/better-auth-cloudflare)
- **User credential storage**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **Backend syncing**: [Cloudflare Workers](https://developers.cloudflare.com/workers/) & [Durable Objects](https://developers.cloudflare.com/durable-objects/)

After authentication, every user of the app receives their own local instance of a LiveStore DB that they can use locally on their machine, ensuring full isolation as well as offline access. 

## Architecture

This is a monorepo with the following structure:

```
├── apps/
│   ├── web/                    # React + Vite + TanStack Router (frontend)
│   └── api/                    # Hono backend on Cloudflare Workers
├── packages/
│   └── shared/                 # Shared schemas and types
├── drizzle/                    # Database migrations
└── bunfig.toml                 # Bun workspace configuration
```

### Apps

#### `apps/web`
- **Framework**: React 19 + Vite 7
- **Router**: TanStack Router (file-based routing)
- **Styling**: Tailwind CSS 4
- **State**: LiveStore (local-first SQLite)
- **Sync**: WebSocket to Cloudflare Durable Objects
- **Port**: 3000 (dev)

#### `apps/api`
- **Framework**: Hono on Cloudflare Workers
- **Auth**: BetterAuth with D1 database
- **Sync**: LiveStore WebSocket endpoint via Durable Objects
- **Port**: 3001 (dev)

### Shared Packages

#### `packages/shared`
- LiveStore schema (events, tables, state)
- BetterAuth Drizzle schema

## Usage

### 1. Clone repo

```bash
git clone git@github.com:nikolasburk/livestore-tanstack-cloudflare-auth-example.git
cd livestore-tanstack-cloudflare-auth-example
bun install
```

### 2. Set env vars

Rename `.env.example` to `.env` and update the env vars in that file as follows.

#### 2.1. D1 database configuration

Create a [D1 database](https://developers.cloudflare.com/d1/) and set the env vars in `.env` as described [here](https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit). Here are some real-looking sample values:

```bash
# replace these values with your own
CLOUDFLARE_ACCOUNT_ID=6cfd2fa210ebf08b224c0f39248e1c05
CLOUDFLARE_DATABASE_ID=d5b3d994-1a05-43cb-8cd5-b668b73d0d53
CLOUDFLARE_D1_TOKEN=XDPhgV57Tr-zljPhXdsyiuAG4V_gjFq1b8FNiZoJ
```

#### 2.2. Better Auth configuration

Set the `BETTER_AUTH_SECRET` to a value of your choice. You can also generate a secret [here](https://www.better-auth.com/docs/installation#set-environment-variables) by clicking on the **Generate Secret** button. Here are some real-looking sample values:

```bash
# replace these values with your own
BETTER_AUTH_SECRET=i2zaoTAZz0yXjfHlTXIhAxWlERrXoCCn
BETTER_AUTH_URL=http://localhost:3000 # Base URL of your app
```

Also create a `.dev.vars` file in `apps/api/` with:

```bash
BETTER_AUTH_SECRET=your-secret
BETTER_AUTH_URL=http://localhost:3000
```

### 3. Run the app

You can run both apps concurrently:

```bash
bun run dev
```

Or run them separately:

```bash
# Terminal 1: Start the API
bun run dev:api

# Terminal 2: Start the web app
bun run dev:web
```

- Frontend: http://localhost:3000
- API: http://localhost:3001

### 4. Database migrations

Generate and run migrations:

```bash
# Generate migration
bun run db:generate

# Apply migration (to Cloudflare D1)
bun run db:migrate
```

### 5. Test the app

Here are some things you can do to test the app:

1. Sign up with a new user 
1. Open a new browser window -> the same user should be logged in automatically in both windows now
1. Create a todo in one window -> the second window should update instantly and show the same todo
1. Open an incognito window and sign up with a different user
1. Open another incognito window -> the second user should be logged in automatically in both incognito windows now
1. Create a todo in one incognito window -> the second incognito window should update instantly and show the same todo

### 6. Deploy to Cloudflare

To deploy the API to Cloudflare:

```bash
bun run deploy:api
```

The frontend can be deployed to any static hosting service (Vercel, Netlify, Cloudflare Pages, etc.) by running:

```bash
bun run build:web
```

## Available Scripts

```bash
# Run both apps in dev mode
bun run dev

# Run apps separately
bun run dev:web    # Frontend only
bun run dev:api    # API only

# Build
bun run build      # Build all apps
bun run build:web  # Build frontend only
bun run build:api  # Build API only

# Type checking
bun run typecheck  # Check all packages

# Database
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Apply migrations to D1

# Deploy
bun run deploy:api   # Deploy API to Cloudflare
```

## TODOs

### Add auth token exchange to syncing

The auth mechanism currently isn't fully safe:

- Anyone could connect to another user's sync endpoint if they knew/guessed the `storeId` (which is not too difficult)
- No verification that sync operations (`onPush`/`onPull`) are from an authenticated user

The solution will be to add an auth token to the WebSockets that are doing the syncing, something similar to this:

1. Extract the auth token from the WebSocket connection (headers or query params)
1. Verify the token using BetterAuth in the sync handlers
1. Ensure the authenticated user matches the `storeId`/`userId` associated with the sync operation# ordo
