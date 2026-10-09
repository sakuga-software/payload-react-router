import { expect, type APIRequestContext, test } from '@playwright/test'

import { gotoAdmin, login, uniqueSlug } from './helpers'

// In React Router's RSC mode, a server function is an endpoint that any POST can call, on any
// route: the route middleware and loaders do not protect it. Payload must refuse each call
// without a session by itself. These calls target a public website route on purpose.
const dataFunctions = (collectionSlug: string, id: number) =>
  [
    ['render-document', { collectionSlug, docID: id, redirectAfterCreate: false }],
    ['render-list', { collectionSlug, disableBulkDelete: true, query: { draft: true } }],
    ['table-state', { collectionSlug, columns: [], query: { draft: 'true' }, renderRowTypes: true }],
    ['form-state', { collectionSlug, id, operation: 'update', renderAllFields: true, schemaPath: collectionSlug }],
    ['copy-data-from-locale', { collectionSlug, docID: id, fromLocale: 'en', overrideData: true, toLocale: 'fr' }],
  ] as const

const callServerFunction = (request: APIRequestContext, actionId: string, name: string, args: object) =>
  request.post('/', {
    headers: { accept: 'text/x-component', 'rsc-action-id': actionId },
    multipart: { '_1_$SKIP_REVALIDATION': '1', 0: JSON.stringify([{ args, name }]) },
  })

test('server functions return no data without a session, even from a public route', async ({ page, request }) => {
  await login(page)
  const secret = `SECRET-${uniqueSlug('draft')}`
  const created = await page.request.post('/api/pages?draft=true', {
    data: { _status: 'draft', layout: [{ blockType: 'hero', heading: secret }], slug: uniqueSlug('secret'), title: secret },
  })
  const { doc } = (await created.json()) as { doc: { id: number } }

  // The action id comes from a real call that the admin makes.
  const actionRequest = page.waitForRequest((r) => Boolean(r.headers()['rsc-action-id']?.endsWith('#serverFunction')))
  await gotoAdmin(page, `/admin/collections/pages/${doc.id}`)
  await page.fill('#field-title', `${secret} edited`)
  const actionId = (await actionRequest).headers()['rsc-action-id']!

  for (const [name, args] of dataFunctions('pages', doc.id)) {
    const asAdmin = await (await callServerFunction(page.request, actionId, name, args)).text()
    const anonymous = await (await callServerFunction(request, actionId, name, args)).text()
    // The admin call proves that the request is well formed and reaches the data.
    if (name !== 'form-state') {
      expect(asAdmin, `${name} as admin`).toContain(secret)
    }
    expect(anonymous, `${name} without a session`).not.toContain(secret)
  }
})
