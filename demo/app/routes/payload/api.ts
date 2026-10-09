// /api/* — Payload REST and GraphQL. Equivalent of `app/(payload)/api/[...slug]/route.ts`.
import config from '@payload-config'
import { createAPIRoute } from 'payload-react-router/server'

export const { action, loader, middleware } = createAPIRoute({ config })
