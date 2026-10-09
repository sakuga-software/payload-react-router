const base = 'https://site.invalid'

/**
 * Accepts a site path (`/pricing`) or an http(s) URL. Rejects other schemes,
 * such as `javascript:`, and any value that a browser resolves to another
 * origin, such as `//host`, `/\host` or `/<tab>/host`.
 *
 * Browsers read `\` as `/` and remove tabs and newlines from URLs, so the
 * check refuses these characters before it resolves the value.
 */
export const isSafeLink = (value: unknown): value is string => {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f]/.test(value)) {
    return false
  }
  try {
    const url = new URL(value, base)
    if (value.startsWith('/')) {
      return url.origin === base
    }
    return /^https?:\/\//i.test(value) && (url.protocol === 'http:' || url.protocol === 'https:')
  } catch {
    return false
  }
}
