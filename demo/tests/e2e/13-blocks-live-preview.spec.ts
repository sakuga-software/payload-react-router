import { expect, type Page, test } from '@playwright/test'

import { createPost, gotoAdmin, login, saveDoc, uniqueSlug } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

const createPage = async (page: Page, data: Record<string, unknown>, { draft = false } = {}) => {
  const response = await page.request.post(`/api/pages${draft ? '?draft=true' : ''}`, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
  return ((await response.json()) as { doc: { id: number } }).doc
}

const openLivePreview = async (page: Page) => {
  await page.click('#live-preview-toggler')
  return page.frameLocator('iframe.iframe-loader__iframe')
}

test('build a page from blocks in the admin and publish it', async ({ page, request }) => {
  const slug = uniqueSlug('blocks')
  await gotoAdmin(page, '/admin/collections/pages/create')
  await page.fill('#field-title', 'Built from blocks')
  await page.fill('#field-slug', slug)
  // The first autosave redirects /create to the new id.
  await expect(page).toHaveURL(/\/admin\/collections\/pages\/\d+$/, { timeout: 30_000 })

  await page.click('.blocks-field__drawer-toggler')
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Call To Action' }).click()
  await drawer.getByRole('button', { name: 'Insert' }).click()
  await page.fill('#field-layout__0__heading', 'Join the beta')
  await page.fill('#field-layout__0__buttonLabel', 'Sign up')
  await page.fill('#field-layout__0__buttonLink', '/signup')
  await saveDoc(page, '#action-save')

  // An anonymous visitor reads the published page.
  const html = await (await request.get(`/${slug}`)).text()
  expect(html).toContain('Join the beta')
  await page.goto(`/${slug}`)
  await expect(page.locator('.block-cta a')).toHaveAttribute('href', '/signup')
})

test('live preview shows unsaved block edits while typing', async ({ page }) => {
  const slug = uniqueSlug('live')
  const doc = await createPage(page, {
    _status: 'published',
    layout: [{ blockType: 'hero', heading: 'Saved heading' }],
    slug,
    title: 'Live page',
  })

  await gotoAdmin(page, `/admin/collections/pages/${doc.id}`)
  const preview = await openLivePreview(page)
  await expect(preview.locator('.block-hero h1')).toHaveText('Saved heading')

  await page.fill('#field-layout__0__heading', 'Typed, not saved')
  await expect(preview.locator('.block-hero h1')).toHaveText('Typed, not saved')

  const published = await (await page.request.get(`/api/pages/${doc.id}`)).json()
  expect(published.layout[0].heading).toBe('Saved heading')
})

test('live preview follows post edits', async ({ page }) => {
  const post = await createPost(page.request, { _status: 'published', slug: uniqueSlug('live-post'), title: 'Before' })

  await gotoAdmin(page, `/admin/collections/posts/${post.id}?locale=en`)
  const preview = await openLivePreview(page)
  await expect(preview.locator('article h1')).toHaveText('Before')

  await page.fill('#field-title', 'After')
  await expect(preview.locator('article h1')).toHaveText('After')
})

test('drafts reach signed-in readers only', async ({ page, request }) => {
  const slug = uniqueSlug('draft-page')
  await createPage(page, { layout: [{ blockType: 'hero', heading: 'Draft only' }], slug, title: 'Draft' }, { draft: true })

  expect((await request.get(`/${slug}`)).status()).toBe(404)
  expect((await request.get(`/api/pages?where[slug][equals]=${slug}`)).ok()).toBeTruthy()
  expect((await (await request.get(`/api/pages?where[slug][equals]=${slug}`)).json()).totalDocs).toBe(0)

  await page.goto(`/${slug}`)
  await expect(page.locator('.block-hero h1')).toHaveText('Draft only')
})

test('a call to action only accepts a site path or an http(s) URL', async ({ page }) => {
  const cta = (buttonLink: string) => ({
    _status: 'published',
    layout: [{ blockType: 'callToAction', buttonLabel: 'Go', buttonLink, heading: 'Link check' }],
    slug: uniqueSlug('cta'),
    title: 'Link check',
  })
  const unsafeLinks = [
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(1)',
    'data:text/html,x',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    'https:evil.example',
  ]
  for (const unsafe of unsafeLinks) {
    const response = await page.request.post('/api/pages', { data: cta(unsafe) })
    expect(response.status(), unsafe).toBe(400)
  }
  for (const safe of ['/pricing', '/docs/intro?tab=1#top', 'https://payloadcms.com', 'HTTP://example.com/a']) {
    const response = await page.request.post('/api/pages', { data: cta(safe) })
    expect(response.ok(), safe).toBeTruthy()
  }
})

test('a page slug cannot take the path of another route', async ({ page }) => {
  for (const slug of ['admin', 'api', 'posts', 'two/segments', 'Upper Case']) {
    const response = await page.request.post('/api/pages', { data: { _status: 'published', slug, title: 'Slug check' } })
    expect(response.status(), slug).toBe(400)
  }
})

test('the site nav lists every published page, past the default limit of 10', async ({ page, request }) => {
  const prefix = uniqueSlug('nav')
  const slugs = Array.from({ length: 11 }, (_, index) => `${prefix}-${index}`)
  for (const slug of slugs) {
    await createPage(page, { _status: 'published', slug, title: `Nav ${slug}` })
  }

  const html = await (await request.get('/')).text()
  for (const slug of slugs) {
    expect(html, slug).toContain(`href="/${slug}"`)
  }
})
