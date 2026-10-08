import type { PluginOption } from 'vite'

const SOURCE_EXTENSION_RE = /\.[mc]?[jt]sx?(?:$|\?)/

/**
 * Adds the missing final newline to server modules in the RSC environment.
 *
 * `@vitejs/plugin-rsc` (0.5.35) wraps each server component that imports CSS:
 * it appends `X = __vite_rsc_wrap_css__(X, "X")` to the end of the module. It
 * appends this line without a newline before it. The compiled files of
 * `@payloadcms/ui` end with `//# sourceMappingURL=index.js.map` and no newline,
 * so the appended line becomes part of that comment. The wrapper then never
 * runs, and the production build loads no CSS for these components (templates,
 * `Nav`, account settings). Vite dev collects CSS from the module graph and
 * does not show the problem.
 *
 * This plugin must run before `@vitejs/plugin-rsc`, so it uses `enforce: 'pre'`.
 *
 * Delete it after `@vitejs/plugin-rsc` puts a newline before the appended code.
 */
export function terminateLastLineInRsc(): PluginOption {
  return {
    name: 'payload:terminate-last-line-in-rsc',
    enforce: 'pre',
    transform(code, id) {
      const envName = (this as unknown as { environment?: { name?: string } }).environment?.name
      if (envName !== 'rsc' || !SOURCE_EXTENSION_RE.test(id) || code.endsWith('\n')) {
        return
      }
      return { code: `${code}\n`, map: null }
    },
  }
}
