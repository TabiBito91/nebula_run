import { test, expect, scene, state, resume, elapsed } from './support'

const played = (s: Awaited<ReturnType<typeof state>>, id: string) => s.audio.recentEvents.filter(e => e.type === 'sound-started' && e.sound === id)

for (const name of ['audio-flight', 'audio-firing', 'audio-dodge-shoot', 'audio-boost', 'audio-enemy-fire', 'audio-impacts', 'audio-damage', 'audio-transition', 'audio-boss', 'audio-pause', 'audio-restart', 'audio-victory', 'audio-failed-load']) {
  test(`${name} emits expected cues with bounded voices`, async ({ page }, info) => {
    await page.addInitScript(() => window.addEventListener('keydown', event => {
      if (event.code === 'Space' && !event.repeat) (window as unknown as { shotKeyAt: number }).shotKeyAt = performance.now()
    }, true))
    await scene(page, name)
    expect((await state(page)).audio.unlocked).toBe(false)
    await resume(page)
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().audio.unlocked)
    if (['audio-firing', 'audio-dodge-shoot', 'audio-impacts', 'audio-victory'].includes(name)) await page.keyboard.down('Space')
    if (name === 'audio-dodge-shoot') await page.keyboard.down('KeyD')
    if (name === 'audio-victory') await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().status === 'mission-complete')
    else await elapsed(page, 3)
    const sample = await state(page)
    expect(sample.audio.activeSoundCount).toBeLessThanOrEqual(sample.audio.voiceLimit)
    expect(sample.audio.peakActiveSounds).toBeLessThanOrEqual(sample.audio.voiceLimit)
    expect(sample.audio.measuredPeak).toBeLessThan(1)
    if (name !== 'audio-victory') expect(sample.audio.activeLoops.filter(id => id === 'engine')).toHaveLength(1)
    const cue: Record<string, string> = { 'audio-flight': 'engine', 'audio-firing': 'playerShot', 'audio-dodge-shoot': 'dodge', 'audio-boost': 'boostStart', 'audio-enemy-fire': 'enemyShot', 'audio-impacts': 'explosion', 'audio-damage': 'shield', 'audio-victory': 'victory', 'audio-boss': 'bossWarning' }
    if (cue[name]) expect(played(sample, cue[name]).length).toBeGreaterThan(0)
    if (name === 'audio-damage') expect(played(sample, 'critical')).toHaveLength(1)
    if (name === 'audio-firing') {
      expect(played(sample, 'playerShot').length).toBe(sample.recentEvents.filter(e => e.type === 'weapon-fired' && e.owner === 'player').length)
      const firstSound = played(sample, 'playerShot')[0]
      const keyAt = await page.evaluate(() => (window as unknown as { shotKeyAt: number }).shotKeyAt)
      expect(firstSound.wallTime - keyAt).toBeLessThan(150)
      expect(firstSound.wallTime - keyAt).toBeGreaterThanOrEqual(0)
    }
    if (name === 'audio-boost') { expect(sample.audio.boostState).toBe('preview'); await elapsed(page, 5.2); expect(played(await state(page), 'boostEnd')).toHaveLength(1) }
    if (name === 'audio-boss') expect(sample.audio.musicState).toBe('boss')
    if (name === 'audio-transition') expect(sample.audio.musicState).toBe('combat')
    if (name === 'audio-failed-load') { expect(sample.audio.failedLoads).toHaveLength(1); expect(sample.audio.musicStatus).toBe('playing') }
    else expect(sample.audio.failedLoads).toEqual([])
    if (name === 'audio-pause') {
      await page.keyboard.press('KeyP'); const frozen = (await state(page)).audio.musicPosition
      await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().audio.activeSoundCount === 0)
      expect((await state(page)).audio.musicPosition).toBe(frozen)
      await resume(page); await elapsed(page, sample.missionElapsedTime + .2)
      expect(played(await state(page), 'resume').length).toBeGreaterThan(0)
    }
    if (name === 'audio-restart') {
      await page.evaluate(() => window.__GAME_INSPECTOR__!.resetScene()); await resume(page)
      await elapsed(page, .2)
      expect((await state(page)).audio.activeLoops.filter(id => id === 'engine')).toHaveLength(1)
    }
    await page.keyboard.up('Space'); await page.keyboard.up('KeyD')
    await info.attach('audio-state', { body: JSON.stringify((await state(page)).audio), contentType: 'application/json' })
  })
}

test('music combat hold, quiet return and full buffer loop remain stable', async ({ page }) => {
  test.setTimeout(35000)
  await scene(page, 'audio-transition'); await resume(page)
  await elapsed(page, 3)
  expect((await state(page)).audio.musicState).toBe('combat')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().enemies.length === 0)
  const quietStart = (await state(page)).missionElapsedTime
  await elapsed(page, quietStart + 3.7)
  expect((await state(page)).audio.musicState).toBe('combat')
  await elapsed(page, quietStart + 4.1)
  expect((await state(page)).audio.musicState).toBe('flight')
  // 16-second temporary buffer repeats without starting another source.
  await page.evaluate(() => window.__GAME_INSPECTOR__!.loadScene('audio-flight')); await resume(page)
  await elapsed(page, 17, 20000)
  const s = await state(page)
  expect(s.audio.activeLoops.filter(id => id === 'music:flight')).toHaveLength(1)
  const resets = s.audio.recentEvents.filter(e => e.type === 'audio-reset')
  const lastReset = resets.at(-1)!.sequence
  expect(s.audio.recentEvents.filter(e => e.sequence > lastReset && e.type === 'sound-started' && e.sound === 'music:flight')).toHaveLength(1)
  expect(s.audio.musicPosition).toBeLessThan(3)
})

test('real game-over and R restart replace ending music and engine correctly', async ({ page }) => {
  await scene(page, 'low-health'); await resume(page)
  await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().status === 'game-over')
  expect((await state(page)).audio.musicState).toBe('failure')
  expect(played(await state(page), 'failure')).toHaveLength(1)
  expect((await state(page)).audio.activeLoops).not.toContain('engine')
  await page.keyboard.press('KeyR'); await elapsed(page, .3)
  expect((await state(page)).audio.musicState).toBe('flight')
  expect((await state(page)).audio.activeLoops.filter(id => id === 'engine')).toHaveLength(1)
})

test('reset clears combat hysteresis from the previous scene generation', async ({ page }) => {
  await scene(page, 'audio-transition'); await resume(page)
  await elapsed(page, 3)
  expect((await state(page)).audio.musicState).toBe('combat')
  await page.evaluate(() => window.__GAME_INSPECTOR__!.resetScene())
  expect((await state(page)).audio.musicState).toBe('flight')
  await resume(page); await elapsed(page, 1)
  expect((await state(page)).audio.musicState).toBe('flight')
})
