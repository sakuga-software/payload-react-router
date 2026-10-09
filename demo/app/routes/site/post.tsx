import { data } from 'react-router'

import type { Route } from './+types/post'

import { LivePost } from '../../components/LivePreview'
import { getReader } from '../../lib/payload.server'

export async function loader({ params, request }: Route.LoaderArgs) {
  const { draft, payload, serverURL, user } = await getReader(request)
  const { docs } = await payload.find({
    collection: 'posts',
    depth: 1,
    draft,
    limit: 1,
    overrideAccess: false,
    user,
    where: { slug: { equals: params.slug } },
  })
  const post = docs[0]
  if (!post) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw data('Post not found', { status: 404 })
  }
  return { post, serverURL }
}

export function ServerComponent({ loaderData: { post, serverURL } }: Route.ComponentProps) {
  return <LivePost initialData={post} serverURL={serverURL} />
}
