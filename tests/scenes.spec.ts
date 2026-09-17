import { test, expect, state, scene, resume, elapsed } from './support'

const expected: Record<string, { enemies: number; hazards?: number; shields?: number }> = {
  'mission-start': { enemies: 0 }, 'basic-flight': { enemies: 0 },
  'asteroid-field': { enemies: 0, hazards: 12 }, 'basic-enemy': { enemies: 1 },
  'enemy-wave': { enemies: 5 }, 'enemy-fire': { enemies: 1 },
  'low-health': { enemies: 0, shields: 10 }, 'final-encounter': { enemies: 1 }, 'mission-complete': { enemies: 0 },
}
for (const [name, counts] of Object.entries(expected)) {
  test(`scene ${name} is ready, inspectable, and renders`, async ({ page }, info) => {
    await scene(page, name)
    const initial = await state(page)
    expect(initial.paused).toBe(true)
    expect(initial.enemies).toHaveLength(counts.enemies)
    expect(initial.hazardCount).toBe(counts.hazards ?? 0)
    expect(initial.player.shields).toBe(counts.shields ?? 100)
    expect(initial.drawCalls).toBeGreaterThan(0)
    expect(initial.triangles).toBeGreaterThan(0)
    if (name !== 'mission-complete') {
      await resume(page)
      await elapsed(page, initial.missionElapsedTime + 0.15)
    }
    await page.screenshot({ path: info.outputPath(`${name}.png`) })
    await info.attach(`${name}-state`, { body: JSON.stringify(await state(page), null, 2), contentType: 'application/json' })
  })
}

test('scene reset is deterministic and snapshots are detached', async ({ page }) => {
  await scene(page, 'enemy-wave')
  const initial = await state(page)
  await page.evaluate(() => {
    const snapshot = window.__GAME_INSPECTOR__!.getState()
    snapshot.player.shields = 0; snapshot.enemies.length = 0
  })
  expect((await state(page)).player.shields).toBe(100)
  expect((await state(page)).enemies).toHaveLength(5)
  await resume(page); await elapsed(page, 0.5)
  await page.evaluate(() => window.__GAME_INSPECTOR__!.resetScene())
  expect((await state(page)).enemies).toEqual(initial.enemies)
  expect((await state(page)).missionElapsedTime).toBe(0)
  const rejected = await page.evaluate(async () => {
    try { await window.__GAME_INSPECTOR__!.loadScene('unknown'); return false } catch { return true }
  })
  expect(rejected).toBe(true)
  expect((await state(page)).activeScene).toBe('enemy-wave')
})

test('inspector can switch through every scene without accumulating draw calls', async ({ page }) => {
  await scene(page, 'basic-flight')
  const baseline = (await state(page)).drawCalls
  for (const name of Object.keys(expected)) await page.evaluate(name => window.__GAME_INSPECTOR__!.loadScene(name), name)
  await page.evaluate(() => window.__GAME_INSPECTOR__!.loadScene('basic-flight'))
  expect((await state(page)).drawCalls).toBe(baseline)
  await page.evaluate(() => window.__GAME_INSPECTOR__!.clearRecentEvents())
  expect((await state(page)).recentEvents).toEqual([])
})
