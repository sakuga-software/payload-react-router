import type { ImportMap, SanitizedConfig } from 'payload'
import type { ReactNode } from 'react'

import { Fragment } from 'react'

import { createFromReadableStream, renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { data, redirect } from 'react-router'

import type { PageNavIntent } from './serverAdapter.ts'

export type { AdminPageMeta } from './metadata.ts'

import { getRequestI18n, initAdminContext } from './initAdminContext.ts'
import { toSearchParams } from './searchParams.ts'
import { createPageRenderServerAdapter } from './serverAdapter.ts'
import { markKeysValidated } from './markKeysValidated.ts'
import { type AdminPageMeta, toAdminPageMeta } from './metadata.ts'

export type LoadAdminPageArgs = {
  config: Promise<SanitizedConfig> | SanitizedConfig
  importMap: ImportMap
  request: Request
  /** `params['*']` of the `admin/*` splat route: the path after `/admin/`. */
  splat?: string
}

export type AdminPageData = {
  /** Plain-string page metadata, rendered as `<title>` / `<meta>` by {@link AdminPage}. */
  meta: AdminPageMeta
  /** The rendered admin view, ready to be returned from a server component. */
  page: ReactNode
}


/**
 * Serializes `node` to a Flight stream and reads it to the end, then decodes it
 * back into a React tree.
 *
 * Every async server component in the admin tree runs during this call, so any
 * `req.server.redirect()` / `.notFound()` they make lands in `nav` *before* the
 * loader returns — while a redirect or a 404 status can still be sent. The
 * decoded tree contains client references and resolved server output, so React
 * Router re-serializes it without running the views a second time.
 *
 * The TanStack adapter forces the same full render, through a TanStack-internal
 * stream symbol (`packages/tanstack-start/src/adapters/views/server.tsx`).
 */
async function renderToCompletion(node: ReactNode): Promise<ReactNode> {
  const buffer = await new Response(renderToReadableStream(node)).arrayBuffer()
  const tree = await createFromReadableStream<ReactNode>(new Response(buffer).body!)
  if (process.env.NODE_ENV !== 'production') {
    markKeysValidated(tree)
  }
  return tree
}


/**
 * Loads one admin page for the `admin/*` splat route. Call it from the route
 * `loader` and render the result with {@link AdminPage}:
 *
 * ```tsx
 * export const loader = ({ params, request }: Route.LoaderArgs) =>
 *   loadAdminPage({ config, importMap, request, splat: params['*'] })
 *
 * export function ServerComponent({ loaderData }: Route.ComponentProps) {
 *   return <AdminPage {...loaderData} />
 * }
 * ```
 *
 * Navigation becomes React Router primitives: a redirect is thrown as
 * `redirect()`, and an unknown or forbidden page returns Payload's not-found
 * view (with the admin chrome) under an HTTP 404.
 */
export async function loadAdminPage({
  config: configInput,
  importMap,
  request,
  splat,
}: LoadAdminPageArgs): Promise<AdminPageData | ReturnType<typeof data<AdminPageData>>> {
  const [{ renderRoot }, { defaultAdminViews }, { generatePageMetadata }] = await Promise.all([
    import('@payloadcms/ui/views/Root'),
    import('@payloadcms/ui/views/Root/adminViews'),
    import('@payloadcms/ui/views/Root/generatePageMetadata'),
  ])

  const config = await configInput
  const url = new URL(request.url)
  const searchParams = toSearchParams(url)
  const splatSegments = splat ? splat.split('/').filter(Boolean) : []
  // `/admin` itself has no segments (Next's optional catch-all). An empty array
  // would make `renderRoot` see `/admin/` and add `?redirect=/admin/` on login.
  const segments = splatSegments.length > 0 ? splatSegments : undefined

  const nav: PageNavIntent = {}
  const pageServerAdapter = createPageRenderServerAdapter(nav)

  const renderNotFound = async () => {
    const { renderNotFoundPage } = await import('@payloadcms/ui/views/NotFound/page')
    const node = await renderNotFoundPage({
      config: Promise.resolve(config),
      importMap,
      initAdminContext: (args) => initAdminContext({ ...args }),
      params: Promise.resolve({ segments: splatSegments }),
      searchParams: Promise.resolve(searchParams),
    })
    const i18n = await getRequestI18n({ config })
    return data<AdminPageData>(
      { meta: { title: i18n.t('general:notFound') }, page: await renderToCompletion(node) },
      { status: 404 },
    )
  }

  let page: ReactNode
  try {
    const node = await renderRoot({
      adminViews: defaultAdminViews,
      config: Promise.resolve(config),
      importMap,
      initAdminContext: (args) => initAdminContext({ ...args, serverAdapter: pageServerAdapter }),
      // Remount the view when the route changes, so client providers holding
      // per-document state start fresh. Search-only changes keep the key.
      key: splat ?? '',
      notFound: pageServerAdapter.notFound,
      params: Promise.resolve({ segments }) as Parameters<typeof renderRoot>[0]['params'],
      redirect: pageServerAdapter.redirect,
      searchParams: Promise.resolve(searchParams),
    })
    page = await renderToCompletion(node)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (nav.type === undefined && message === 'not-found') {
      nav.type = 'notFound'
    } else if (nav.type === undefined && message.startsWith('redirect:')) {
      nav.type = 'redirect'
      nav.url = message.slice('redirect:'.length)
    } else if (nav.type === undefined) {
      throw error
    }
  }

  if (nav.type === 'redirect' && nav.url) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw redirect(nav.url)
  }
  if (nav.type === 'notFound') {
    return renderNotFound()
  }

  const i18n = await getRequestI18n({ config })
  const metadata = await generatePageMetadata({
    adminViews: defaultAdminViews as Parameters<typeof generatePageMetadata>[0]['adminViews'],
    config,
    i18n,
    params: { segments },
  })

  return { meta: toAdminPageMeta(metadata), page }
}


