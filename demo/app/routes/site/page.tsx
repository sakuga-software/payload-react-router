import { data } from 'react-router'

import type { Route } from './+types/page'

import { LivePage } from '../../components/LivePreview'
import { getReader } from '../../lib/payload.server'

export async function loader({ params, request }: Route.LoaderArgs) {
  const { draft, payload, serverURL, user } = await getReader(request)
  const { docs } = await payload.find({
    collection: 'pages',
    depth: 1,
    draft,
    limit: 1,
    overrideAccess: false,
    user,
    where: { slug: { equals: params.slug } },
  })
  const page = docs[0]
  if (!page) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw data('Page not found', { status: 404 })
  }
  return { page, serverURL }
}

export function ServerComponent({ loaderData: { page, serverURL } }: Route.ComponentProps) {
  return <LivePage initialData={page} serverURL={serverURL} />
}
