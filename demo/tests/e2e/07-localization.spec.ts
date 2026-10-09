import { expect, test } from '@playwright/test'

import { gotoAdmin, login, saveDoc, uniqueSlug } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('edit a localized field in a second locale', async ({ page }) => {
  const slug = uniqueSlug('i18n')
  const { doc } = await (
    await page.request.post('/api/pages', { data: { _status: 'published', slug, title: 'English title' } })
  ).json()

  await gotoAdmin(page, `/admin/collections/pages/${doc.id}`)
  await page.locator('.localizer .popup__trigger-wrap > button').click()
  await page
    .locator('.popup__content .popup-button-list__button')
    .filter({ has: page.locator('[data-locale="fr"]') })
    .click()
  await expect(page).toHaveURL(/locale=fr/)

  await page.fill('#field-title', 'Titre français')
  await saveDoc(page)

  const fr = await (await page.request.get(`/api/pages/${doc.id}?locale=fr`)).json()
  const en = await (await page.request.get(`/api/pages/${doc.id}?locale=en`)).json()
  expect(fr.title).toBe('Titre français')
  expect(en.title).toBe('English title')
})

test('switching the admin language sets the cookie through a server function', async ({ page, context }) => {
  await gotoAdmin(page, '/admin/account')
  await page.getByRole('combobox', { name: 'Language' }).click()
  await page.locator('.rs__option', { hasText: 'Français' }).click()

  await expect
    .poll(async () => (await context.cookies()).find((cookie) => cookie.name === 'payload-lng')?.value)
    .toBe('fr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

  // Restore English for the following specs.
  await context.addCookies([{ name: 'payload-lng', url: page.url(), value: 'en' }])
})
