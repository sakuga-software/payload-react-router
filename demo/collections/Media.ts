import type { CollectionConfig } from 'payload'

import path from 'node:path'

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  fields: [{ name: 'alt', type: 'text', required: true }],
  upload: {
    // Anchored on the app directory; see payload.config.ts.
    staticDir: path.resolve(process.cwd(), 'media'),
  },
}
