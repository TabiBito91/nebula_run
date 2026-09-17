import { test, expect } from '@playwright/test'

test('missing file records failure and procedural music remains playable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/audio/__missing-test__.wav', route => route.fulfill({ status: 404, body: 'Missing test asset' }))
  await page.goto('/')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().audio.musicStatus === 'playing')
  await page.evaluate(() => window.__GAME_INSPECTOR__!.testMissingAudio())
  const audio = await page.evaluate(() => window.__GAME_INSPECTOR__!.getState().audio)
  expect(audio.failedLoads).toHaveLength(1); expect(audio.failedLoads[0].message).toContain('HTTP 404')
  expect(audio.activeLoops).toContain('music:flight'); expect(errors).toEqual([])
})

test('no Web Audio support and denied storage never prevent launch', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined })
    Storage.prototype.setItem = () => { throw new Error('Storage disabled') }
  })
  await page.goto('/')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().missionElapsedTime > .3)
  const s = await page.evaluate(() => window.__GAME_INSPECTOR__!.getState())
  expect(s.audio.available).toBe(false); expect(s.graphicsState).toBe('ready'); expect(s.capturedErrors).toEqual([])
})

test('hidden tab and graphics loss silence loops, then permit a single resumed engine', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().audio.activeLoops.includes('engine'))
  // Visibility event injection tests the lifecycle even when headless tabs do not occlude each other.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().audio.contextState === 'suspended')
  expect(await page.evaluate(() => window.__GAME_INSPECTOR__!.getState().audio.activeLoops)).toEqual([])
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')) })
  await page.keyboard.press('KeyP')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().audio.activeLoops.includes('engine'))
  await page.evaluate(() => {
    const ext = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    ;(window as unknown as { restoreAudioTest: () => void }).restoreAudioTest = () => ext.restoreContext()
    ext.loseContext()
  })
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().graphicsState === 'lost')
  expect(await page.evaluate(() => window.__GAME_INSPECTOR__!.getState().audio.activeLoops)).toEqual([])
  await page.evaluate(() => (window as unknown as { restoreAudioTest: () => void }).restoreAudioTest())
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().graphicsState === 'ready')
  await page.keyboard.press('KeyP')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().audio.activeLoops.includes('engine'))
  expect((await page.evaluate(() => window.__GAME_INSPECTOR__!.getState().audio)).activeLoops.filter(id => id === 'engine')).toHaveLength(1)
  expect(context.pages()).toContain(page)
})
