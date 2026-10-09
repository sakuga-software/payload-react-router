import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  // The website: its own <html>, content read through Payload's Local API.
  layout('routes/site/layout.tsx', [
    index('routes/site/home.tsx'),
    route('posts/:slug', 'routes/site/post.tsx'),
    route(':slug', 'routes/site/page.tsx'),
  ]),
  // The admin panel: Payload's <html>, providers and views.
  layout('routes/payload/layout.tsx', { id: 'payload' }, [
    route('admin/*', 'routes/payload/admin.tsx'),
  ]),
  // REST + GraphQL API (resource route).
  route('api/*', 'routes/payload/api.ts'),
] satisfies RouteConfig
