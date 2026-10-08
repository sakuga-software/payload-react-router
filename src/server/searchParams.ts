export type SearchParams = Record<string, string | string[]>

/**
 * `URL.searchParams` in the shape Payload views expect (Next's `searchParams`):
 * a repeated key becomes an array, a single one stays a string.
 */
export function toSearchParams(url: URL): SearchParams {
  const result: SearchParams = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    result[key] = values.length > 1 ? values : values[0]!
  }
  return result
}
