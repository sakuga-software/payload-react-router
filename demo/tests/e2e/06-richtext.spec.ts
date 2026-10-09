import { expect, test } from '@playwright/test'

import { gotoAdmin, login, richText, saveDoc, uniqueSlug } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('Lexical content typed in the admin is rendered on the website', async ({ page }) => {
  const slug = uniqueSlug('lexical')
  const created = await page.request.post('/api/posts', {
    data: { _status: 'published', slug, title: 'Rich text post' },
  })
  const { doc } = await created.json()

  await gotoAdmin(page, `/admin/collections/posts/${doc.id}?locale=en`)
  const editor = richText(page, 'Content')
  await editor.click()
  await page.keyboard.type('Written in Lexical under React Router.')
  await saveDoc(page, '#action-save')

  await page.goto(`/posts/${slug}`)
  await expect(page.locator('article')).toContainText('Written in Lexical under React Router.')
})
