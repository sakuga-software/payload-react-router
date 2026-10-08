import type { CookieOptions } from 'payload'

/** Serializes one `Set-Cookie` value from Payload's `CookieOptions`. */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  if (options.path) {
    cookie += `; Path=${options.path}`
  }
  if (options.domain) {
    cookie += `; Domain=${options.domain}`
  }
  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`
  }
  if (options.httpOnly) {
    cookie += '; HttpOnly'
  }
  if (options.secure) {
    cookie += '; Secure'
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`
  }

  return cookie
}
