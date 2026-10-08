import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPageRenderServerAdapter, type PageNavIntent } from '../src/server/serverAdapter.ts'

// DocumentView (in @payloadcms/ui) recognises exactly these two messages; the
// adapter must keep throwing them while it records the intent.
test('page-render navigation records the intent and throws the neutral errors', () => {
  const nav: PageNavIntent = {}
  const adapter = createPageRenderServerAdapter(nav)

  assert.throws(() => adapter.redirect('/admin/collections/posts/1'), { message: 'redirect:/admin/collections/posts/1' })
  assert.deepEqual(nav, { type: 'redirect', url: '/admin/collections/posts/1' })

  assert.throws(() => adapter.notFound(), { message: 'not-found' })
  assert.equal(nav.type, 'notFound')
})
