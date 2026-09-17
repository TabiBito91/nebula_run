import { test, expect } from '@playwright/test'

test('graphics loss pauses flight, restores safely and retains diagnostic evidence', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  await page.keyboard.press('Enter')
  await page.keyboard.down('Space')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().score >= 100)
  await page.keyboard.up('Space')
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!
    const extension = gl.getExtension('WEBGL_lose_context')!
    ;(window as unknown as { restoreGraphics: () => void }).restoreGraphics = () => extension.restoreContext()
    extension.loseContext()
  })
  await expect(page.getByRole('alert')).toContainText('Graphics connection interrupted')
  const stopped = await page.evaluate(() => window.__GAME_INSPECTOR__!.getState())
  expect(stopped.graphicsState).toBe('lost')
  expect(stopped.paused).toBe(true)
  await page.keyboard.press('KeyP')
  expect(await page.evaluate(() => window.__GAME_INSPECTOR__!.getState().paused)).toBe(true)
  await page.evaluate(() => (window as unknown as { restoreGraphics: () => void }).restoreGraphics())
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().graphicsState === 'ready')
  const restored = await page.evaluate(() => window.__GAME_INSPECTOR__!.getState())
  expect(restored.missionElapsedTime).toBe(stopped.missionElapsedTime)
  expect(restored.paused).toBe(true)
  await page.keyboard.press('KeyP')
  await page.waitForFunction(t => window.__GAME_INSPECTOR__!.getState().missionElapsedTime > t + .2, stopped.missionElapsedTime)
  await page.screenshot({ path: 'test-results/graphics-restored.png' })
  await page.reload()
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  expect(JSON.stringify(await page.evaluate(() => window.__GAME_INSPECTOR__!.getState().previousFlightDiagnostic))).toContain('WebGL context lost')
})

test('frame exception presents reload action and saves evidence', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2')!
    gl.drawElements = () => { throw new Error('Injected rendering failure') }
  })
  await expect(page.getByRole('alert')).toContainText('Flight stopped')
  expect(await page.evaluate(() => localStorage.getItem('nebula-run:last-flight'))).toContain('Injected rendering failure')
  await page.getByRole('button', { name: 'Reload game' }).click()
  await expect(page.getByRole('button', { name: 'LAUNCH SORTIE' })).toBeVisible()
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().graphicsState === 'ready')
})
