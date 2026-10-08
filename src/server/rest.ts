import type { SanitizedConfig } from 'payload'

import { handleEndpoints } from 'payload'

type ConfigInput = Promise<SanitizedConfig> | SanitizedConfig

/**
 * Routes an `/api/*` request to Payload's REST / GraphQL endpoint handler.
 * Plain Web `Request` → `Response`; nothing React Router specific.
 */
export async function handleAPIRoute({
  apiRoute = '/api',
  config,
  request,
}: {
  /** Mount point of the API, `config.routes.api`. Defaults to `/api`. */
  apiRoute?: string
  config: ConfigInput
  request: Request
}): Promise<Response> {
  const { pathname } = new URL(request.url)
  const slug = pathname.startsWith(apiRoute) ? pathname.slice(apiRoute.length) : pathname
  const segments = slug.split('/').filter(Boolean)
  const path = segments.length > 0 ? `${apiRoute}/${segments.join('/')}` : apiRoute

  return handleEndpoints({ config: await config, path, request })
}

type RouteArgs = { request: Request }

/**
 * Builds the exports of the `/api/*` resource route:
 *
 * ```ts
 * // app/routes/payload/api.ts
 * export const { action, loader, middleware } = createAPIRoute({ config })
 * ```
 *
 * `loader` answers GET; `action` answers POST / PUT / PATCH / DELETE.
 * React Router never calls a route handler for OPTIONS (CORS preflight) or
 * HEAD-only edge cases, so a route middleware answers those before routing.
 */
export function createAPIRoute({ apiRoute, config }: { apiRoute?: string; config: ConfigInput }) {
  const handle = ({ request }: RouteArgs) => handleAPIRoute({ apiRoute, config, request })

  const answerPreflight = ({ request }: RouteArgs, next: () => Promise<Response>) =>
    request.method === 'OPTIONS' ? handle({ request }) : next()

  return {
    action: handle,
    loader: handle,
    middleware: [answerPreflight],
  }
}
