import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.browser.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome', viewport: { width: 2376, height: 1332 } },
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
})