/**
 * Renders a page loaded by {@link loadAdminPage}, with its `<title>` hoisted by React.
 *
 * `page` is typed `unknown` on purpose: React Router's generated route types
 * describe loader data as if it were turbo-stream serialized, which mangles
 * `ReactNode`. In RSC mode loader data travels as Flight, so the element arrives
 * intact and can be passed straight through: `<AdminPage {...loaderData} />`.
 */
export function AdminPage({ meta, page }: { meta: AdminPageMeta; page: unknown }) {
  const og = meta.openGraph
  // Twitter tags come from OpenGraph, as in Next.js metadata resolution.
  const twitterImage = og?.images?.[0]
  return (
    <>
      {meta.title ? <title>{meta.title}</title> : null}
      {meta.description ? <meta content={meta.description} name="description" /> : null}
      {meta.keywords ? <meta content={meta.keywords} name="keywords" /> : null}
      {meta.robots ? <meta content={meta.robots} name="robots" /> : null}
      {og?.title ? <meta content={og.title} property="og:title" /> : null}
      {og?.description ? <meta content={og.description} property="og:description" /> : null}
      {og?.siteName ? <meta content={og.siteName} property="og:site_name" /> : null}
      {og?.images?.map((image) => (
        <Fragment key={image.url}>
          <meta content={image.url} property="og:image" />
          {image.width ? <meta content={String(image.width)} property="og:image:width" /> : null}
          {image.height ? <meta content={String(image.height)} property="og:image:height" /> : null}
          {image.alt ? <meta content={image.alt} property="og:image:alt" /> : null}
        </Fragment>
      ))}
      {twitterImage ? <meta content="summary_large_image" name="twitter:card" /> : null}
      {twitterImage ? <meta content={twitterImage.url} name="twitter:image" /> : null}
      {og?.title ? <meta content={og.title} name="twitter:title" /> : null}
      {og?.description ? <meta content={og.description} name="twitter:description" /> : null}
      {meta.icons?.map((icon) => (
        <link
          href={icon.url}
          key={`${icon.rel}:${icon.url}:${icon.media ?? ''}`}
          media={icon.media}
          rel={icon.rel}
          sizes={icon.sizes}
          type={icon.type}
        />
      ))}
      {page as ReactNode}
    </>
  )
}
