type DevElement = {
  $$typeof: symbol
  _payload?: { status?: string; value?: unknown }
  _store?: { validated?: number }
  props?: { children?: unknown }
}

const lazyType = Symbol.for('react.lazy')

/**
 * Marks the elements of a decoded tree as key-validated, in development only.
 *
 * React validates the keys of list children when it first creates the elements, here in
 * `renderToCompletion`, and it warns on the server console if a key is missing. Decoding the
 * Flight stream sets the validation flag back to 0 on some elements. React Router then sends the
 * tree to the browser a second time, and React logs "Each child in a list should have a unique
 * key" for lists that were valid. Payload's e2e harness fails a test on that console error.
 */
export function markKeysValidated(node: unknown, seen = new Set<unknown>()): void {
  if (!node || typeof node !== 'object' || seen.has(node)) {
    return
  }
  seen.add(node)
  if (Array.isArray(node)) {
    for (const child of node) {
      markKeysValidated(child, seen)
    }
    return
  }
  const element = node as DevElement
  if (typeof element.$$typeof !== 'symbol') {
    return
  }
  if (element.$$typeof === lazyType) {
    if (element._payload?.status === 'fulfilled') {
      markKeysValidated(element._payload.value, seen)
    }
    return
  }
  if (element._store && element._store.validated === 0) {
    element._store.validated = 1
  }
  markKeysValidated(element.props?.children, seen)
}
