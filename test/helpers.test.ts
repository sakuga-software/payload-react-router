import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeNavigationTarget, toAdminParams } from '../src/client/navigation.ts'
import { serializeCookie } from '../src/server/cookies.ts'
import { toSearchParams } from '../src/server/searchParams.ts'

const current = { origin: 'http://localhost:3000', pathname: '/admin/collections/posts', search: '?page=2' }

test('navigation targets: same-origin URLs become paths, foreign URLs stay absolute', () => {
  assert.equal(normalizeNavigationTarget('http://localhost:3000/admin/a?b=1#c', current), '/admin/a?b=1#c')
  assert.equal(normalizeNavigationTarget('https://example.com/x', current), 'https://example.com/x')
})

test('navigation targets: bare query and hash resolve against the current location', () => {
  assert.equal(normalizeNavigationTarget('?search=x', current), '/admin/collections/posts?search=x')
  assert.equal(normalizeNavigationTarget('#top', current), '/admin/collections/posts?page=2#top')
  assert.equal(normalizeNavigationTarget('/admin', current), '/admin')
})

test('admin params: the splat becomes Next-style segments', () => {
  assert.deepEqual(toAdminParams({ '*': 'collections/posts/1' }), {
    '*': 'collections/posts/1',
    segments: ['collections', 'posts', '1'],
  })
  assert.deepEqual(toAdminParams({ '*': '' }), { '*': '', segments: [] })
  assert.deepEqual(toAdminParams({ id: undefined, slug: 'a' }), { slug: 'a' })
})

test('search params: repeated keys become arrays, bracket keys are preserved', () => {
  const url = new URL('http://x/admin?locale=fr&tags=a&tags=b&where%5Btitle%5D%5Bequals%5D=hi')
  assert.deepEqual(toSearchParams(url), {
    locale: 'fr',
    tags: ['a', 'b'],
    'where[title][equals]': 'hi',
  })
})

test('cookies: every Payload CookieOptions field is serialized', () => {
  const expires = new Date('2030-01-01T00:00:00Z')
  assert.equal(
    serializeCookie('payload-lng', 'fr', {
      domain: 'example.com',
      expires,
      httpOnly: true,
      maxAge: 31536000.9,
      path: '/',
      sameSite: 'lax',
      secure: true,
    }),
    'payload-lng=fr; Path=/; Domain=example.com; Max-Age=31536000; Expires=Tue, 01 Jan 2030 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
  )
  assert.equal(serializeCookie('a b', 'c;d'), 'a%20b=c%3Bd')
})

test('markKeysValidated sets the dev validation flag through arrays and resolved lazy nodes', async () => {
  const { markKeysValidated } = await import('../src/server/markKeysValidated.ts')
  const element = Symbol.for('react.transitional.element')
  const leaf = () => ({ $$typeof: element, _store: { validated: 0 }, props: {} })
  const inArray = leaf()
  const inLazy = leaf()
  const tree = {
    $$typeof: element,
    _store: { validated: 1 },
    props: {
      children: [
        inArray,
        { $$typeof: Symbol.for('react.lazy'), _payload: { status: 'fulfilled', value: [inLazy] } },
      ],
    },
  }
  markKeysValidated(tree)
  assert.equal(inArray._store.validated, 1)
  assert.equal(inLazy._store.validated, 1)
})
