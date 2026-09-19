import { PHASES } from '../config'
import { vec, type EnemyType, type Enemy } from '../entities/types'
import { attackSequence } from '../attackPatterns'
import { RELAY_VETERAN } from '../scenes/encounters'
import { GameState } from '../state'
import { ASTEROIDS, type AsteroidKind } from '../asteroids'

export function spawnEnemy(s: GameState, type: EnemyType, x: number, y: number, z = -100) {
  const health = type === 'core' ? 100 : type === 'gunner' ? 6 : 4
  const enemy: Enemy = {
    id: s.id(type), type, position: vec(x, y, z), previous: vec(x, y, z),
    velocity: vec(0, 0, type === 'core' ? 0 : 14), radius: type === 'core' ? 4 : 1.25,
    health, maxHealth: health, age: 0, originX: x, fireCooldown: (type === 'core' ? 3 : 2) * s.tuning.fireInterval,
    flash: 0, telegraph: false,
  }
  if (s.difficulty === 'veteran' && (type === 'gunner' || type === 'core')) enemy.attack = attackSequence(RELAY_VETERAN[type])
  s.enemies.push(enemy)
  s.event('enemy-spawned', { id: enemy.id, enemyType: type })
  return enemy
}
export function spawnHazard(s: GameState, x: number, y: number, z = -105, radius = 1.5, kind: AsteroidKind = 'solid') {
  const hazard = { id: s.id('debris'), position: vec(x, y, z), previous: vec(x, y, z), velocity: vec(0, 0, 17), radius, angle: s.random() * 6, kind, durability: ASTEROIDS[kind].durability, flash: 0 }
  s.hazards.push(hazard)
  return hazard
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
  s.waveNumber++
  s.spawnAt = s.elapsed + (index === 2 ? 3.2 : index === 4 ? 7 : 4.5)
  const lane = (s.random() * 2 - 1) * 7
  const y = (s.random() * 2 - 1) * 3.5
  if (index === 0) spawnEnemy(s, 'straight', s.elapsed < 3 ? 0 : lane, s.elapsed < 3 ? -1 : y, -72)
  if (index === 1) {
    const lead = spawnEnemy(s, 'sweep', -5, y)
    if (s.difficulty === 'veteran') lead.attack = attackSequence(RELAY_VETERAN.formationLead)
    spawnEnemy(s, 'sweep', 5, -y, -108)
  }
  if (index === 2) {
    // An open central channel gives new players a readable route through debris.
    spawnHazard(s, -5.5 + s.random() * 1.5, y, -105, 1.5, s.waveNumber % 2 ? 'fractured' : 'solid')
    spawnHazard(s, 5 + s.random() * 1.5, -y, -115, 1.8, s.waveNumber % 2 ? 'solid' : 'fractured')
  }
  if (index === 3) {
    spawnEnemy(s, s.enemies.filter(e => e.type === 'gunner').length < s.tuning.maxGunners ? 'gunner' : 'straight', lane, y)
    spawnEnemy(s, 'straight', -lane, -y, -112)
  }
  if (index === 4) {
    const escort = spawnEnemy(s, 'sweep', lane > 0 ? 7 : -7, y, -90)
    if (s.difficulty === 'veteran') escort.attack = attackSequence(RELAY_VETERAN.coreEscort)
  }
  // Fixed authored slots: no extra random calls, no changes to debris safe gaps.
  if (s.tuning.extraWaves && s.waveNumber % 2 === 0 && [1, 3, 4].includes(index)) {
    const gunner = index >= 3 && s.enemies.filter(e => e.type === 'gunner').length < s.tuning.maxGunners
    spawnEnemy(s, gunner ? 'gunner' : 'straight', 0, -y, -120)
  }
}
