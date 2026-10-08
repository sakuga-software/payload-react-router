import { AsyncLocalStorage } from 'node:async_hooks'
// Namespace import: `unstable_getRequest` only exists in React Router's
// `react-server` build, and a named import would fail to link elsewhere.
import * as ReactRouter from 'react-router'

/**
 * Per-request state shared by every Payload adapter call made while React Router
 * handles one request: loaders, server components, server functions and resource
 * routes.
 *
 * Payload's `ServerAdapter.getHeaders()` / `setCookie()` take no request argument
 * (they were shaped after Next's `headers()` / `cookies()`), so the adapter needs
 * an ambient request. React Router's own `unstable_getRequest()` covers reads, but
 * has no way to add a header to the outgoing response — hence this store, opened
 * by {@link payloadMiddleware} around the whole request.
 */
export type PayloadRequestStore = {
  /** Request-scoped memoization (admin context). Never shared across requests. */
  readonly cache: Map<string, Promise<unknown>>
  readonly request: Request
  /** Serialized `Set-Cookie` values appended to the response by the middleware. */
  readonly setCookies: string[]
}

// Shared through globalThis: Vite can evaluate this module more than once (HMR,
// separate optimizer chunks), and every copy has to see the same store.
const storageKey = Symbol.for('payload-react-router.request-store')
const globalWithStorage = globalThis as {
  [storageKey]?: AsyncLocalStorage<PayloadRequestStore>
}
const storage = (globalWithStorage[storageKey] ??= new AsyncLocalStorage<PayloadRequestStore>())

export function createRequestStore(request: Request): PayloadRequestStore {
  return { cache: new Map(), request, setCookies: [] }
}

export function runWithRequestStore<T>(store: PayloadRequestStore, fn: () => T): T {
  return storage.run(store, fn)
}

/**
 * Returns the current request store. Falls back to React Router's
 * `unstable_getRequest()` when {@link payloadMiddleware} is not installed, in
 * which case reads work but cookies written by Payload are dropped.
 */
export function getRequestStore(): PayloadRequestStore {
  const store = storage.getStore()
  if (store) {
    return store
  }

  let request: Request | undefined
  try {
    request = (ReactRouter as { unstable_getRequest?: () => Request }).unstable_getRequest?.()
  } catch {
    request = undefined
  }
  if (!request) {
    throw new Error(
      'payload-react-router: no request in scope. Add `payloadMiddleware` to the `middleware` export of app/root.tsx.',
    )
  }

  return createRequestStore(request)
}

export function getRequest(): Request {
  return getRequestStore().request
}

/** Memoizes `create()` for the lifetime of the current request. */
export function requestMemo<T>(key: string, create: () => Promise<T>): Promise<T> {
  const { cache } = getRequestStore()
  const cached = cache.get(key)
  if (cached) {
    return cached as Promise<T>
  }
  const promise = create()
  cache.set(key, promise)
  // A failed attempt must not poison later calls in the same request.
  promise.catch(() => cache.delete(key))
  return promise
}
