import { expect, test } from '@playwright/test'

import { admin, createPost, ensureAdmin, uniqueSlug } from './helpers'

// The responses below are Payload's own REST contract — the same handler
// (`handleEndpoints`) answers under Next.js, so these shapes are what a Next
// app returns for the same requests.
test.describe('REST and GraphQL API', () => {
  test.beforeAll(async ({ request }) => {
    await ensureAdmin(request)
  })

  test('collection find returns a paginated result', async ({ request }) => {
    const response = await request.get('/api/pages?limit=5')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    const body = await response.json()
    expect(body).toMatchObject({ docs: expect.any(Array), limit: 5, page: 1 })
    for (const key of ['hasNextPage', 'hasPrevPage', 'totalDocs', 'totalPages']) {
      expect(body).toHaveProperty(key)
    }
  })

  test('login sets an HttpOnly auth cookie and /me returns the user', async ({ request }) => {
    const login = await request.post('/api/users/login', { data: admin })
    expect(login.status()).toBe(200)
    const setCookie = login.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie')?.value ?? ''
    expect(setCookie).toMatch(/payload-token=/)
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(await login.json()).toMatchObject({ token: expect.any(String), user: { email: admin.email } })

    const me = await request.get('/api/users/me')
    expect(await me.json()).toMatchObject({ user: { email: admin.email } })

    const logout = await request.post('/api/users/logout')
    expect(logout.status()).toBe(200)
    expect((await (await request.get('/api/users/me')).json()).user).toBeNull()
  })

  test('access control: anonymous reads see published posts only', async ({ playwright, request }) => {
    await request.post('/api/users/login', { data: admin })
    const published = await createPost(request, { _status: 'published', slug: uniqueSlug('pub'), title: 'Published' })
    const draft = await createPost(request, { slug: uniqueSlug('draft'), title: 'Draft only' }, { draft: true })

    const anonymous = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    const list = await (await anonymous.get('/api/posts?limit=100')).json()
    const ids = (list.docs as { id: number }[]).map((doc) => doc.id)
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
    expect((await anonymous.get(`/api/posts/${draft.id}`)).status()).toBe(404)
    await anonymous.dispose()
  })

  test('create, update and delete over REST', async ({ request }) => {
    await request.post('/api/users/login', { data: admin })
    const created = await request.post('/api/pages', { data: { slug: uniqueSlug('page'), title: 'REST page' } })
    expect(created.status()).toBe(201)
    const { doc } = await created.json()

    const updated = await request.patch(`/api/pages/${doc.id}`, { data: { title: 'REST page (edited)' } })
    expect(updated.status()).toBe(200)
    expect((await updated.json()).doc.title).toBe('REST page (edited)')

    const removed = await request.delete(`/api/pages/${doc.id}`)
    expect(removed.status()).toBe(200)
    expect((await request.get(`/api/pages/${doc.id}`)).status()).toBe(404)
  })

  test('validation errors come back as 400 with field details', async ({ request }) => {
    await request.post('/api/users/login', { data: admin })
    const response = await request.post('/api/pages', { data: { title: 'missing slug' } })
    expect(response.status()).toBe(400)
    expect(JSON.stringify(await response.json())).toContain('slug')
  })

  test('unknown API routes answer 404 JSON', async ({ request }) => {
    const response = await request.get('/api/does-not-exist')
    expect(response.status()).toBe(404)
  })

  test('globals and localized reads', async ({ request }) => {
    const settings = await request.get('/api/globals/site-settings')
    expect(settings.status()).toBe(200)
    expect(await settings.json()).toHaveProperty('siteName')

    const fr = await request.get('/api/globals/site-settings?locale=fr')
    expect(fr.status()).toBe(200)
  })

  test('GraphQL endpoint answers queries', async ({ request }) => {
    const response = await request.post('/api/graphql', {
      data: { query: '{ Pages(limit: 1) { totalDocs } }' },
    })
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ data: { Pages: { totalDocs: expect.any(Number) } } })
  })

  test('CORS preflight (OPTIONS) is answered by Payload, not React Router', async ({ request }) => {
    const response = await request.fetch('/api/posts', {
      headers: { 'Access-Control-Request-Method': 'GET', Origin: 'http://localhost' },
      method: 'OPTIONS',
    })
    // Under `vite dev`, Vite's own CORS middleware answers preflights (204)
    // before the request reaches React Router; in production Payload does (200).
    expect(response.status()).toBe(process.env.E2E_MODE === 'dev' ? 204 : 200)
  })
})
