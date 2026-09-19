import { test, expect } from '@playwright/test'
import { GameState } from '../src/game/state'
import { attackSequence, THREAT_LIMITS, type Pattern } from '../src/game/attackPatterns'
import { spawnEnemy } from '../src/game/systems/spawning'
import { combat, projectile } from '../src/game/systems/combat'
import { move } from '../src/game/systems/movement'
import { currentVersion, LEGACY_VETERAN, validEntry } from '../src/game/leaderboard/rules'

for (const pattern of ['burst', 'fan', 'sweep'] as Pattern[]) {
  test(`${pattern}: warning, bounded volley, recovery, deterministic reset`, () => {
    const run = () => {
      const s = new GameState('veteran'); s.status = 'playing'; s.route = false
      const e = spawnEnemy(s, 'core', 0, 0, -55); e.attack = attackSequence([pattern]); e.fireCooldown = 0
      combat(s, false)
      expect(e.telegraph).toBe(true); expect(s.projectiles).toHaveLength(0)
      s.paused = true; combat(s, false); expect(s.projectiles).toHaveLength(0); s.paused = false
      for (let i = 1; i <= 145; i++) {
        s.elapsed = i / 60; move(s, { x: 0, y: 0, fire: false }, 1 / 60); combat(s, false)
      }
      const shots = s.events.filter(e => e.type === 'weapon-fired')
      expect(shots[0].time).toBeGreaterThanOrEqual(pattern === 'burst' ? 1 : 1.2)
      expect(shots).toHaveLength(pattern === 'burst' ? 3 : pattern === 'fan' ? 1 : 7)
      expect(s.events.some(e => e.type === 'attack-finished')).toBe(true)
      expect(e.attack!.stage).toBe('idle')
      return s.events
    }
    expect(run()).toEqual(run())
  })
}
test('formation warnings stagger; live shots are capped and close attacks cancel', () => {
  const s = new GameState('veteran'); s.status = 'playing'
  for (let i = 0; i < 5; i++) { const e = spawnEnemy(s, 'gunner', i, 0, -80); e.fireCooldown = 0 }
  for (let i = 0; i < 60; i++) { s.elapsed = i / 60; combat(s, false) }
  const warnings = s.events.filter(e => e.type === 'attack-warning')
  expect(warnings).toHaveLength(2)
  expect(warnings[1].time - warnings[0].time).toBeGreaterThanOrEqual(THREAT_LIMITS.startGap)
  expect(s.enemies.filter(e => e.attack?.stage !== 'idle')).toHaveLength(2)
  for (let i = 0; i < 48; i++) projectile(s, 'enemy', { x: 9, y: 5, z: -80 }, { x: 0, y: 0, z: 25 })
  s.elapsed = 1.3; combat(s, false); expect(s.projectiles).toHaveLength(48)
  s.enemies[0].position.z = -23; combat(s, false)
  expect(s.enemies[0].telegraph).toBe(false)
  expect(s.events.some(e => e.type === 'attack-cancelled')).toBe(true)
})
test('previous Veteran scores retain their multiplier but are read-only', () => {
  expect(currentVersion(LEGACY_VETERAN)).toBe(false)
  expect(validEntry({ id: 'old', version: LEGACY_VETERAN, callsign: 'Old Pilot', score: 2125, outcome: 'defeat', elapsed: 90, createdAt: new Date().toISOString() })).toBe(true)
})
