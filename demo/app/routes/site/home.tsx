import { Link } from 'react-router'

import type { Route } from './+types/home'

import { getPayloadClient } from '../../lib/payload.server'

export async function loader() {
  const payload = await getPayloadClient()
  // No `user` and `overrideAccess: false`: the collection's access control
  // decides what an anonymous visitor sees (published posts only).
  const posts = await payload.find({
    collection: 'posts',
    depth: 0,
    overrideAccess: false,
    // The default limit is 10. The index lists every published post.
    pagination: false,
    select: { excerpt: true, publishedAt: true, slug: true, title: true },
    sort: '-publishedAt',
  })
  return { posts: posts.docs }
}

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <title>Posts</title>
      <h1>Posts</h1>
      {loaderData.posts.length === 0 ? (
        <p>
          No published posts yet. <a href="/admin">Write one in the admin</a>.
        </p>
      ) : (
        <ul className="post-list">
          {loaderData.posts.map((post) => (
            <li key={post.id}>
              <Link to={`/posts/${post.slug}`}>{post.title}</Link>
              {post.excerpt ? <p>{post.excerpt}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
