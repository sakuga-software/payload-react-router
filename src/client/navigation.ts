/**
 * Turns the targets Payload hands the router into an in-app path:
 * same-origin absolute URLs, bare `?query` and bare `#hash`.
 */
export function normalizeNavigationTarget(
  target: string,
  current: { origin: string; pathname: string; search: string },
): string {
  if (/^https?:\/\//.test(target)) {
    const url = new URL(target)
    return url.origin === current.origin ? `${url.pathname}${url.search}${url.hash}` : target
  }
  if (target.startsWith('?')) {
    return `${current.pathname}${target}`
  }
  if (target.startsWith('#')) {
    return `${current.pathname}${current.search}${target}`
  }
  return target
}

/** Maps `params['*']` of the `admin/*` splat onto Next's `segments` shape. */
export function toAdminParams(
  params: Record<string, string | undefined>,
): Record<string, string | string[]> {
  const adapted: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      adapted[key] = value
    }
  }
  if (typeof params['*'] === 'string') {
    adapted.segments = params['*'].split('/').filter(Boolean)
  }
  return adapted
}
