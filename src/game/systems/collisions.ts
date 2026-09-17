import type { Entity } from '../entities/types'

// Relative swept sphere test also accounts for a moving target.
export function intersects(a: Entity, b: Entity) {
  const x = a.previous.x - b.previous.x, y = a.previous.y - b.previous.y, z = a.previous.z - b.previous.z
  const dx = a.position.x - b.position.x - x, dy = a.position.y - b.position.y - y, dz = a.position.z - b.position.z - z
  const length = dx * dx + dy * dy + dz * dz
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(x * dx + y * dy + z * dz) / length))
  return (x + dx * t) ** 2 + (y + dy * t) ** 2 + (z + dz * t) ** 2 <= (a.radius + b.radius) ** 2
}
