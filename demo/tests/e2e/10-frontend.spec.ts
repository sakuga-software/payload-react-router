import { expect, test } from '@playwright/test'

import { createPost, ensureAdmin, uniqueSlug } from './helpers'

// The website reads Payload through the Local API inside React Router loaders.
test.describe('website (Local API in loaders)', () => {
  test('published posts are listed and readable; drafts are not', async ({ browser, request }) => {
    await ensureAdmin(request)
    await request.post('/api/users/login', { data: { email: 'dev@payloadcms.com', password: 'test-password-123' } })
    const published = await createPost(request, { _status: 'published', slug: uniqueSlug('site-pub'), title: 'Visible on the site' })
    const draft = await createPost(request, { slug: uniqueSlug('site-draft'), title: 'Hidden draft' }, { draft: true })

    // A fresh, anonymous browser context.
    const visitor = await browser.newPage()
    await visitor.goto('/')
    await expect(visitor.getByRole('link', { name: 'Visible on the site' }).first()).toBeVisible()
    await expect(visitor.getByText('Hidden draft')).toHaveCount(0)

    await visitor.getByRole('link', { name: 'Visible on the site' }).first().click()
    await expect(visitor).toHaveURL(`/posts/${published.slug}`)
    await expect(visitor.locator('h1')).toHaveText('Visible on the site')

    const hidden = await visitor.goto(`/posts/${draft.slug}`)
    expect(hidden?.status()).toBe(404)
    await visitor.close()
  })
})
