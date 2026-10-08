# payload-react-router

Mounts the [Payload](https://payloadcms.com) admin panel, REST API and GraphQL API inside a
**React Router 8** app. It implements Payload's framework-adapter contracts (server, router,
view and layout adapters, server functions); `@payloadcms/ui` is used unmodified.

> **Status: experimental.** It runs on React Router's **RSC Framework Mode**, which React
> Router itself ships as `unstable_` ("subject to breaking changes in minor/patch releases").
> Payload's admin is built from React Server Components, so RSC is required, not optional —
> see [Why RSC](#why-rsc). Versions are pinned for that reason.

| Tested with | Version |
| --- | --- |
| `payload`, `@payloadcms/*` | `4.0.0-canary.39` |
| `react-router`, `@react-router/dev`, `@react-router/serve` | `8.4.0` |
| `@vitejs/plugin-rsc` | `0.5.35` (0.5.26 fails the build; 0.5.36 trips a React Router build invariant) |
| `react`, `react-dom`, `react-server-dom-webpack` | `19.3.0` |
| Vite | `8.x` |
| Node.js | `>= 24.15` (Payload 4) |

The adapter is exercised by a demo app: SQLite, Lexical, drafts + autosave, uploads, two
locales, a global, and a website that reads content through the Local API. A 26-test Playwright
bench runs on that app against both the production build and `vite dev`, with the adapter
installed from the packed tarball. The demo app is in a private repository for now; the
scenarios and results are in [`docs/COMPAT.md`](./docs/COMPAT.md).

## Adding Payload to a React Router app

### 1. Dependencies

```bash
pnpm add payload @payloadcms/ui @payloadcms/translations @payloadcms/graphql graphql \
  @payloadcms/db-sqlite @payloadcms/richtext-lexical payload-react-router \
  react@19.3.0 react-dom@19.3.0 react-server-dom-webpack@19.3.0 \
  react-router@8.4.0 @react-router/serve@8.4.0
pnpm add -D @react-router/dev@8.4.0 @vitejs/plugin-rsc@0.5.35 vite sass-embedded
```

### 2. Switch the app to RSC Framework Mode

```ts
// vite.config.ts
import { unstable_reactRouterRSC as reactRouterRSC } from '@react-router/dev/vite'
import rsc from '@vitejs/plugin-rsc'
import { payload } from 'payload-react-router/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [payload({ payloadConfigPath: './payload.config.ts' }), reactRouterRSC(), rsc()],
})
```

`react-router.config.ts` needs nothing special (`ssr: true`, the default). React Router's RSC
mode does not support `splitRouteModules`, `serverBundles`, `presets` or `buildEnd`.

Existing routes keep working: a route with a `default` export is a client component, as
before; a route can opt into a server component by exporting `ServerComponent` instead. The
`.server.ts` file convention is not enforced in RSC mode — use the `server-only` package if
you rely on it.

The `payload()` plugin adds the `@payload-config` alias, SCSS importers, SSR externals,
dependency-optimizer lists and a handful of Vite-level workarounds Payload needs (ported from
`@payloadcms/tanstack-start`).

### 3. Payload config

```ts
// payload.config.ts
export default buildConfig({
  admin: {
    importMap: {
      baseDir: import.meta.dirname,
      // The Payload CLI only knows the Next.js and TanStack Start folder layouts.
      importMapFile: path.resolve(import.meta.dirname, 'app/routes/payload/importMap.js'),
    },
  },
  // In production this file is bundled into build/server/: anchor runtime paths
  // (SQLite file, upload staticDir) on process.cwd(), not import.meta.dirname.
  db: sqliteAdapter({ client: { url: `file:${path.resolve(process.cwd(), 'payload.db')}` } }),
  // ...
})
```

Generate the import map whenever admin components change:

```bash
PAYLOAD_CONFIG_PATH=./payload.config.ts pnpm payload generate:importmap
```

and add `app/routes/payload/importMap.d.ts`:

```ts
import type { ImportMap } from 'payload'
export declare const importMap: ImportMap
```

### 4. Routes

```ts
// app/routes.ts
import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  layout('routes/site/layout.tsx', [index('routes/site/home.tsx') /* your site */]),
  layout('routes/payload/layout.tsx', { id: 'payload' }, [route('admin/*', 'routes/payload/admin.tsx')]),
  route('api/*', 'routes/payload/api.ts'),
] satisfies RouteConfig
```

The admin renders its own `<html>` (theme, language and direction attributes), so the root
route must not. Let each layout route own its document:

```tsx
// app/root.tsx
import { Outlet } from 'react-router'
import { payloadMiddleware } from 'payload-react-router/server'

export const middleware = [payloadMiddleware]

export function ServerComponent() {
  return <Outlet />
}
```

`payloadMiddleware` must be on the root route: it scopes every request (documents, data
requests, server functions, resource routes) so Payload can read headers and set cookies.

```tsx
// app/routes/payload/server-functions.ts
'use server'
import type { ServerFunctionClientArgs } from 'payload'
import config from '@payload-config'
import { handleServerFunctions } from 'payload-react-router/server'
import { importMap } from './importMap.js'

export async function serverFunction(args: ServerFunctionClientArgs, _revalidation?: FormData) {
  return handleServerFunctions({ ...args, config, importMap })
}
```

```tsx
// app/routes/payload/layout.tsx — the admin document and providers
import config from '@payload-config'
import '@payloadcms/ui/css/app.css'
import { PayloadAdminLayout } from 'payload-react-router/server'
import { Outlet } from 'react-router'
import { importMap } from './importMap.js'
import { serverFunction } from './server-functions'

export function ServerComponent() {
  return (
    <PayloadAdminLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      <Outlet />
    </PayloadAdminLayout>
  )
}
```

```tsx
// app/routes/payload/admin.tsx — /admin and every admin view
import config from '@payload-config'
import { AdminPage, loadAdminPage } from 'payload-react-router/server'
import type { Route } from './+types/admin'
import { importMap } from './importMap.js'

export const loader = ({ params, request }: Route.LoaderArgs) =>
  loadAdminPage({ config, importMap, request, splat: params['*'] })

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  return <AdminPage {...loaderData} />
}
```

```ts
// app/routes/payload/api.ts — REST + GraphQL
import config from '@payload-config'
import { createAPIRoute } from 'payload-react-router/server'

export const { action, loader, middleware } = createAPIRoute({ config })
```

### 5. Reading content from the site (Local API)

```tsx
// app/routes/site/home.tsx
import config from '@payload-config'
import { getPayload } from 'payload'

export async function loader() {
  const payload = await getPayload({ config })
  const posts = await payload.find({ collection: 'posts', overrideAccess: false })
  return { posts: posts.docs }
}
```

Same process, no HTTP hop, no token. Pass `overrideAccess: false` so collection access control
decides what anonymous visitors see.

### 6. Production

```bash
pnpm react-router build
pnpm react-router-serve ./build/server/index.js
```

The schema is pushed automatically in development only. For production, create migrations
(`payload migrate:create`) and pass them as `prodMigrations` to the database adapter, or run
`payload migrate` before starting.

## API

`payload-react-router/vite`

- `payload({ payloadConfigPath, devServerExternalPackages?, silenceDependencyWarnings? })`

`payload-react-router/server`

- `payloadMiddleware` — root route middleware (request scope + `Set-Cookie`).
- `PayloadAdminLayout` — admin document + providers (server component).
- `loadAdminPage({ config, importMap, request, splat })` / `AdminPage` — admin views.
- `handleServerFunctions` — Payload's server-function dispatcher.
- `createAPIRoute({ config })` / `handleAPIRoute({ config, request })` — REST + GraphQL.
- `login` / `logout` / `refresh` — Payload auth functions bound to this adapter.
- `reactRouterServerAdapter`, `createPageRenderServerAdapter`, `initAdminContext`,
  `getRequestI18n`, `getRequest`, `serializeCookie` — lower-level pieces.

`payload-react-router/client`

- `ReactRouterAdapter` — Payload's router contract on React Router hooks.
- `PayloadRootProviders` — `RootProviders` bound to the router adapter.

## How it maps to Payload's contracts

| Contract | Implementation |
| --- | --- |
| `ServerAdapter` | Per-request `AsyncLocalStorage` opened by `payloadMiddleware`. Headers/cookies come from the `Request`; `setCookie` is appended to the response. `redirect`/`notFound`/`forbidden`/`unauthorized`/`permanentRedirect` throw React Router responses with real 302/404/403/401/308 statuses. |
| View adapter | `loadAdminPage` calls `renderRoot` in the route loader and renders the tree to completion, so a `redirect()`/`notFound()` raised deep inside a view still becomes a real redirect or a 404 page. |
| Layout adapter | `PayloadAdminLayout` (server component) renders `DocumentRoot` and providers. |
| Router adapter | `useNavigate` / `navigate(-1)` / `useRevalidator().revalidate()` / `Link`; `replaceState` uses the History API, which React Router does not observe. |
| Server functions | A real `'use server'` function: results, including React nodes, travel over Flight as with Next.js. Calls opt out of React Router's automatic revalidation (`$SKIP_REVALIDATION`); Payload refreshes explicitly. |
| REST / GraphQL | Resource route → `handleEndpoints`; `POST /api/graphql` → GraphQL handler; `OPTIONS` answered by a route middleware. |

The full contract-by-contract comparison with `@payloadcms/next` and
`@payloadcms/tanstack-start`, and every issue found in the contracts, are in
[`docs/NOTES.md`](./docs/NOTES.md) (in French). Test coverage is in
[`docs/COMPAT.md`](./docs/COMPAT.md).

## Why RSC

Payload's admin views (`renderRoot`), its root layout and its server functions are React
Server Components: they are async, run server-only code, and return React elements to the
client (a rendered document, a list, form fields with custom server components). Without an
RSC runtime they cannot render — `@payloadcms/tanstack-start` enables RSC for the same reason.
A plain "SSR + loaders" React Router app cannot host the admin without changing
`@payloadcms/ui`.

## Known limitations

- React Router RSC mode is `unstable_`; pin versions and re-run the bench on upgrades.
- Mounting the admin at `/` (Payload's `admin-root` setup) is untested; TanStack skips it too.
- The Payload CLI does not detect React Router: use `importMapFile` and `PAYLOAD_CONFIG_PATH`.
- Each admin page is rendered to completion on the server before streaming starts (needed
  to turn in-view redirects into real redirects; TanStack does the same).
- Live preview and cloud storage adapters are not covered by the bench yet.
