import { expect, test } from '@playwright/test'

import { admin, gotoAdmin } from './helpers'

test('an empty database sends /admin to create-first-user, which signs in', async ({ page }) => {
  const init = await page.request.get('/api/users/init')
  test.skip(((await init.json()) as { initialized: boolean }).initialized, 'database already has a user')

  await gotoAdmin(page, '/admin')
  await expect(page).toHaveURL(/\/admin\/create-first-user$/)

  await page.fill('#field-email', admin.email)
  await page.fill('#field-password', admin.password)
  await page.fill('#field-confirm-password', admin.password)
  // A click during the form-state request that the fills start is lost.
  await page.waitForLoadState('networkidle')
  await page.click('.form-submit button')

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.locator('.dashboard')).toBeVisible()
})
