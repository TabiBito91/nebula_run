import { test, expect, state, scene, resume } from './support'

// Long sorties already retain failure video. Duplicating every rendered frame
// into trace screenshots creates a CDP backlog on this Windows host.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } })

for (const mode of ['standard', 'relaxed', 'veteran'] as const) {
test(`${mode} full real-time keyboard sortie reaches the core and restores the signal`, async ({ page }, info) => {
  test.setTimeout(210_000)
  if (mode === 'standard') { await scene(page, 'mission-start'); await resume(page) }
  else {
    await page.goto('/')
    await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
    await page.getByLabel('Difficulty', {exact:true}).selectOption(mode)
    await page.getByRole('button', {name:/LAUNCH SORTIE/}).click()
  }
  await page.keyboard.down('Space')
  const phases = new Set<string>(), events = new Set<string>()
  const samples: unknown[] = []
  const keys = new Set<string>()
  let moved = false
  while (true) {
    // Keep frequent control observations small: audio history and diagnostics
    // are collected in the final snapshot, not streamed on every input tick.
    const s = await page.evaluate(() => {
      const s = window.__GAME_INSPECTOR__!.getState()
      return { missionPhase: s.missionPhase, missionElapsedTime: s.missionElapsedTime,
        status: s.status, player: s.player, enemies: s.enemies, hazards: s.hazards, score: s.score,
        fps: s.fps, drawCalls: s.drawCalls, capturedErrors: s.capturedErrors,
        recentEvents: s.recentEvents.map(e => ({ type: e.type })) }
    })
    phases.add(s.missionPhase); s.recentEvents.forEach(e => events.add(e.type))
    if (Math.abs(s.player.position.x) > 1) moved = true
    if (s.status !== 'playing') { samples.push(s); break }
    let desiredX = 0, desiredY = -1
    if (s.missionElapsedTime > 5 && s.missionElapsedTime < 12) desiredX = 3
    if (s.missionElapsedTime >= 90 && s.missionElapsedTime < 119) desiredX = Math.floor(s.missionElapsedTime / 4) % 2 ? -7 : 7
    if (s.missionElapsedTime >= 120) desiredY = 0
    if (mode === 'standard' && s.missionElapsedTime >= 55 && s.missionElapsedTime < 90 && !events.has('asteroid-destroyed')) {
      const target = s.hazards.find(h => h.kind === 'fractured' && h.position.z < -35)
      if (target) { desiredX=target.position.x; desiredY=target.position.y }
    }
    // Veteran's warned patterns require sustained movement, not the old
    // largely stationary pilot. Still real keyboard input at real speed.
    if (mode === 'veteran') {
      const t = s.missionElapsedTime
      if (t >= 20 && t < 55 || t >= 90) {
        desiredY = Math.sin(t * 1.7) * 2.6
        desiredX = t >= 120 ? 0 : s.enemies.find(e => e.position.z < -25)?.position.x ?? 0
      }
    }
    const desired = new Set<string>()
    if (Math.abs(desiredX - s.player.position.x) > 0.6) desired.add(desiredX > s.player.position.x ? 'KeyD' : 'KeyA')
    if (Math.abs(desiredY - s.player.position.y) > 0.6) desired.add(desiredY > s.player.position.y ? 'KeyW' : 'KeyS')
    for (const key of keys) if (!desired.has(key)) { await page.keyboard.up(key); keys.delete(key) }
    for (const key of desired) if (!keys.has(key)) { await page.keyboard.down(key); keys.add(key) }
    if (samples.length === 0 || s.missionElapsedTime >= samples.length * 10) samples.push({ time: s.missionElapsedTime, shields: s.player.shields, score: s.score, fps: s.fps, drawCalls: s.drawCalls })
    await page.waitForFunction(({t, interval}) => {
      const s = window.__GAME_INSPECTOR__!.getState()
      // Observe a state transition each simulated second. This retains a
      // real-time journey while avoiding thousands of cross-process polls.
      return s.missionElapsedTime > t + interval || s.status !== 'playing'
    }, {t:s.missionElapsedTime, interval:mode === 'veteran' || mode === 'standard' && s.missionElapsedTime >= 55 && s.missionElapsedTime < 90 ? 0.12 : 1}, { timeout: 5000 })
  }
  for (const key of [...keys, 'Space']) await page.keyboard.up(key)
  await info.attach('full-route-observations', { body: JSON.stringify({ phases: [...phases], events: [...events], samples }, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('mission-victory.png') })
  expect(moved).toBe(true)
  expect(phases.size).toBe(5)
  expect(events.has('enemy-destroyed')).toBe(true)
  expect(events.has('phase-changed')).toBe(true)
  if (mode === 'standard') expect(events.has('asteroid-destroyed')).toBe(true)
  const completed = await state(page)
  expect(completed.status).toBe('mission-complete')
  expect(completed.difficulty).toBe(mode)
  expect(completed.missionElapsedTime).toBeGreaterThan(120)
  // Explicitly unload the active WebGL loop before Playwright closes its
  // context. This is a browser teardown concern, not a gameplay shortcut.
  await page.goto('about:blank')
})
}
