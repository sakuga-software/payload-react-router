import type { Block } from 'payload'

import { isSafeLink } from './links.ts'

export const HeroBlock: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}

export const ContentBlock: Block = {
  slug: 'content',
  interfaceName: 'ContentBlock',
  fields: [{ name: 'body', type: 'richText', required: true }],
}

export const MediaTextBlock: Block = {
  slug: 'mediaText',
  interfaceName: 'MediaTextBlock',
  fields: [
    { name: 'media', type: 'upload', relationTo: 'media', required: true },
    { name: 'body', type: 'richText' },
    {
      name: 'mediaPosition',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ],
    },
  ],
}

export const CallToActionBlock: Block = {
  slug: 'callToAction',
  interfaceName: 'CallToActionBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'text', type: 'textarea' },
    { name: 'buttonLabel', type: 'text', required: true },
    {
      name: 'buttonLink',
      type: 'text',
      required: true,
      validate: (value: unknown) => isSafeLink(value) || 'Use a path that starts with / or an http(s) URL.',
    },
  ],
}

export const pageBlocks = [HeroBlock, ContentBlock, MediaTextBlock, CallToActionBlock]
