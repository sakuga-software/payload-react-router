import type { CollectionConfig } from 'payload'

type LivePreviewConfig = NonNullable<NonNullable<CollectionConfig['admin']>['livePreview']>

/**
 * Returns the live preview config for a collection whose documents render at
 * `prefix + slug` on the website. The iframe and the admin share one origin,
 * so the URL takes its origin from the admin request.
 */
export const livePreviewAt = (prefix: string): LivePreviewConfig => ({
  url: ({ data, req }) => {
    if (typeof data?.slug !== 'string' || !data.slug) {
      return null
    }
    const origin = req.url ? new URL(req.url).origin : ''
    return `${origin}${prefix}${encodeURIComponent(data.slug)}`
  },
})
