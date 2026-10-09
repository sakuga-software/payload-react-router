// /admin and /admin/* — every admin view. Equivalent of
// `app/(payload)/admin/[[...segments]]/page.tsx` in a Next.js app.
import config from '@payload-config'
import { AdminPage, loadAdminPage } from 'payload-react-router/server'

import type { Route } from './+types/admin'

import { importMap } from './importMap.js'

export function loader({ params, request }: Route.LoaderArgs) {
  return loadAdminPage({ config, importMap, request, splat: params['*'] })
}

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  return <AdminPage {...loaderData} />
}
