import type { CookieOptions, CookieStore, ServerAdapter } from 'payload'

import { parseCookies } from 'payload'
import { redirect } from 'react-router'

import { getRequest, getRequestStore } from './requestStore.ts'

function buildCookieStore(headers: Headers): CookieStore {
  const cookies = parseCookies(headers)

  return {
    get: (name) => {
      const value = cookies.get(name)
      return value !== undefined ? { name, value } : undefined
    },
    getAll: () => Array.from(cookies.entries()).map(([name, value]) => ({ name, value })),
  }
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  if (options.path) {
    cookie += `; Path=${options.path}`
  }
  if (options.domain) {
    cookie += `; Domain=${options.domain}`
  }
  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`
  }
  if (options.httpOnly) {
    cookie += '; HttpOnly'
  }
  if (options.secure) {
    cookie += '; Secure'
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`
  }

  return cookie
}

/**
 * `ServerAdapter` for React Router, used everywhere except while rendering an
 * admin page (see {@link createPageRenderServerAdapter}).
 *
 * Navigation throws a `Response`, which React Router honours from loaders,
 * actions, resource routes and server functions alike. Unlike the TanStack
 * adapter, `forbidden` / `unauthorized` / `permanentRedirect` keep their real
 * HTTP status (403 / 401 / 308).
 */
export const reactRouterServerAdapter: ServerAdapter = {
  forbidden: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw new Response('Forbidden', { status: 403 })
  },
  getCookies: () => buildCookieStore(getRequest().headers),
  getHeaders: () => new Headers(getRequest().headers),
  notFound: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw new Response('Not Found', { status: 404 })
  },
  permanentRedirect: (path) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw redirect(path, 308)
  },
  redirect: (path) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw redirect(path)
  },
  setCookie: (name, value, options) => {
    getRequestStore().setCookies.push(serializeCookie(name, value, options))
  },
  unauthorized: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw new Response('Unauthorized', { status: 401 })
  },
}

/** Navigation requested while an admin page was rendering. */
export type PageNavIntent = {
  type?: 'notFound' | 'redirect'
  url?: string
}

/**
 * `ServerAdapter` for the admin page render (`renderRoot`).
 *
 * Views call `req.server.redirect()` / `.notFound()` deep inside async server
 * components. A throw there happens while the tree is being serialized and can
 * no longer change the HTTP response, so — like the TanStack adapter — the intent
 * is recorded on `nav` and the framework-neutral string errors are thrown:
 * `Error('redirect:<url>')` and `Error('not-found')`. `DocumentView` already
 * recognises both (`@payloadcms/ui/views/Document`), so no shared code changes.
 * `loadAdminPage` renders the tree to completion, then honours `nav`.
 */
export const createPageRenderServerAdapter = (nav: PageNavIntent): ServerAdapter => ({
  ...reactRouterServerAdapter,
  notFound: () => {
    nav.type = 'notFound'
    throw new Error('not-found')
  },
  permanentRedirect: (path) => {
    nav.type = 'redirect'
    nav.url = path
    throw new Error(`redirect:${path}`)
  },
  redirect: (path) => {
    nav.type = 'redirect'
    nav.url = path
    throw new Error(`redirect:${path}`)
  },
})
