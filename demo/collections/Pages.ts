import type { CollectionConfig } from 'payload'

import { pageBlocks } from './blocks.ts'
import { livePreviewAt } from './livePreview.ts'

// Pages render at /:slug, so a slug must not take the path of another route.
const reservedSlugs = new Set(['admin', 'api', 'posts'])

const validateSlug = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return 'Use lowercase letters, digits and single hyphens.'
  }
  return reservedSlugs.has(value) ? `"${value}" is the path of another route.` : true
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    // Anonymous visitors only see published pages, like posts.
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
  },
  admin: {
    defaultColumns: ['title', 'slug', '_status'],
    livePreview: livePreviewAt('/'),
    useAsTitle: 'title',
  },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true, validate: validateSlug },
    { name: 'layout', type: 'blocks', blocks: pageBlocks, localized: true },
  ],
  versions: {
    drafts: { autosave: { interval: 800 } },
    maxPerDoc: 20,
  },
}
