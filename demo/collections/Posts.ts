import type { CollectionConfig } from 'payload'

import { livePreviewAt } from './livePreview.ts'

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    // Anonymous visitors only ever see published posts — the same invariant the
    // other backends in this repo enforce on both list and single-post queries.
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
  },
  admin: {
    defaultColumns: ['title', 'slug', 'publishedAt', '_status'],
    livePreview: livePreviewAt('/posts/'),
    useAsTitle: 'title',
  },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'excerpt', type: 'textarea', localized: true },
    { name: 'publishedAt', type: 'date' },
    { name: 'cover', type: 'upload', relationTo: 'media' },
    { name: 'tags', type: 'text', hasMany: true },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    { name: 'content', type: 'richText', localized: true },
  ],
  versions: {
    drafts: { autosave: { interval: 800 } },
    maxPerDoc: 20,
  },
}
