import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: { read: () => true },
  fields: [
    { name: 'siteName', type: 'text', defaultValue: 'Payload × React Router', required: true },
    { name: 'tagline', type: 'text', localized: true },
  ],
}
