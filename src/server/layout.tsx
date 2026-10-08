import type { RootLayoutFont } from '@payloadcms/ui'
import type { ImportMap, SanitizedConfig } from 'payload'
import type { HtmlHTMLAttributes, ReactNode } from 'react'

import { DocumentRoot } from '@payloadcms/ui'
import { getViewportMeta } from '@payloadcms/ui/layouts'
import { NestProviders } from '@payloadcms/ui/layouts/NestProviders'
import { getRootLayoutData } from '@payloadcms/ui/layouts/Root/getRootLayoutData'

import type { PayloadServerFunction } from '../client/PayloadRootProviders.tsx'

import { PayloadRootProviders } from '../client/PayloadRootProviders.tsx'
import { initAdminContext } from './initAdminContext.ts'

export type PayloadAdminLayoutProps = {
  readonly children: ReactNode
  readonly config: Promise<SanitizedConfig> | SanitizedConfig
  readonly fonts?: RootLayoutFont[]
  /** Extra `<head>` content (fonts, analytics, favicons…). */
  readonly head?: ReactNode
  readonly htmlProps?: HtmlHTMLAttributes<HTMLHtmlElement>
  readonly importMap: ImportMap
  /** The app's `'use server'` function that calls `handleServerFunctions`. */
  readonly serverFunction: PayloadServerFunction
}

/**
 * The admin document: `<html>` with Payload's theme / language / direction
 * attributes, the admin providers, and any custom
 * `config.admin.components.providers`.
 *
 * The React Router counterpart of `RootLayout` from `@payloadcms/ui/layouts`
 * (what `@payloadcms/next` renders in `app/(payload)/layout.tsx`). It differs in
 * one place: providers go through {@link PayloadRootProviders}, a client
 * component that binds the router adapter and wraps `serverFunction` (see there).
 *
 * Render it as the `ServerComponent` of the layout route wrapping `/admin/*`.
 */
export async function PayloadAdminLayout({
  children,
  config: configInput,
  fonts,
  head,
  htmlProps,
  importMap,
  serverFunction,
}: PayloadAdminLayoutProps) {
  const configPromise = Promise.resolve(configInput)
  const { cookies, permissions, req, user } = await initAdminContext({
    configPromise,
    importMap,
    key: 'RootLayout',
  })

  const data = await getRootLayoutData({ cookies, importMap, permissions, req, user })
  const providers = req.payload.config.admin?.components?.providers

  return (
    <DocumentRoot
      dir={data.dir}
      fonts={fonts}
      head={head}
      highContrastMode={data.highContrastMode}
      htmlProps={htmlProps}
      languageCode={data.languageCode}
      suppressHydrationWarning={data.suppressHydrationWarning}
      theme={data.theme}
      themeSource={data.themeSource}
      viewport={getViewportMeta(req.headers.get('user-agent') ?? undefined)}
    >
      <PayloadRootProviders data={data} serverFunction={serverFunction}>
        {Array.isArray(providers) && providers.length > 0 ? (
          <NestProviders
            importMap={req.payload.importMap}
            providers={providers}
            serverProps={{
              i18n: req.i18n,
              payload: req.payload,
              permissions,
              server: req.server!,
              user: user ?? undefined,
            }}
          >
            {children}
          </NestProviders>
        ) : (
          children
        )}
      </PayloadRootProviders>
    </DocumentRoot>
  )
}
