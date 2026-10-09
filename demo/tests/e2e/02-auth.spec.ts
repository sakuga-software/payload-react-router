import { expect, test } from '@playwright/test'

import { admin, ensureAdmin, gotoAdmin } from './helpers'

test.beforeAll(async ({ request }) => {
  await ensureAdmin(request)
})

test('unauthenticated admin routes redirect to login with a return path', async ({ page }) => {
  const response = await page.request.get('/admin/collections/posts', { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  expect(response.headers().location).toBe('/admin/login?redirect=%2Fadmin%2Fcollections%2Fposts')
})

test('login rejects a wrong password', async ({ page }) => {
  await gotoAdmin(page, '/admin/login')
  await page.fill('#field-email', admin.email)
  await page.fill('#field-password', 'wrong-password')
  await page.click('.form-submit button')
  await expect(page.locator('.payload-toast-container')).toContainText(/incorrect/i)
  await expect(page).toHaveURL(/\/admin\/login/)
})

test('login, account page and logout', async ({ page, context }) => {
  await gotoAdmin(page, '/admin/login?redirect=%2Fadmin%2Faccount')
  await page.fill('#field-email', admin.email)
  await page.fill('#field-password', admin.password)
  await page.click('.form-submit button')

  await expect(page).toHaveURL(/\/admin\/account$/)
  await expect(page.locator('#field-email')).toHaveValue(admin.email)
  expect((await context.cookies()).some((cookie) => cookie.name === 'payload-token')).toBe(true)

  await gotoAdmin(page, '/admin/logout')
  await expect(page).toHaveURL(/\/admin\/login/)
  await expect
    .poll(async () => (await context.cookies()).some((cookie) => cookie.name === 'payload-token'))
    .toBe(false)
})
