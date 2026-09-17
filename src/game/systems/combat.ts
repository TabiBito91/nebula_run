import { CONFIG } from '../config'
import { vec, type Vec3 } from '../entities/types'
import { GameState } from '../state'
import { intersects } from './collisions'
import { LEGACY_MUZZLES, rotatedMuzzles } from '../shipConfig'

export function projectile(s: GameState, owner: 'player' | 'enemy', position: Vec3, velocity: Vec3) {
  if (s.projectiles.length >= CONFIG.maxProjectiles) return
  s.projectiles.push({ id: s.id('shot'), owner, position: { ...position }, previous: { ...position }, velocity, radius: owner === 'player' ? 0.3 : 0.45, damage: owner === 'player' ? 1 : 12, ttl: 7 })
}
export function damagePlayer(s: GameState, damage: number, source: string) {
  if (s.player.invulnerable > 0 || s.status !== 'playing') return
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
  for (const e of s.enemies) {
    if ((e.type === 'gunner' || e.type === 'core') && e.fireCooldown <= 0 && e.position.z < -10) {
      const origin = e.position
      const dx = p.position.x - origin.x, dy = p.position.y - origin.y, dz = p.position.z - origin.z
      const distance = Math.hypot(dx, dy, dz)
      projectile(s, 'enemy', origin, vec(dx / distance * 25, dy / distance * 25, dz / distance * 25))
      if (e.type === 'core') {
        for (const sign of [-1, 1]) projectile(s, 'enemy', vec(origin.x + sign * 3, origin.y, origin.z), vec(sign * 2.5, 0, 25))
      }
      s.event('weapon-fired', { owner: e.id })
      e.fireCooldown = e.type === 'core' ? 2.6 : 3.5
    }
  }
  for (const shot of s.projectiles) {
    if (shot.ttl <= 0) continue
    if (shot.owner === 'player') {
      // Order candidate hits by distance along travel so nearer geometry blocks shots.
      const candidates = [...s.enemies.filter(e => e.health > 0), ...s.hazards].sort((a, b) => b.position.z - a.position.z)
      for (const entity of candidates) {
        if (!intersects(shot, entity)) continue
        shot.ttl = 0
        s.event('collision', { a: shot.id, b: entity.id })
        if ('health' in entity) {
          entity.health = Math.max(0, entity.health - shot.damage)
          entity.flash = 0.12
          s.event('enemy-hit', { id: entity.id, health: entity.health })
          if (entity.health === 0) {
            s.score += entity.type === 'core' ? 2000 : entity.type === 'gunner' ? 200 : 100
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
    s.event('collision', { a: entity.id, b: p.id })
    damagePlayer(s, 20, entity.id)
    entity.position.z = 10
  }
  s.enemies = s.enemies.filter(e => e.health > 0 && e.position.z < 8)
  s.hazards = s.hazards.filter(h => h.position.z < 8)
  s.projectiles = s.projectiles.filter(shot => shot.ttl > 0 && shot.position.z > -170 && shot.position.z < 12)
}
