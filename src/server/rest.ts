import type { SanitizedConfig } from 'payload'

import { handleEndpoints } from 'payload'

import { handleGraphQL } from './graphql.ts'

type ConfigInput = Promise<SanitizedConfig> | SanitizedConfig

/**
 * Routes an `/api/*` request to Payload: `POST {api}{graphQL}` to the GraphQL
 * handler, everything else to the REST endpoint handler. Plain Web `Request` →
 * `Response`; nothing React Router specific.
 */
export async function handleAPIRoute({
  config,
  request,
}: {
  config: ConfigInput
  request: Request
}): Promise<Response> {
  const resolvedConfig = await config
  const apiRoute = resolvedConfig.routes.api
  const { pathname } = new URL(request.url)
  const slug = pathname.startsWith(apiRoute) ? pathname.slice(apiRoute.length) : pathname
  const segments = slug.split('/').filter(Boolean)
  const path = segments.length > 0 ? `${apiRoute}/${segments.join('/')}` : apiRoute

  const graphQLRoute = `${apiRoute}${resolvedConfig.routes.graphQL}`
  if (request.method === 'POST' && path === graphQLRoute) {
    return handleGraphQL({ config: resolvedConfig, request })
  }

  return handleEndpoints({ config: resolvedConfig, path, request })
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
 * React Router calls neither for OPTIONS (CORS preflight), so a route
 * middleware answers it.
 */
export function createAPIRoute({ config }: { config: ConfigInput }) {
  const handle = ({ request }: RouteArgs) => handleAPIRoute({ config, request })

  const answerPreflight = async ({ request }: RouteArgs, next: () => Promise<Response>) => {
    if (request.method !== 'OPTIONS') {
      return next()
    }
    const response = await handle({ request })
    // In RSC mode, a response produced by a resource route's middleware is not
    // tagged as a resource response (react-router 8.4 `generateResourceResponse`
    // only tags handler output), so the HTML renderer would try to decode it as
    // an RSC stream. Tag it here. See NOTES.md, P10.
    const headers = new Headers(response.headers)
    headers.set('React-Router-Resource', 'true')
    return new Response(response.body, { headers, status: response.status, statusText: response.statusText })
  }

  return {
    action: handle,
    loader: handle,
    middleware: [answerPreflight],
  }
}
