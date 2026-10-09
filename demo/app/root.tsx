import { isRouteErrorResponse, Outlet } from 'react-router'
import { payloadMiddleware } from 'payload-react-router/server'

import type { Route } from './+types/root'

// Opens the request scope Payload's server adapter reads headers from and
// writes cookies to. Must be on the root route so every request goes through it.
export const middleware: Route.MiddlewareFunction[] = [payloadMiddleware]

// The site and the admin each render their own <html> from their layout route.
export function ServerComponent() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error'

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
      </head>
      <body>
        <h1>{title}</h1>
      </body>
    </html>
  )
}
