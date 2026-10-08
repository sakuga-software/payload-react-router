'use client'

import type { RouterAdapterContextValue } from '@payloadcms/ui/providers/RouterAdapter'
import type { LinkAdapterProps, RouterAdapterComponent, RouterAdapterRouter } from 'payload'

import { RouterAdapterContext, useRouteTransition } from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useNavigation,
  useParams,
  useRevalidator,
} from 'react-router'

import { normalizeNavigationTarget, toAdminParams } from './navigation.ts'

const ReactRouterLink: React.FC<LinkAdapterProps> = ({
  children,
  href,
  prefetch,
  ref,
  replace,
  scroll,
  ...rest
}) => (
  <Link
    prefetch={prefetch === false ? 'none' : 'intent'}
    preventScrollReset={scroll === false}
    ref={ref}
    replace={replace}
    to={href}
    {...rest}
  >
    {children}
  </Link>
)

const currentLocation = () => ({
  origin: window.location.origin,
  pathname: window.location.pathname,
  search: window.location.search,
})

/**
 * Payload's `RouterAdapter` contract implemented with React Router hooks.
 *
 * - `push` / `replace` → `useNavigate()`; `scroll: false` → `preventScrollReset`.
 * - `back` → `navigate(-1)`.
 * - `refresh` → `useRevalidator().revalidate()`, which in RSC mode re-renders the
 *   matched server routes, like Next's `router.refresh()`.
 * - `replaceState` → the History API directly: React Router does not observe
 *   `history.replaceState`, so the URL changes without a server round trip
 *   (the list view relies on that). TanStack needs a private flag for this.
 * - While React Router navigates or revalidates, Payload's progress bar is held.
 */
export const ReactRouterAdapter: RouterAdapterComponent = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const { holdRouteTransition } = useRouteTransition()

  const isBusy = navigation.state !== 'idle' || revalidator.state !== 'idle'
  useEffect(() => (isBusy ? holdRouteTransition() : undefined), [holdRouteTransition, isBusy])

  const push = useCallback<RouterAdapterRouter['push']>(
    (path, options) => {
      void navigate(normalizeNavigationTarget(path, currentLocation()), {
        preventScrollReset: options?.scroll === false,
      })
    },
    [navigate],
  )

  const replace = useCallback<RouterAdapterRouter['replace']>(
    (path, options) => {
      void navigate(normalizeNavigationTarget(path, currentLocation()), {
        preventScrollReset: options?.scroll === false,
        replace: true,
      })
    },
    [navigate],
  )

  const back = useCallback(() => void navigate(-1), [navigate])
  const { revalidate } = revalidator
  const refresh = useCallback(() => void revalidate(), [revalidate])

  const replaceState = useCallback((url: string) => {
    // Keep React Router's history entry state (key / index) intact.
    window.history.replaceState(window.history.state, '', url)
  }, [])

  const router = useMemo<RouterAdapterRouter>(
    () => ({ back, push, refresh, replace, replaceState }),
    [back, push, refresh, replace, replaceState],
  )

  const adaptedParams = useMemo(() => toAdminParams(params), [params])
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])

  const value = useMemo<RouterAdapterContextValue>(
    () => ({
      Link: ReactRouterLink,
      params: adaptedParams,
      pathname: location.pathname,
      router,
      searchParams,
    }),
    [adaptedParams, location.pathname, router, searchParams],
  )

  return <RouterAdapterContext value={value}>{children}</RouterAdapterContext>
}
