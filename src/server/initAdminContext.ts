import type { I18nClient } from '@payloadcms/translations'
import type { SanitizedConfig, ServerAdapter } from 'payload'
import type { AdminContextCache, InitAdminContextArgs, PartialAdminContext } from 'payload/internal'

import { initI18n } from '@payloadcms/translations'
import { getRequestLanguage, parseCookies } from 'payload'
import { initAdminContext as initPayloadAdminContext } from 'payload/internal'

// Registers the dev reload strategy before a Payload instance is built. No-op
// outside of `vite dev`.
import '../vite/devConfigReload.server.ts'
import { getRequest, requestMemo } from './requestStore.ts'
import { reactRouterServerAdapter } from './serverAdapter.ts'

/**
 * Only the partial context (Payload instance, i18n, authenticated user) is
 * shared within a request: the admin layout and the admin page each build one
 * per request, and running the auth strategies twice would be wasted work.
 *
 * The full context is not cached. It embeds `req.server`, and the layout and
 * the page deliberately use different server adapters.
 */
const cache: AdminContextCache = {
  getPartial: (createPartialContext) =>
    requestMemo<PartialAdminContext>('payload:partial-admin-context', createPartialContext),
  getRequest: (createContext) => createContext(),
}

export type ReactRouterInitAdminContextArgs = {
  key?: string
  serverAdapter?: ServerAdapter
} & Omit<InitAdminContextArgs, 'cache' | 'key' | 'requestURL' | 'serverAdapter'>

/** `initAdminContext` bound to the current React Router request. */
export const initAdminContext = ({
  key = 'payload-react-router',
  serverAdapter = reactRouterServerAdapter,
  ...args
}: ReactRouterInitAdminContextArgs) =>
  initPayloadAdminContext({
    ...args,
    cache,
    key,
    requestURL: getRequest().url,
    serverAdapter,
  })

/**
 * Resolves the admin `I18n` for the current request without a full admin
 * context. Used for page metadata.
 */
export async function getRequestI18n({ config }: { config: SanitizedConfig }): Promise<I18nClient> {
  const headers = new Headers(getRequest().headers)
  const cookies = parseCookies(headers)
  const language = getRequestLanguage({ config, cookies, headers })

  return initI18n({ config: config.i18n, context: 'client', language })
}
