import { expect, test } from '@playwright/test'

import { admin, gotoAdmin, login, saveDoc, uniqueSlug } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('edit a global and see it on the website', async ({ page }) => {
  const siteName = `Site ${uniqueSlug('name')}`
  await gotoAdmin(page, '/admin/globals/site-settings')
  await page.fill('#field-siteName', siteName)
  await saveDoc(page)

  await page.goto('/')
  await expect(page.locator('.site-header')).toContainText(siteName)
})

test('set a relationship from the admin', async ({ page }) => {
  const { doc } = await (
    await page.request.post('/api/posts', { data: { slug: uniqueSlug('rel'), title: 'Related post' } })
  ).json()

  await gotoAdmin(page, `/admin/collections/posts/${doc.id}?locale=en`)
  await page.getByRole('combobox', { name: 'Author' }).click()
  await page.locator('.rs__option', { hasText: admin.email }).click()
  await saveDoc(page, '#action-save')

  const saved = await (await page.request.get(`/api/posts/${doc.id}?depth=1`)).json()
  expect(saved.author.email).toBe(admin.email)
})
