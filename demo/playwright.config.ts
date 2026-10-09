import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end bench for the React Router adapter.
 *
 * By default it runs against the production build (`pnpm build` first), on a
 * throwaway SQLite database created by the production migrations on boot.
 * `E2E_MODE=dev` runs the same suite against `vite dev` instead.
 */
const mode = process.env.E2E_MODE === 'dev' ? 'dev' : 'prod'
const port = Number(process.env.E2E_PORT ?? 3100)
const database = `file:./e2e-${mode}.db`

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use the preinstalled browser when the matching Playwright build is absent.
        launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
      },
    },
  ],
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]] : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      mode === 'dev'
        ? `rm -f e2e-dev.db* && pnpm exec react-router dev --port ${port} --strictPort`
        : `rm -f e2e-prod.db* && pnpm exec react-router-serve ./build/server/index.js`,
    env: {
      DATABASE_URI: database,
      NODE_ENV: mode === 'dev' ? 'development' : 'production',
      PAYLOAD_SECRET: 'e2e-secret',
      PORT: String(port),
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: `http://localhost:${port}/api/users/me`,
  },
  // One shared database: specs build on each other and must not interleave.
  workers: 1,
})
