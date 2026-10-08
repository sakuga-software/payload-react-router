import assert from 'node:assert/strict'
import { test } from 'node:test'

import { payloadMiddleware } from '../src/server/middleware.ts'
import { getRequest, requestMemo } from '../src/server/requestStore.ts'
import { reactRouterServerAdapter } from '../src/server/serverAdapter.ts'

type MiddlewareArgs = Parameters<typeof payloadMiddleware>[0]
const argsFor = (request: Request) => ({ request }) as unknown as MiddlewareArgs

test('the middleware scopes the request and appends cookies set by Payload', async () => {
  const request = new Request('http://localhost/admin', { headers: { cookie: 'payload-token=abc' } })

  const response = await payloadMiddleware(argsFor(request), async () => {
    assert.equal(getRequest(), request)
    const store = reactRouterServerAdapter.getCookies() as { get: (n: string) => { value: string } | undefined }
    assert.equal(store.get('payload-token')?.value, 'abc')
    assert.equal((reactRouterServerAdapter.getHeaders() as Headers).get('cookie'), 'payload-token=abc')

    await reactRouterServerAdapter.setCookie('payload-lng', 'fr', { path: '/' })
    await reactRouterServerAdapter.setCookie('payload-theme', 'dark', { path: '/' })
    return new Response('ok', { headers: { 'Set-Cookie': 'existing=1' }, status: 201 })
  })

  assert.ok(response instanceof Response)
  assert.equal(response.status, 201)
  assert.equal(await response.text(), 'ok')
  assert.deepEqual(response.headers.getSetCookie(), ['existing=1', 'payload-lng=fr; Path=/', 'payload-theme=dark; Path=/'])
})

test('the middleware leaves the response untouched when no cookie was set', async () => {
  const original = new Response('ok')
  const response = await payloadMiddleware(argsFor(new Request('http://localhost/')), async () => original)
  assert.equal(response, original)
})

test('requests are isolated and memoization is per request', async () => {
  let calls = 0
  const create = async () => ++calls

  const run = (url: string) =>
    payloadMiddleware(argsFor(new Request(url)), async () => {
      const [a, b] = await Promise.all([requestMemo('k', create), requestMemo('k', create)])
      assert.equal(a, b)
      assert.equal(getRequest().url, url)
      return new Response(String(a))
    })

  const [first, second] = await Promise.all([run('http://localhost/1'), run('http://localhost/2')])
  assert.notEqual(await first!.text(), await second!.text())
  assert.equal(calls, 2)
})

test('a failed memoized call is retried within the same request', async () => {
  await payloadMiddleware(argsFor(new Request('http://localhost/')), async () => {
    await assert.rejects(requestMemo('flaky', async () => Promise.reject(new Error('boom'))))
    assert.equal(await requestMemo('flaky', async () => 'second try'), 'second try')
    return new Response('ok')
  })
})

test('outside the middleware the adapter explains how to install it', () => {
  assert.throws(() => getRequest(), /payloadMiddleware/)
})

test('navigation throws React Router responses with real statuses', () => {
  const thrown = (fn: () => unknown) => {
    try {
      fn()
    } catch (error) {
      return error as Response
    }
    throw new Error('expected a throw')
  }
  assert.equal(thrown(() => reactRouterServerAdapter.notFound()).status, 404)
  assert.equal(thrown(() => reactRouterServerAdapter.forbidden()).status, 403)
  assert.equal(thrown(() => reactRouterServerAdapter.unauthorized()).status, 401)
  const redirect = thrown(() => reactRouterServerAdapter.redirect('/admin/login'))
  assert.equal(redirect.status, 302)
  assert.equal(redirect.headers.get('Location'), '/admin/login')
  assert.equal(thrown(() => reactRouterServerAdapter.permanentRedirect('/x')).status, 308)
})
