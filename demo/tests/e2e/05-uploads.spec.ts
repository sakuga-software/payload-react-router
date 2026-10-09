import path from 'node:path'

import { expect, test } from '@playwright/test'

import { gotoAdmin, login, saveDoc } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('upload an image to local storage and serve it back', async ({ page }) => {
  await gotoAdmin(page, '/admin/collections/media/create')
  await page.setInputFiles('input[type="file"]', path.resolve(import.meta.dirname, '../fixtures/image.png'))
  await page.fill('#field-alt', 'A generated test image')
  await saveDoc(page)
  await expect(page).toHaveURL(/\/admin\/collections\/media\/\d+$/)

  const id = page.url().split('/').pop()
  const doc = await (await page.request.get(`/api/media/${id}`)).json()
  expect(doc.mimeType).toBe('image/png')

  const file = await page.request.get(doc.url)
  expect(file.status()).toBe(200)
  expect(file.headers()['content-type']).toContain('image/png')
})
