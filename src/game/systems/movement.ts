import { CONFIG } from '../config'
import { GameState } from '../state'

export type Controls = { x: number; y: number; fire: boolean }
export function move(s: GameState, input: Controls, dt: number) {
  const p = s.player
  p.previous = { ...p.position }
  p.velocity.x = input.x * CONFIG.speed
  p.velocity.y = input.y * CONFIG.speed
  p.position.x = Math.max(-CONFIG.bounds.x, Math.min(CONFIG.bounds.x, p.position.x + p.velocity.x * dt))
  p.position.y = Math.max(-CONFIG.bounds.y, Math.min(CONFIG.bounds.y, p.position.y + p.velocity.y * dt))
  p.rotation.z += (-input.x * 0.35 - p.rotation.z) * Math.min(1, dt * 12)
  p.rotation.x += (input.y * 0.12 - p.rotation.x) * Math.min(1, dt * 12)
  p.invulnerable = Math.max(0, p.invulnerable - dt)
  p.weaponCooldown = Math.max(0, p.weaponCooldown - dt)
  for (const e of s.enemies) {
    e.previous = { ...e.position }
    e.age += dt
    e.flash = Math.max(0, e.flash - dt)
    e.position.z += e.velocity.z * dt
    if (e.type === 'sweep') e.position.x = e.originX + Math.sin(e.age * 1.4) * 2.3
    e.fireCooldown -= dt
    e.telegraph = (e.type === 'gunner' || e.type === 'core') && e.fireCooldown < 0.7
  }
  for (const h of s.hazards) {
    h.previous = { ...h.position }
    h.position.z += h.velocity.z * dt
    h.angle += dt * 0.22
  }
  for (const shot of s.projectiles) {
    shot.previous = { ...shot.position }
    shot.position.x += shot.velocity.x * dt
    shot.position.y += shot.velocity.y * dt
    shot.position.z += shot.velocity.z * dt
    shot.ttl -= dt
  }
}
