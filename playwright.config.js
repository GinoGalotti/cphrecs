import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8788',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Requires local D1 to be seeded first:
  //   npx wrangler d1 execute ginogalotti-stories --local --file=schema.sql
  //   node scripts/seed.mjs
  //   npx wrangler d1 execute ginogalotti-stories --local --file=seed.sql
  webServer: {
    command: 'npx wrangler pages dev . --port 8788',
    url: 'http://localhost:8788',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
