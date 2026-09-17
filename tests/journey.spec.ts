import { test, expect, state, scene, resume } from './support'

// Long sorties already retain failure video. Duplicating every rendered frame
// into trace screenshots creates a CDP backlog on this Windows host.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } })

test('full real-time keyboard sortie reaches the core and restores the signal', async ({ page }, info) => {
  test.setTimeout(210_000)
  await scene(page, 'mission-start'); await resume(page)
  await page.keyboard.down('Space')
  const phases = new Set<string>(), events = new Set<string>()
  const samples: unknown[] = []
  const keys = new Set<string>()
  let moved = false
  while (true) {
    const s = await state(page)
    phases.add(s.missionPhase); s.recentEvents.forEach(e => events.add(e.type))
    if (Math.abs(s.player.position.x) > 1) moved = true
    if (s.status !== 'playing') { samples.push(s); break }
    let desiredX = 0, desiredY = -1
    if (s.missionElapsedTime > 5 && s.missionElapsedTime < 12) desiredX = 3
    if (s.missionElapsedTime >= 90 && s.missionElapsedTime < 119) desiredX = Math.floor(s.missionElapsedTime / 4) % 2 ? -7 : 7
    if (s.missionElapsedTime >= 120) desiredY = 0
    const desired = new Set<string>()
    if (Math.abs(desiredX - s.player.position.x) > 0.6) desired.add(desiredX > s.player.position.x ? 'KeyD' : 'KeyA')
    if (Math.abs(desiredY - s.player.position.y) > 0.6) desired.add(desiredY > s.player.position.y ? 'KeyW' : 'KeyS')
    for (const key of keys) if (!desired.has(key)) { await page.keyboard.up(key); keys.delete(key) }
    for (const key of desired) if (!keys.has(key)) { await page.keyboard.down(key); keys.add(key) }
    if (samples.length === 0 || s.missionElapsedTime >= samples.length * 10) samples.push({ time: s.missionElapsedTime, shields: s.player.shields, score: s.score, fps: s.fps, drawCalls: s.drawCalls })
    await page.waitForFunction(t => {
      const s = window.__GAME_INSPECTOR__!.getState()
      // Observe a state transition each simulated second. This retains a
      // real-time journey while avoiding thousands of cross-process polls.
      return s.missionElapsedTime > t + 1 || s.status !== 'playing'
    }, s.missionElapsedTime, { timeout: 5000 })
  }
  for (const key of [...keys, 'Space']) await page.keyboard.up(key)
  await info.attach('full-route-observations', { body: JSON.stringify({ phases: [...phases], events: [...events], samples }, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('mission-victory.png') })
  expect(moved).toBe(true)
  expect(phases.size).toBe(5)
  expect(events.has('enemy-destroyed')).toBe(true)
  expect(events.has('phase-changed')).toBe(true)
  const completed = await state(page)
  expect(completed.status).toBe('mission-complete')
  expect(completed.missionElapsedTime).toBeGreaterThan(120)
  // Explicitly unload the active WebGL loop before Playwright closes its
  // context. This is a browser teardown concern, not a gameplay shortcut.
  await page.goto('about:blank')
})
