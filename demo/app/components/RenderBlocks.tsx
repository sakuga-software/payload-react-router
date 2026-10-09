import { RichText } from '@payloadcms/richtext-lexical/react'

import { isSafeLink } from '../../collections/links'
import type { Media, Page } from '../../payload-types'

type LayoutBlock = NonNullable<Page['layout']>[number]

const mediaOf = (value: unknown): Media | null =>
  value && typeof value === 'object' && 'url' in value ? (value as Media) : null

function Image({ media }: { media: Media | null }) {
  if (!media?.url) {
    return null
  }
  return <img alt={media.alt} height={media.height ?? undefined} src={media.url} width={media.width ?? undefined} />
}

function Block({ block }: { block: LayoutBlock }) {
  switch (block.blockType) {
    case 'hero':
      return (
        <section className="block-hero">
          <h1>{block.heading}</h1>
          {block.subheading ? <p>{block.subheading}</p> : null}
          <Image media={mediaOf(block.image)} />
        </section>
      )
    case 'content':
      return <section className="block-content">{block.body ? <RichText data={block.body} /> : null}</section>
    case 'mediaText':
      return (
        <section className={`block-media-text block-media-text--${block.mediaPosition ?? 'left'}`}>
          <Image media={mediaOf(block.media)} />
          <div>{block.body ? <RichText data={block.body} /> : null}</div>
        </section>
      )
    case 'callToAction':
      return (
        <section className="block-cta">
          <h2>{block.heading}</h2>
          {block.text ? <p>{block.text}</p> : null}
          {/* The field validates the link. This check also covers rows written before the validation. */}
          {isSafeLink(block.buttonLink) ? <a href={block.buttonLink}>{block.buttonLabel}</a> : null}
        </section>
      )
  }
}

export function RenderBlocks({ blocks }: { blocks: Page['layout'] }) {
  return <>{blocks?.map((block, index) => <Block block={block} key={block.id ?? index} />)}</>
}
