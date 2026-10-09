import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const admin = { email: 'dev@payloadcms.com', password: 'test-password-123' }

/** Navigates and waits until the admin has hydrated, so clicks are not lost. */
export async function gotoAdmin(page: Page, path: string) {
  await page.goto(path)
  await waitForHydration(page)
}

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => window.__PAYLOAD_ADMIN_HYDRATED__ === true, null, { timeout: 60_000 })
}

/** Creates the first user if the database is empty. Idempotent. */
export async function ensureAdmin(request: APIRequestContext) {
  const init = await request.get('/api/users/init')
  const { initialized } = (await init.json()) as { initialized: boolean }
  if (!initialized) {
    const response = await request.post('/api/users/first-register', {
      data: { ...admin, confirmPassword: admin.password, role: 'admin' },
    })
    expect(response.ok()).toBeTruthy()
  }
}

/** Logs in through the REST API; the browser context receives the auth cookie. */
export async function login(page: Page) {
  await ensureAdmin(page.request)
  const response = await page.request.post('/api/users/login', { data: admin })
  expect(response.ok()).toBeTruthy()
}

/** Creates a post through the REST API and returns it. */
export async function createPost(
  request: APIRequestContext,
  data: Record<string, unknown>,
  { draft = false } = {},
) {
  const response = await request.post(`/api/posts${draft ? '?draft=true' : ''}`, { data })
  expect(response.ok(), await response.text()).toBeTruthy()
  return ((await response.json()) as { doc: { id: number; slug: string; title: string } }).doc
}

export const uniqueSlug = (prefix: string) => `${prefix}-${Date.now().toString(36)}`

/** Clicks a document save/publish button and waits for Payload's success toast. */
export async function saveDoc(page: Page, selector = '#action-save') {
  await page.click(selector)
  await expect(page.locator('.payload-toast-container')).toContainText('successfully')
  await closeToasts(page)
}

export async function closeToasts(page: Page) {
  const close = page.locator('.payload-toast-container button.payload-toast-close-button')
  while ((await close.count()) > 0) {
    const count = await close.count()
    await close.first().dispatchEvent('click')
    await expect.poll(() => close.count()).toBeLessThan(count)
  }
}

/** The Lexical editor of a rich text field. */
export const richText = (page: Page, label: string) => page.getByRole('textbox', { name: label })
