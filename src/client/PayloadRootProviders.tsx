'use client'

import type { RootLayoutData } from '@payloadcms/ui/layouts/Root/getRootLayoutData'
import type { ServerFunctionClient, ServerFunctionClientArgs } from 'payload'
import type { ReactNode } from 'react'

import { RootProviders } from '@payloadcms/ui'
import React, { useCallback } from 'react'

import { ReactRouterAdapter } from './RouterAdapter.tsx'

/**
 * Signature of the app's `'use server'` function. The second argument is the
 * revalidation opt-out added by {@link PayloadRootProviders}; the server side
 * ignores it.
 */
export type PayloadServerFunction = (
  args: ServerFunctionClientArgs,
  revalidation?: FormData,
) => Promise<unknown>

/**
 * React Router re-renders the current route after *every* server function
 * call, unless the call carries a `FormData` with a `$SKIP_REVALIDATION` entry
 * (`react-router/lib/rsc/server.rsc.ts`, `processServerAction`).
 *
 * Payload calls server functions constantly — `form-state` runs on every
 * keystroke — and refreshes explicitly with `router.refresh()` when it needs
 * fresh server output, the way Next's server actions behave. Without the
 * opt-out each keystroke would re-render the whole admin page.
 */
function skipRevalidation(): FormData {
  const formData = new FormData()
  formData.set('$SKIP_REVALIDATION', '1')
  return formData
}

export type PayloadRootProvidersProps = {
  children: ReactNode
  data: RootLayoutData
  serverFunction: PayloadServerFunction
}

/** Payload's `RootProviders`, bound to React Router. Rendered by `PayloadAdminLayout`. */
export function PayloadRootProviders({ children, data, serverFunction }: PayloadRootProvidersProps) {
  const callServerFunction = useCallback<ServerFunctionClient>(
    (args) => serverFunction(args, skipRevalidation()),
    [serverFunction],
  )

  return (
    <RootProviders data={data} RouterAdapter={ReactRouterAdapter} serverFunction={callServerFunction}>
      {children}
    </RootProviders>
  )
}
