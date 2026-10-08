import type { Logger, Plugin, PluginOption, UserConfig } from 'vite'

import path from 'node:path'
import { createLogger } from 'vite'

import {
  buildExternalPackages,
  payloadNoExternalPatterns,
  ssrExternalPackages,
} from './config/external.ts'
import { optimizeDepsExcludeDefaults, optimizeDepsIncludeDefaults } from './config/optimizeDeps.ts'
import { payloadScssImporters } from './config/scss.ts'
import { payloadDevConfigReload } from './devConfigReload.ts'
import { clientModuleResolution } from './workarounds/clientModuleResolution.ts'
import { reactDomServerInRsc } from './workarounds/reactDomServerInRsc.ts'
import { ssrStripDistStyleImports } from './workarounds/stripDistStyleImports.ts'
import { stubPrettierInClient } from './workarounds/stubPrettierInClient.ts'
import { terminateLastLineInRsc } from './workarounds/terminateLastLineInRsc.ts'
import { wrapCjsForClient } from './workarounds/wrapCjsForClient.ts'

export type PayloadVitePluginOptions = {
  /**
   * Extra packages kept external during `vite dev` only. List CommonJS deps that
   * fail with `__cjs_module_runner_transform` under the RSC plugin.
   */
  devServerExternalPackages?: string[]
  /** Path to `payload.config.ts`; aliased as `@payload-config`. */
  payloadConfigPath: string
  /** Drop Vite warnings about third-party sourcemaps. Defaults to `true`. */
  silenceDependencyWarnings?: boolean
}

const suppressibleWarningPatterns = [
  'points to missing source files',
  'Sourcemap for',
  'Failed to load source map',
  'references a map file outside its package',
]

function quietLogger(): Logger {
  const logger = createLogger()
  const shouldSuppress = (msg: string) =>
    suppressibleWarningPatterns.some((pattern) => msg.includes(pattern))
  const warn = logger.warn.bind(logger)
  const warnOnce = logger.warnOnce.bind(logger)
  logger.warn = (msg, options) => {
    if (!shouldSuppress(msg)) {
      warn(msg, options)
    }
  }
  logger.warnOnce = (msg, options) => {
    if (!shouldSuppress(msg)) {
      warnOnce(msg, options)
    }
  }
  return logger
}

const PUBLIC_ENV_PREFIXES = ['NEXT_PUBLIC_', 'PAYLOAD_PUBLIC_']

/**
 * Makes Payload's browser code safe to run without a `process` global:
 * - `process.cwd()` → `"/"` (shared modules call it);
 * - `process.env.X` → inlined value for `NEXT_PUBLIC_*` / `PAYLOAD_PUBLIC_*`,
 *   `undefined` otherwise — what Next.js does. `@payloadcms/ui`'s client bundle
 *   reads `process.env.NEXT_PUBLIC_ENABLE_ROUTER_CACHE_REFRESH`, which throws
 *   `ReferenceError: process is not defined` in a plain Vite client.
 *   `NODE_ENV` is left to Vite.
 */
function processInClient(): Plugin {
  return {
    name: 'payload:process-in-client',
    transform(code, id) {
      const envName = (this as unknown as { environment?: { name?: string } }).environment?.name
      if (envName !== 'client' || !code.includes('process.')) {
        return
      }
      if (id.includes('node_modules/.vite')) {
        return
      }
      const transformed = code
        .replace(/process\.cwd\(\)/g, '"/"')
        .replace(/process\.env\.([A-Z_][A-Z0-9_]*)/g, (match, name: string) => {
          if (name === 'NODE_ENV') {
            return match
          }
          const isPublic = PUBLIC_ENV_PREFIXES.some((prefix) => name.startsWith(prefix))
          return isPublic ? JSON.stringify(process.env[name]) ?? 'undefined' : 'undefined'
        })
      return transformed === code ? undefined : { code: transformed, map: null }
    },
  }
}

/**
 * Vite plugin that makes Payload's admin panel build and run under React
 * Router's RSC framework mode. Add it before React Router's plugins:
 *
 * ```ts
 * import { unstable_reactRouterRSC as reactRouterRSC } from '@react-router/dev/vite'
 * import rsc from '@vitejs/plugin-rsc'
 * import { payload } from 'payload-react-router/vite'
 *
 * export default defineConfig({
 *   plugins: [payload({ payloadConfigPath: './payload.config.ts' }), reactRouterRSC(), rsc()],
 * })
 * ```
 *
 * The config mirrors `withPayload` from `@payloadcms/tanstack-start`: the
 * `@payload-config` alias, SCSS importers, SSR externals, the optimizer
 * allow/deny lists, and the Vite-level workarounds (all framework-agnostic).
 */
export function payload(options: PayloadVitePluginOptions): PluginOption[] {
  const {
    devServerExternalPackages = [],
    payloadConfigPath,
    silenceDependencyWarnings = true,
  } = options

  const configPlugin: Plugin = {
    name: 'payload:config',
    config(_userConfig, env) {
      const isBuild = env.command === 'build'
      // `pluralize` ships a UMD wrapper that breaks under the dev SSR transform
      // (kept external in dev), but must be bundled in the build because pnpm
      // does not hoist it next to the server output.
      const noExternal = isBuild ? [...payloadNoExternalPatterns, 'pluralize'] : payloadNoExternalPatterns
      const external = isBuild
        ? buildExternalPackages
        : [...ssrExternalPackages, ...devServerExternalPackages]

      const serverEnvironment = {
        build: { rollupOptions: { external: buildExternalPackages } },
        resolve: { external, noExternal },
      }

      const config: UserConfig = {
        build: {
          // lightningcss fails on the nested `@keyframes` in Payload's CSS.
          cssMinify: 'esbuild',
        },
        css: {
          preprocessorOptions: {
            scss: {
              importers: payloadScssImporters,
              silenceDeprecations: ['import', 'global-builtin'],
            } as Record<string, unknown>,
          },
        },
        define: { global: 'globalThis' },
        environments: {
          rsc: serverEnvironment,
          ssr: serverEnvironment,
        },
        optimizeDeps: {
          exclude: optimizeDepsExcludeDefaults,
          include: optimizeDepsIncludeDefaults,
        },
        resolve: {
          alias: [{ find: '@payload-config', replacement: path.resolve(payloadConfigPath) }],
          dedupe: ['react', 'react-dom', 'scheduler', '@payloadcms/ui', '@payloadcms/richtext-lexical'],
        },
      }

      if (silenceDependencyWarnings) {
        config.customLogger = quietLogger()
      }

      return config
    },
  }

  return [
    configPlugin,
    clientModuleResolution(),
    wrapCjsForClient(),
    ssrStripDistStyleImports(),
    reactDomServerInRsc(),
    stubPrettierInClient(),
    terminateLastLineInRsc(),
    processInClient(),
    payloadDevConfigReload({ payloadConfigPath }),
  ]
}
