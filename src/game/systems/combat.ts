import { CONFIG } from '../config'
import { vec, type Vec3 } from '../entities/types'
import { GameState } from '../state'
import { intersects } from './collisions'
import { LEGACY_MUZZLES, rotatedMuzzles } from '../shipConfig'
import { updateAttacks } from './attacks'
import { ASTEROIDS } from '../asteroids'

export function projectile(s: GameState, owner: 'player' | 'enemy', position: Vec3, velocity: Vec3) {
  if (s.projectiles.length >= CONFIG.maxProjectiles) return
  s.projectiles.push({ id: s.id('shot'), owner, position: { ...position }, previous: { ...position }, velocity, radius: owner === 'player' ? 0.3 : 0.45, damage: owner === 'player' ? 1 : 12, ttl: 7 })
}
export function damagePlayer(s: GameState, damage: number, source: string) {
  if (s.player.invulnerable > 0 || s.status !== 'playing') return
  damage = Math.round(damage * s.tuning.damage)
  s.player.shields = Math.max(0, s.player.shields - damage)
  s.player.invulnerable = CONFIG.invulnerability
  s.event('player-hit', { source, damage, shields: s.player.shields })
  if (s.player.shields === 0) s.finish(false, 'Your shields collapsed. The signal is still out there.')
}
export function combat(s: GameState, fire: boolean, strix = false) {
  const p = s.player
  if (fire && p.weaponCooldown <= 0) {
    const muzzles = strix ? rotatedMuzzles(p.rotation.x,p.rotation.z) : LEGACY_MUZZLES
    for (const offset of muzzles) projectile(s, 'player', vec(p.position.x + offset.x, p.position.y + offset.y, p.position.z + offset.z), vec(0, 0, -CONFIG.projectileSpeed))
    p.weaponCooldown = CONFIG.fireInterval
    s.event('weapon-fired', { owner: 'player', position: { ...p.position } })
  }
  updateAttacks(s, projectile)
  for (const e of s.enemies) {
    if (e.attack) continue
    if ((e.type === 'gunner' || e.type === 'core') && e.fireCooldown <= 0 && e.position.z < -10) {
      const origin = e.position
      // Short, capped prediction, sampled once per shot. Never homing.
      const aimX = Math.max(-CONFIG.bounds.x, Math.min(CONFIG.bounds.x, p.position.x + p.velocity.x * s.tuning.aimLead))
      const aimY = Math.max(-CONFIG.bounds.y, Math.min(CONFIG.bounds.y, p.position.y + p.velocity.y * s.tuning.aimLead))
      const dx = aimX - origin.x, dy = aimY - origin.y, dz = p.position.z - origin.z
      const distance = Math.hypot(dx, dy, dz)
      const speed = 25 * s.tuning.shotSpeed
      projectile(s, 'enemy', origin, vec(dx / distance * speed, dy / distance * speed, dz / distance * speed))
      if (e.type === 'core') {
        for (const sign of [-1, 1]) projectile(s, 'enemy', vec(origin.x + sign * 3, origin.y, origin.z), vec(sign * 2.5 * s.tuning.shotSpeed, 0, speed))
      }
      s.event('weapon-fired', { owner: e.id })
      e.fireCooldown = (e.type === 'core' ? 2.6 : 3.5) * s.tuning.fireInterval
    }
  }
  for (const shot of s.projectiles) {
    if (shot.ttl <= 0) continue
    if (shot.owner === 'player') {
      // Order candidate hits by distance along travel so nearer geometry blocks shots.
      const candidates = [...s.enemies.filter(e => e.health > 0), ...s.hazards.filter(h => h.durability !== 0)].sort((a, b) => b.position.z - a.position.z)
      for (const entity of candidates) {
        if (!intersects(shot, entity)) continue
        shot.ttl = 0
        s.event('collision', { a: shot.id, b: entity.id })
        if ('durability' in entity) {
          entity.flash = 0.1
          s.event('asteroid-hit', { id: entity.id, kind: entity.kind })
          if (entity.durability !== null) {
            entity.durability = Math.max(0, entity.durability - shot.damage)
            if (entity.durability === 0) {
              const points = ASTEROIDS[entity.kind].points * s.tuning.score
              s.score += points
              s.event('score-awarded', { id: entity.id, points, difficulty: s.difficulty, score: s.score })
              s.event('asteroid-destroyed', { id: entity.id, position: { ...entity.position }, points })
            }
          }
        } else if ('health' in entity) {
          entity.health = Math.max(0, entity.health - shot.damage)
          entity.flash = 0.12
          s.event('enemy-hit', { id: entity.id, health: entity.health })
          if (entity.health === 0) {
            const points = (entity.type === 'core' ? 2000 : entity.type === 'gunner' ? 200 : 100) * s.tuning.score
            s.score += points
            s.event('score-awarded', { id: entity.id, points, difficulty: s.difficulty, score: s.score })
            s.event('enemy-destroyed', { id: entity.id, position: { ...entity.position }, enemyType: entity.type })
            if (entity.type === 'core') s.finish(true)
          }
        }
        break
      }
    } else if (intersects(shot, p)) {
      shot.ttl = 0
      s.event('collision', { a: shot.id, b: p.id })
      damagePlayer(s, shot.damage, shot.id)
    }
  }
  for (const entity of [...s.enemies, ...s.hazards]) {
    if (entity.position.z > 3 || !intersects(entity, p)) continue
    if ('health' in entity && entity.health <= 0) continue
    if ('durability' in entity && entity.durability === 0) continue
    s.event('collision', { a: entity.id, b: p.id })
    damagePlayer(s, 20, entity.id)
    entity.position.z = 10
  }
  s.enemies = s.enemies.filter(e => e.health > 0 && e.position.z < 8)
  s.hazards = s.hazards.filter(h => h.position.z < 8 && h.durability !== 0)
  s.projectiles = s.projectiles.filter(shot => shot.ttl > 0 && shot.position.z > -170 && shot.position.z < 12)
}
