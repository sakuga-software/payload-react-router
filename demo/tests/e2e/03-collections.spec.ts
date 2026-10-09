import { expect, test } from '@playwright/test'

import { closeToasts, createPost, gotoAdmin, login, saveDoc, uniqueSlug } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('create a page, edit it, then delete it from the document controls', async ({ page }) => {
  const slug = uniqueSlug('ui-page')
  await gotoAdmin(page, '/admin/collections/pages/create')
  await page.fill('#field-title', 'Page from the admin')
  await page.fill('#field-slug', slug)
  await saveDoc(page)
  await expect(page).toHaveURL(/\/admin\/collections\/pages\/\d+$/)
  const id = page.url().split('/').pop()

  await page.fill('#field-title', 'Page from the admin (edited)')
  await saveDoc(page)
  const api = await (await page.request.get(`/api/pages/${id}`)).json()
  expect(api.title).toBe('Page from the admin (edited)')

  await page.locator('.doc-controls__popup').click()
  await page.locator('.popup__content #action-delete').click()
  await page.locator('.delete-document [data-dialog-action="confirm"]').click()
  await expect(page.locator('.payload-toast-container')).toContainText('successfully deleted')
  await expect(page).toHaveURL(/\/admin\/collections\/pages(\?|$)/)
  await closeToasts(page)
  expect((await page.request.get(`/api/pages/${id}`)).status()).toBe(404)
})

test('list view: search, sort and pagination', async ({ page }) => {
  const prefix = uniqueSlug('list')
  for (let i = 0; i < 12; i++) {
    await createPost(page.request, { slug: `${prefix}-${i}`, title: `${prefix} item ${String(i).padStart(2, '0')}` })
  }

  await gotoAdmin(page, '/admin/collections/posts?limit=5')
  await expect(page.locator('.paginator')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(5)

  // Pagination: next page keeps the list mounted and updates the URL.
  await page.getByRole('button', { name: 'Next table page' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('tbody tr')).toHaveCount(5)

  // Search narrows to the twelve posts created above.
  await page.fill('#search-filter-input', prefix)
  await expect(page).toHaveURL(new RegExp(`search=${prefix}`))
  await expect(page.getByText(/\d+-\d+ of 12/)).toBeVisible()

  // Sort by title, descending: the last item comes first.
  await gotoAdmin(page, `/admin/collections/posts?limit=5&search=${prefix}&sort=-title`)
  await expect(page.locator('tbody tr').first()).toContainText(`${prefix} item 11`)
  await gotoAdmin(page, `/admin/collections/posts?limit=5&search=${prefix}&sort=title`)
  await expect(page.locator('tbody tr').first()).toContainText(`${prefix} item 00`)
})

test('client-side navigation between admin views does not reload the document', async ({ page }) => {
  await gotoAdmin(page, '/admin')
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42))

  await page.locator('a[href="/admin/collections/pages"]').first().click()
  // The list view appends the user's saved preferences (limit, sort) to the URL.
  await expect(page).toHaveURL(/\/admin\/collections\/pages(\?|$)/)
  await expect(page.locator('.collection-list')).toBeVisible()

  await page.locator('a[href="/admin/collections/posts"]').first().click()
  // The list view appends the user's saved preferences (limit, sort) to the URL.
  await expect(page).toHaveURL(/\/admin\/collections\/posts(\?|$)/)
  await expect(page.locator('.collection-list')).toBeVisible()

  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42)
})

test('an unknown admin route renders Payload not-found with a 404 status', async ({ page }) => {
  const response = await page.goto('/admin/collections/does-not-exist')
  expect(response?.status()).toBe(404)
  await expect(page.locator('.not-found')).toBeVisible()
})
