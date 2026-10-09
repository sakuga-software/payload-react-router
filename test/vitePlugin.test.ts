import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'

import type { Plugin, UserConfig } from 'vite'

import { payload } from '../src/vite/index.ts'

const plugins = () => payload({ payloadConfigPath: './payload.config.ts' }).flat() as Plugin[]
const byName = (name: string) => {
  const plugin = plugins().find((p) => p.name === name)
  assert.ok(plugin, `plugin ${name} is registered`)
  return plugin
}

const callConfig = (command: 'build' | 'serve') => {
  const hook = byName('payload:config').config as (c: UserConfig, e: { command: string; mode: string }) => UserConfig
  return hook({}, { command, mode: command === 'build' ? 'production' : 'development' })
}

test('aliases @payload-config to the configured file', () => {
  const config = callConfig('serve')
  const alias = (config.resolve?.alias as { find: string; replacement: string }[])[0]
  assert.deepEqual(alias, { find: '@payload-config', replacement: path.resolve('./payload.config.ts') })
})

test('bundles pluralize in builds but keeps it external in dev', () => {
  const dev = callConfig('serve').environments!.rsc!.resolve!
  const build = callConfig('build').environments!.rsc!.resolve!
  assert.ok((dev.external as string[]).includes('pluralize'))
  assert.ok((build.noExternal as (string | RegExp)[]).includes('pluralize'))
  assert.ok(!(build.external as string[]).includes('pluralize'))
})

test('client transform inlines public env vars and neutralises the rest', () => {
  process.env.NEXT_PUBLIC_FLAG = 'on'
  const transform = byName('payload:process-in-client').transform as (
    this: unknown,
    code: string,
    id: string,
  ) => { code: string } | undefined
  const run = (env: string, code: string) => transform.call({ environment: { name: env } }, code, '/app/x.js')

  const out = run(
    'client',
    'a(process.env.NEXT_PUBLIC_FLAG, process.env.SECRET, process.env.NODE_ENV, process.cwd())',
  )
  assert.equal(out?.code, 'a("on", undefined, process.env.NODE_ENV, "/")')
  assert.equal(run('rsc', 'process.env.SECRET'), undefined)
  assert.equal(run('client', 'nothing here'), undefined)
})

test('RSC transform ends a module without a final newline with one', () => {
  const transform = byName('payload:terminate-last-line-in-rsc').transform as (
    this: unknown,
    code: string,
    id: string,
  ) => { code: string } | undefined
  const run = (env: string, code: string, id = '/node_modules/@payloadcms/ui/dist/templates/Minimal/index.js') =>
    transform.call({ environment: { name: env } }, code, id)

  const code = 'export const A = () => null;\n//# sourceMappingURL=index.js.map'
  assert.equal(run('rsc', code)?.code, `${code}\n`)
  assert.equal(run('rsc', `${code}\n`), undefined)
  assert.equal(run('client', code), undefined)
  assert.equal(run('rsc', code, '/node_modules/@payloadcms/ui/dist/templates/Minimal/index.css'), undefined)
})

test('the browser dependency optimizer replaces process.env, the server ones do not', () => {
  const config = callConfig('serve')
  const plugins = config.environments!.client!.optimizeDeps!.rolldownOptions!.plugins as unknown as {
    transform: (code: string) => { code: string } | undefined
  }[]
  assert.equal(
    plugins[0]!.transform('var b = process.env.__NEXT_ROUTER_BASEPATH || ""')?.code,
    'var b = undefined || ""',
  )
  assert.equal(config.environments!.rsc!.optimizeDeps, undefined)
  assert.equal(config.environments!.ssr!.optimizeDeps, undefined)
})
