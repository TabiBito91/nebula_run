import { defineConfig } from '@playwright/test'

const production = process.argv.some(arg => arg.includes('production'))
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 30_000,
  expect: { timeout: 7000 }, outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    browserName: 'chromium', viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'retain-on-failure',
    launchOptions: { args: ['--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] },
  },
  projects: [
    { name: 'game', testIgnore: '**/production.spec.ts', use: { baseURL: 'http://127.0.0.1:5173' } },
    { name: 'production', testMatch: '**/production.spec.ts', use: { baseURL: 'http://127.0.0.1:4173' } },
  ],
  webServer: {
    command: production ? 'npm run preview' : 'npm run dev',
    url: production ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI, timeout: 30_000,
  },
})
