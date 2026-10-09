'use client'

import { useLivePreview } from '@payloadcms/live-preview-react'
import { RichText } from '@payloadcms/richtext-lexical/react'

import type { Page, Post } from '../../payload-types'

import { RenderBlocks } from './RenderBlocks'

type LiveProps<T> = { initialData: T; serverURL: string }

/**
 * Renders a page. In the admin's live preview iframe, the hook replaces the
 * loader data with the unsaved form state that the admin posts at each change.
 */
export function LivePage({ initialData, serverURL }: LiveProps<Page>) {
  const { data: page } = useLivePreview({ depth: 1, initialData, serverURL })
  return (
    <article className="page">
      <title>{page.title}</title>
      <RenderBlocks blocks={page.layout} />
    </article>
  )
}

export function LivePost({ initialData, serverURL }: LiveProps<Post>) {
  const { data: post } = useLivePreview({ depth: 1, initialData, serverURL })
  return (
    <article>
      <title>{post.title}</title>
      <h1>{post.title}</h1>
      {post.publishedAt ? <time dateTime={post.publishedAt}>{post.publishedAt.slice(0, 10)}</time> : null}
      {post.content ? <RichText data={post.content} /> : null}
    </article>
  )
}
