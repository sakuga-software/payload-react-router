import type { MetaConfig } from 'payload'

export type AdminPageIcon = {
  media?: string
  rel: string
  sizes?: string
  type?: string
  url: string
}

export type AdminPageImage = {
  alt?: string
  height?: number
  url: string
  width?: number
}

/**
 * Plain, serializable page metadata of an admin view. {@link AdminPage} renders it as `<title>`,
 * `<meta>` and `<link>` tags, and React hoists them into the document `<head>`.
 */
export type AdminPageMeta = {
  description?: string
  icons?: AdminPageIcon[]
  keywords?: string
  openGraph?: {
    description?: string
    images?: AdminPageImage[]
    siteName?: string
    title?: string
  }
  robots?: string
  title?: string
}

/**
 * Flattens Payload's `MetaConfig` (the Next.js `Metadata` shape that `generatePageMetadata`
 * returns) into {@link AdminPageMeta}. Ported from `toAdminPageMetadata` in
 * `@payloadcms/tanstack-start` (MIT), so both adapters render the same tags.
 */
export function toAdminPageMeta(meta: MetaConfig): AdminPageMeta {
  const og = meta.openGraph as
    | { description?: unknown; images?: unknown; siteName?: unknown; title?: unknown }
    | undefined

  const rawImages = og?.images
  const images = (rawImages ? (Array.isArray(rawImages) ? rawImages : [rawImages]) : [])
    .map((image: unknown): AdminPageImage | undefined => {
      if (typeof image === 'string') {
        return { url: image }
      }
      const value = image as { alt?: string; height?: number; url?: unknown; width?: number } | null
      return value?.url
        ? { alt: value.alt, height: value.height, url: String(value.url), width: value.width }
        : undefined
    })
    .filter((image): image is AdminPageImage => Boolean(image))

  const rawIcons = meta.icons as unknown
  const iconList: unknown[] = Array.isArray(rawIcons)
    ? rawIcons
    : rawIcons && typeof rawIcons === 'object' && Array.isArray((rawIcons as { icon?: unknown }).icon)
      ? ((rawIcons as { icon: unknown[] }).icon)
      : []
  const icons = iconList
    .map((icon): AdminPageIcon | undefined => {
      if (typeof icon === 'string') {
        return { rel: 'icon', url: icon }
      }
      const value = icon as { media?: string; rel?: string; sizes?: string; type?: string; url?: unknown } | null
      return value?.url
        ? { media: value.media, rel: value.rel ?? 'icon', sizes: value.sizes, type: value.type, url: String(value.url) }
        : undefined
    })
    .filter((icon): icon is AdminPageIcon => Boolean(icon))

  const { keywords } = meta

  return {
    description: typeof meta.description === 'string' ? meta.description : undefined,
    icons: icons.length ? icons : undefined,
    keywords: typeof keywords === 'string' ? keywords : Array.isArray(keywords) ? keywords.join(', ') : undefined,
    openGraph: og
      ? {
          description: typeof og.description === 'string' ? og.description : undefined,
          images: images.length ? images : undefined,
          siteName: typeof og.siteName === 'string' ? og.siteName : undefined,
          title: typeof og.title === 'string' ? og.title : undefined,
        }
      : undefined,
    robots: typeof meta.robots === 'string' ? meta.robots : undefined,
    title: resolveTitle(meta.title),
  }
}

function resolveTitle(title: MetaConfig['title']): string | undefined {
  if (!title) {
    return undefined
  }
  if (typeof title === 'string') {
    return title
  }
  if ('absolute' in title) {
    return title.absolute
  }
  return title.default
}
