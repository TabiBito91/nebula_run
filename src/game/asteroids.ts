/** Reusable gameplay definitions; scenery never uses these collision entities. */
export const ASTEROIDS = {
  solid: { durability: null, points: 0, drop: null },
  fractured: { durability: 4, points: 40, drop: null },
} as const
export type AsteroidKind = keyof typeof ASTEROIDS
