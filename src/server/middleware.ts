import type { MiddlewareFunction } from 'react-router'

import { createRequestStore, runWithRequestStore } from './requestStore.ts'

/**
 * Root route middleware. Opens the request store Payload's server adapter reads
 * headers from, and copies cookies Payload set during the request (e.g. the
 * `switch-language` server function) onto the response.
 *
 * Register it once in `app/root.tsx`:
 *
 * ```ts
 * export const middleware = [payloadMiddleware]
 * ```
 *
 * It runs for documents, RSC data requests, server functions and resource
 * routes alike, because all of them go through the root route's middleware.
 */
export const payloadMiddleware: MiddlewareFunction<Response> = ({ request }, next) => {
  const store = createRequestStore(request)

  return runWithRequestStore(store, async () => {
    const response = await next()

    if (store.setCookies.length === 0) {
      return response
    }

    // Response headers can be immutable (e.g. a `fetch` response), so rebuild.
    const headers = new Headers(response.headers)
    for (const cookie of store.setCookies) {
      headers.append('Set-Cookie', cookie)
    }

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    })
  })
}
