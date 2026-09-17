import { test as base, expect, type Page } from '@playwright/test'
import type { Snapshot } from '../src/game/debug/inspector'
import { writeFile } from 'node:fs/promises'

export const test = base.extend<{ audit: string[] }>({
  audit: [async ({ page }, use, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(`page: ${error.message}`))
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
    page.on('requestfailed', request => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`network: ${request.url()} ${request.failure()?.errorText}`)
    })
    page.on('response', response => { if (response.status() >= 400) errors.push(`http: ${response.status()} ${response.url()}`) })
    await use(errors)
    if (!page.isClosed()) {
      const state = await page.evaluate(() => window.__GAME_INSPECTOR__?.getState()).catch(() => null)
      await writeFile(info.outputPath('inspection.json'), JSON.stringify({ state, errors }, null, 2))
      await info.attach('inspection-state', { body: JSON.stringify(state, null, 2), contentType: 'application/json' })
      await info.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' })
      expect(errors, 'Unexpected browser errors').toEqual([])
      if (state) expect(state.capturedErrors).toEqual([])
    }
  }, { auto: true }],
})
export { expect }
export const state = (page: Page): Promise<Snapshot> => page.evaluate(() => window.__GAME_INSPECTOR__!.getState())
export async function scene(page: Page, name: string) {
  await page.goto(`/?testScene=${name}`)
  await page.waitForFunction(expected => {
    const s = window.__GAME_INSPECTOR__?.getState()
    return s?.ready && s.pendingAssets === 0 && s.activeScene === expected
  }, name)
}
export async function resume(page: Page) { await page.keyboard.press('KeyP') }
export async function elapsed(page: Page, time: number, timeout = 10_000) {
  await page.waitForFunction(t => window.__GAME_INSPECTOR__!.getState().missionElapsedTime >= t, time, { timeout })
}
