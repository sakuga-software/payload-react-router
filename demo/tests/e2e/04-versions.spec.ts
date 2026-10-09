import { expect, test } from '@playwright/test'

import { gotoAdmin, login, saveDoc, uniqueSlug } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('autosave creates a draft and redirects to it, then publish', async ({ page }) => {
  const slug = uniqueSlug('autosave')
  await gotoAdmin(page, '/admin/collections/posts/create')
  await page.fill('#field-title', 'Autosaved post')
  await page.fill('#field-slug', slug)

  // DocumentView redirects from /create to the new id after the first autosave:
  // the redirect raised inside the server render must reach the browser.
  await expect(page).toHaveURL(/\/admin\/collections\/posts\/\d+$/, { timeout: 30_000 })
  const id = page.url().split('/').pop()

  await expect
    .poll(async () => (await (await page.request.get(`/api/posts/${id}?draft=true`)).json())._status)
    .toBe('draft')

  await saveDoc(page, '#action-save')
  const published = await (await page.request.get(`/api/posts/${id}`)).json()
  expect(published._status).toBe('published')
})

test('versions view lists saved versions', async ({ page }) => {
  const slug = uniqueSlug('versions')
  const created = await page.request.post('/api/posts', {
    data: { _status: 'published', slug, title: 'Version one' },
  })
  const { doc } = await created.json()
  await page.request.patch(`/api/posts/${doc.id}`, { data: { _status: 'published', title: 'Version two' } })

  await gotoAdmin(page, `/admin/collections/posts/${doc.id}/versions`)
  await expect(page.locator('.versions')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(2)
})
