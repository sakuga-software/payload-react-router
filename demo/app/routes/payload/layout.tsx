// The admin document. Equivalent of `app/(payload)/layout.tsx` in a Next.js app.
import config from '@payload-config'
import '@payloadcms/ui/css/app.css'
import { PayloadAdminLayout } from 'payload-react-router/server'
import { Outlet } from 'react-router'

import './custom.css'
import { importMap } from './importMap.js'
import { serverFunction } from './server-functions'

export function ServerComponent() {
  return (
    <PayloadAdminLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      <Outlet />
    </PayloadAdminLayout>
  )
}
