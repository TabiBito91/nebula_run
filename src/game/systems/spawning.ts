import { PHASES } from '../config'
import { vec, type EnemyType } from '../entities/types'
import { GameState } from '../state'

export function spawnEnemy(s: GameState, type: EnemyType, x: number, y: number, z = -100) {
  const health = type === 'core' ? 100 : type === 'gunner' ? 6 : 4
  const enemy = {
    id: s.id(type), type, position: vec(x, y, z), previous: vec(x, y, z),
    velocity: vec(0, 0, type === 'core' ? 0 : 14), radius: type === 'core' ? 4 : 1.25,
    health, maxHealth: health, age: 0, originX: x, fireCooldown: type === 'core' ? 3 : 2,
    flash: 0, telegraph: false,
  }
  s.enemies.push(enemy)
  s.event('enemy-spawned', { id: enemy.id, enemyType: type })
  return enemy
}
export function spawnHazard(s: GameState, x: number, y: number, z = -105, radius = 1.5) {
  s.hazards.push({ id: s.id('debris'), position: vec(x, y, z), previous: vec(x, y, z), velocity: vec(0, 0, 17), radius, angle: s.random() * 6 })
}
export function updateMission(s: GameState) {
  if (!s.route) return
  let index = 0
  PHASES.forEach((phase, i) => { if (s.elapsed >= phase.at) index = i })
  if (index !== s.phaseIndex) { s.phaseIndex = index; s.event('phase-changed', { phase: s.phase.name }) }
  if (s.elapsed >= 150) { s.finish(false, 'The relay sealed. Break the core before lockdown.'); return }
  if (index === 4 && !s.coreSpawned) {
    s.coreSpawned = true
    spawnEnemy(s, 'core', 0, 0, -55)
  }
  if (s.elapsed < s.spawnAt) return
  s.spawnAt = s.elapsed + (index === 2 ? 3.2 : index === 4 ? 7 : 4.5)
  const lane = (s.random() * 2 - 1) * 7
  const y = (s.random() * 2 - 1) * 3.5
  if (index === 0) spawnEnemy(s, 'straight', s.elapsed < 3 ? 0 : lane, s.elapsed < 3 ? -1 : y, -72)
  if (index === 1) {
    spawnEnemy(s, 'sweep', -5, y)
    spawnEnemy(s, 'sweep', 5, -y, -108)
  }
  if (index === 2) {
    // An open central channel gives new players a readable route through debris.
    spawnHazard(s, -5.5 + s.random() * 1.5, y)
    spawnHazard(s, 5 + s.random() * 1.5, -y, -115, 1.8)
  }
  if (index === 3) {
    spawnEnemy(s, 'gunner', lane, y)
    spawnEnemy(s, 'straight', -lane, -y, -112)
  }
  if (index === 4) spawnEnemy(s, 'sweep', lane > 0 ? 7 : -7, y, -90)
}
