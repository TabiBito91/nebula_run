import type { Attack } from '../attackPatterns'
import type { AsteroidKind } from '../asteroids'
export type Vec3 = { x: number; y: number; z: number }
export type EnemyType = 'straight' | 'sweep' | 'gunner' | 'core'
export type Entity = {
  id: string; position: Vec3; previous: Vec3; velocity: Vec3; radius: number;
}
export type Enemy = Entity & {
  type: EnemyType; health: number; maxHealth: number; age: number; originX: number;
  fireCooldown: number; flash: number; telegraph: boolean; attack?: Attack;
}
export type Projectile = Entity & { owner: 'player' | 'enemy'; damage: number; ttl: number }
export type Hazard = Entity & { angle: number; kind: AsteroidKind; durability: number | null; flash: number }
export type Player = Entity & {
  rotation: Vec3; shields: number; weaponCooldown: number; invulnerable: number;
}
export type GameEvent = { type: string; time: number; [key: string]: unknown }
export type GameStatus = 'title' | 'playing' | 'game-over' | 'mission-complete'
export type Metrics = { fps: number; averageFrameTime: number; drawCalls: number; triangles: number }
export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })
