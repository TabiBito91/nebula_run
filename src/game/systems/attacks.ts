import { CONFIG } from '../config'
import { PATTERNS, THREAT_LIMITS } from '../attackPatterns'
import type { GameState } from '../state'
import type { Vec3 } from '../entities/types'

export function updateAttacks(s: GameState, emit: (s: GameState, owner: 'enemy', origin: Vec3, velocity: Vec3) => void) {
  if (s.status !== 'playing' || s.paused) return
  let active = s.enemies.filter(e => e.attack && e.attack.stage !== 'idle' && e.health > 0).length
  for (const e of s.enemies) {
    const a = e.attack
    if (!a) continue
    const pattern = a.sequence[a.index % a.sequence.length], spec = PATTERNS[pattern]
    if (e.health <= 0 || e.position.z > -THREAT_LIMITS.minimumDistance) {
      if (a.stage !== 'idle') { active--; s.event('attack-cancelled', { id: e.id, pattern }) }
      a.stage = 'idle'; e.telegraph = false; continue
    }
    if (a.stage === 'idle') {
      if (e.fireCooldown > 0 || s.elapsed < s.nextAttackAt || active >= THREAT_LIMITS.active) continue
      a.stage = 'warning'; a.next = s.elapsed + spec.warning; a.shot = 0
      a.target = { x: s.player.position.x, y: s.player.position.y }
      e.telegraph = true; active++; s.nextAttackAt = s.elapsed + THREAT_LIMITS.startGap
      s.event('attack-warning', { id: e.id, pattern, duration: spec.warning, target: { ...a.target } })
    }
    if (s.elapsed < a.next) continue
    a.stage = 'firing'; e.telegraph = false
    const offsets = pattern === 'fan' ? [-8, -4, 0, 4, 8] : [0]
    const count = s.projectiles.filter(p => p.owner === 'enemy' && p.ttl > 0).length
    if (count + offsets.length <= THREAT_LIMITS.projectiles) {
      for (const offset of offsets) {
        const x = pattern === 'burst' ? Math.max(-CONFIG.bounds.x, Math.min(CONFIG.bounds.x, s.player.position.x + s.player.velocity.x * s.tuning.aimLead)) : pattern === 'sweep' ? (-9 + a.shot * 3) * a.direction : a.target.x + offset
        const y = pattern === 'burst' ? Math.max(-CONFIG.bounds.y, Math.min(CONFIG.bounds.y, s.player.position.y + s.player.velocity.y * s.tuning.aimLead)) : a.target.y
        const dx = x - e.position.x, dy = y - e.position.y, dz = -e.position.z
        const speed = 25 * s.tuning.shotSpeed / Math.hypot(dx, dy, dz)
        emit(s, 'enemy', e.position, { x: dx * speed, y: dy * speed, z: dz * speed })
      }
      s.event('weapon-fired', { owner: e.id, pattern, shot: a.shot })
    }
    a.shot++; a.next = s.elapsed + spec.spacing
    if (a.shot >= spec.shots) {
      a.stage = 'idle'; a.index++; a.direction *= -1; active--; e.fireCooldown = spec.recovery
      s.event('attack-finished', { id: e.id, pattern })
    }
  }
}
