import { test, expect, scene, state, resume } from './support'

for (const name of ['veteran-enemy-fire', 'veteran-enemy-wave', 'veteran-final-encounter']) {
  test(`${name}: readable warning, real-time attack and pause`, async ({ page }, info) => {
    await scene(page, name); await resume(page)
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().enemies.some(e => e.telegraph))
    await page.screenshot({ path: info.outputPath('warning.png') })
    await page.keyboard.press('KeyP')
    const warning = await state(page)
    expect(warning.activeAttacks).toBeLessThanOrEqual(2)
    await resume(page)
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().recentEvents.some(e => e.type === 'weapon-fired' && e.pattern))
    await page.keyboard.down('KeyD')
    await expect.poll(async () => (await state(page)).player.position.x).toBeGreaterThan(3)
    await page.keyboard.up('KeyD')
    await page.screenshot({ path: info.outputPath('attack.png') })
    if (name === 'veteran-final-encounter') {
      await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().recentEvents.some(e => e.type === 'attack-warning' && e.pattern === 'sweep'))
      await page.screenshot({ path: info.outputPath('sweep-warning.png') })
      await page.keyboard.press('KeyP')
    }
  })
}

test.describe('touch Veteran', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  test('drag avoids the warned fan while auto-fire remains available', async ({ page }, info) => {
    await scene(page, 'veteran-enemy-wave')
    await page.getByRole('button', { name: /RESUME FLIGHT/ }).tap()
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().recentEvents.some(e => e.type === 'attack-warning'))
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 420, y: 200, id: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 490, y: 145, id: 1 }] })
    await expect.poll(async () => (await state(page)).player.position.y).toBeGreaterThan(2)
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().missionElapsedTime > 2)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 490, y: 255, id: 1 }] })
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().missionElapsedTime > 2.7)
    // Move to a fresh row, not back into the earlier volley still in flight.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 490, y: 90, id: 1 }] })
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().missionElapsedTime > 5)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    expect((await state(page)).player.shields).toBe(100)
    expect((await state(page)).recentEvents.some(e => e.type === 'weapon-fired' && e.owner === 'player')).toBe(true)
    await page.screenshot({ path: info.outputPath('touch-veteran.png') })
  })
})
