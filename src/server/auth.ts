import type { AuthCollectionSlug, LoginResult } from 'payload'

import {
  type LoginArgs,
  type LoginArgsWithoutServerAdapter,
  login as loginFn,
  type LogoutArgs,
  logout as logoutFn,
  refresh as refreshFn,
  type RefreshArgs,
} from 'payload/auth'

import { reactRouterServerAdapter } from './serverAdapter.ts'

/**
 * Payload's auth server functions bound to React Router. Call them from a
 * `'use server'` function or a route `action`; the auth cookie reaches the
 * browser through `payloadMiddleware`.
 */
export function login<TSlug extends AuthCollectionSlug>(
  args: LoginArgsWithoutServerAdapter<TSlug>,
): Promise<LoginResult<TSlug>> {
  return loginFn({ ...args, serverAdapter: reactRouterServerAdapter } as LoginArgs<TSlug>)
}

export function logout(
  args: Omit<LogoutArgs, 'serverAdapter'>,
): Promise<{ message: string; success: boolean }> {
  return logoutFn({ ...args, serverAdapter: reactRouterServerAdapter })
}

export function refresh(args: Omit<RefreshArgs, 'serverAdapter'>) {
  return refreshFn({ ...args, serverAdapter: reactRouterServerAdapter })
}
