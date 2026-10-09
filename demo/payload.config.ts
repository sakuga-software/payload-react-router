import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { fr } from '@payloadcms/translations/languages/fr'
import path from 'node:path'
import { buildConfig } from 'payload'

import { Media } from './collections/Media.ts'
import { Pages } from './collections/Pages.ts'
import { Posts } from './collections/Posts.ts'
import { SiteSettings } from './collections/SiteSettings.ts'
import { Users } from './collections/Users.ts'
import { migrations } from './migrations/index.ts'

const dirname = import.meta.dirname
// Runtime paths are anchored on the app directory, not on this module: in the
// production build this file is bundled into build/server/, where
// `import.meta.dirname` would put the database next to the bundle.
const appDir = process.cwd()

export default buildConfig({
  admin: {
    importMap: {
      baseDir: dirname,
      // The Payload CLI only knows the Next.js and TanStack Start folder
      // conventions, so the import map location is explicit.
      importMapFile: path.resolve(dirname, 'app/routes/payload/importMap.js'),
    },
    user: Users.slug,
  },
  collections: [Users, Posts, Pages, Media],
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URI || `file:${path.resolve(appDir, 'payload.db')}` },
    // Dev pushes the schema automatically; production applies migrations on boot.
    prodMigrations: migrations,
  }),
  editor: lexicalEditor(),
  globals: [SiteSettings],
  // Admin UI languages (switchable per user from the account page).
  i18n: { supportedLanguages: { en, fr } },
  localization: {
    defaultLocale: 'en',
    fallback: true,
    locales: [
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
    ],
  },
  secret: process.env.PAYLOAD_SECRET || 'dev-only-secret-change-me',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
