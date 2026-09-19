import { test, expect } from '@playwright/test'
import { GameState } from '../src/game/state'
import { CONFIG } from '../src/game/config'
import { DIFFICULTIES, type Difficulty } from '../src/game/difficulty'
import { spawnEnemy, updateMission } from '../src/game/systems/spawning'
import { combat, damagePlayer, projectile } from '../src/game/systems/combat'
import { move } from '../src/game/systems/movement'
import { vec } from '../src/game/entities/types'

for (const mode of Object.keys(DIFFICULTIES) as Difficulty[]) {
  test(`${mode}: damage, shot speed, cadence, aim and scoring`, () => {
    const s = new GameState(mode); s.status = 'playing'
    const enemy = spawnEnemy(s, 'gunner', 0, -1, -40)
    expect(enemy.health).toBe(6)
    expect(enemy.fireCooldown).toBe(2 * s.tuning.fireInterval)
    enemy.fireCooldown = 0
    s.player.velocity.x = 12
    combat(s, true)
    if (mode === 'veteran') {
      expect(s.projectiles.filter(p => p.owner === 'enemy')).toHaveLength(0)
      expect(enemy.telegraph).toBe(true)
      s.elapsed = 1
      combat(s, false)
    }
    const shot = s.projectiles.find(p => p.owner === 'enemy')!
    expect(Math.hypot(shot.velocity.x, shot.velocity.y, shot.velocity.z)).toBeCloseTo(25 * s.tuning.shotSpeed)
    expect(shot.velocity.x > 0).toBe(mode === 'veteran')
    if (mode !== 'veteran') expect(enemy.fireCooldown).toBe(3.5 * s.tuning.fireInterval)
    expect(s.player.weaponCooldown).toBe(CONFIG.fireInterval)
    damagePlayer(s, 12, 'test')
    expect(s.player.shields).toBe(mode === 'relaxed' ? 91 : 88)
    damagePlayer(s, 12, 'overlap')
    expect(s.player.shields).toBe(mode === 'relaxed' ? 91 : 88)
    s.projectiles = []
    enemy.health = 1
    projectile(s, 'player', {...enemy.position}, vec(0, 0, -95))
    combat(s, false)
    expect(s.score).toBe(200 * s.tuning.score)
    expect(s.events.some(e => e.type === 'score-awarded')).toBe(true)
  })
}

test('fixed-step schedules are deterministic, bounded and preserve asteroid gaps', () => {
  // Simulation unit test, not a substitute for the real-time keyboard journeys.
  function simulate(mode: Difficulty) {
    const s = new GameState(mode); s.status = 'playing'
    const spawns: unknown[] = [], hazards: unknown[] = []
    let maxEnemies = 0, maxShots = 0, maxGunners = 0
    for (let i = 0; i < 9000; i++) {
      s.elapsed = (i + 1) * CONFIG.step
      updateMission(s)
      spawns.push(...s.events.filter(e => e.type === 'enemy-spawned'))
      if (s.phaseIndex === 2) hazards.push(...s.hazards.filter(h => h.position.z === -105 || h.position.z === -115).map(h => ({...h.position, radius:h.radius})))
      s.events = []
      move(s, { x:0, y:0, fire:false }, CONFIG.step)
      // Isolate the schedule from survivability in this unit test.
      s.player.invulnerable = 1
      combat(s, false)
      maxEnemies = Math.max(maxEnemies, s.enemies.length)
      maxShots = Math.max(maxShots, s.projectiles.length)
      maxGunners = Math.max(maxGunners, s.enemies.filter(e => e.type === 'gunner').length)
    }
    return { spawns, hazards, maxEnemies, maxShots, maxGunners }
  }
  const normal = simulate('standard'), easy = simulate('relaxed'), hard = simulate('veteran')
  expect(simulate('veteran')).toEqual(hard)
  expect(easy.hazards).toEqual(normal.hazards)
  expect(hard.hazards).toEqual(normal.hazards)
  expect(hard.spawns.length).toBeGreaterThan(normal.spawns.length)
  expect(easy.spawns.length).toBe(normal.spawns.length)
  expect(easy.maxGunners).toBeLessThanOrEqual(1)
  for (const run of [normal,easy,hard]) { expect(run.maxEnemies).toBeLessThan(12); expect(run.maxShots).toBeLessThanOrEqual(CONFIG.maxProjectiles) }
})
