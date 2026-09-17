import { test, expect, scene, state, resume, elapsed } from './support'

test('quit confirmation defaults to cancellation and Escape stays paused', async ({ page }, info) => {
  await scene(page, 'basic-flight')
  await page.getByRole('button', { name: 'Return to Main Menu', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Keep Playing' })).toBeFocused()
  await page.screenshot({ path: info.outputPath('quit-confirmation.png') })
  await page.keyboard.press('KeyP')
  expect((await state(page)).paused).toBe(true)
  await page.keyboard.press('Enter')
  await expect(dialog).not.toBeVisible()
  expect((await state(page)).paused).toBe(true)
  await page.getByRole('button', { name: 'Return to Main Menu', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect((await state(page)).paused).toBe(true)
  await page.keyboard.press('Escape')
  await elapsed(page, .2)
})

test('quit clears flight and audio, preserves settings and permits repeated fresh launches', async ({ page }) => {
  await scene(page, 'basic-flight'); await resume(page)
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await page.getByRole('slider', { name: 'Music volume' }).fill('24')
  await page.keyboard.press('Escape')
  await page.locator('canvas#game').click()
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('Space'); await page.keyboard.down('KeyD')
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().recentEvents.some(e => e.type === 'weapon-fired'))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Return to Main Menu', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Return to Menu', exact: true }).click()
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().status === 'title')
    const s = await state(page)
    expect(s.missionElapsedTime).toBe(0); expect(s.score).toBe(0)
    expect(s.enemies).toHaveLength(0); expect(s.player.shields).toBe(100)
    expect(s.playerProjectileCount + s.enemyProjectileCount + s.hazardCount).toBe(0)
    expect(s.ship.active).toBe('strix')
    expect(s.audio.music).toBe(.24)
    await page.waitForFunction(() => {
      const a = window.__GAME_INSPECTOR__!.getState().audio
      return a.activeLoops.length === 1 && a.activeLoops[0] === 'music:menu'
    })
    await page.keyboard.press('Enter'); await elapsed(page, .2)
    expect((await state(page)).player.position.x).toBe(0)
    expect((await state(page)).recentEvents.filter(e => e.type === 'weapon-fired')).toHaveLength(0)
    await page.keyboard.up('Space'); await page.keyboard.up('KeyD')
  }
})

for (const fixture of ['mission-complete', 'low-health']) {
  test(`${fixture} returns directly to menu without confirmation`, async ({ page }) => {
    await scene(page, fixture)
    if (fixture === 'low-health') { await resume(page); await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().status === 'game-over') }
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /LAUNCH SORTIE/ })).toBeVisible()
    expect((await state(page)).status).toBe('title')
  })
}
