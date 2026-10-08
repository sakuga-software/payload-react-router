import type { ServerFunctionHandler } from 'payload'

import { createServerFunctionHandler } from '@payloadcms/ui/utilities/handleServerFunctions'

import { initAdminContext } from './initAdminContext.ts'

/**
 * Payload's server-function dispatcher bound to React Router's request.
 *
 * In React Router's RSC mode, server functions are real React Server Functions
 * (`'use server'`), so their results — including the `ReactNode`s returned by
 * `render-document`, `render-list` or `form-state` — travel over the Flight
 * protocol natively, as under Next.js. No `transformResult` is needed (TanStack
 * needs `serializeForRsc` because its server functions use seroval).
 *
 * Call it from an app-owned `'use server'` module that binds `config` and the
 * generated `importMap`:
 *
 * ```ts
 * 'use server'
 * export async function serverFunction(args, _options) {
 *   return handleServerFunctions({ ...args, config, importMap })
 * }
 * ```
 */
export const handleServerFunctions: ServerFunctionHandler = createServerFunctionHandler({
  initAdminContext: ({ configPromise, importMap }) =>
    initAdminContext({ configPromise, importMap, key: 'RootLayout' }),
})
