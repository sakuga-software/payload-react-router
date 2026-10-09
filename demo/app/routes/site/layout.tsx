import { Link, Outlet } from 'react-router'

import { getPayloadClient } from '../../lib/payload.server'
import './site.css'

export async function loader() {
  const payload = await getPayloadClient()
  const [settings, pages] = await Promise.all([
    payload.findGlobal({ slug: 'site-settings' }),
    payload.find({
      collection: 'pages',
      depth: 0,
      overrideAccess: false,
      // The default limit is 10. The nav lists every published page.
      pagination: false,
      select: { slug: true, title: true },
      sort: 'title',
    }),
  ])
  return { pages: pages.docs, siteName: settings.siteName, tagline: settings.tagline ?? null }
}

export function ServerComponent({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
      </head>
      <body>
        <header className="site-header">
          <Link to="/">{loaderData.siteName}</Link>
          {loaderData.tagline ? <span>{loaderData.tagline}</span> : null}
          <nav className="site-nav">
            {loaderData.pages.map((page) => (
              <Link key={page.id} to={`/${page.slug}`}>
                {page.title}
              </Link>
            ))}
          </nav>
          <a href="/admin">Admin</a>
        </header>
        <main className="site-main">
          <Outlet />
        </main>
      </body>
    </html>
  )
}
