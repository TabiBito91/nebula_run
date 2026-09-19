export type Difficulty = 'relaxed' | 'standard' | 'veteran'
export const DIFFICULTIES = {
  relaxed: { label: 'Relaxed', description: 'Gentler fire, fewer gunners · 0.75× points', score: 0.75, shotSpeed: 0.8, fireInterval: 1.4, damage: 0.75, aimLead: 0, extraWaves: false, maxGunners: 1 },
  standard: { label: 'Standard', description: 'The original mission balance · 1× points', score: 1, shotSpeed: 1, fireInterval: 1, damage: 1, aimLead: 0, extraWaves: false, maxGunners: 99 },
  veteran: { label: 'Veteran', description: 'Burst, fan and sweeping attacks · 1.25× points', score: 1.25, shotSpeed: 1.15, fireInterval: 0.85, damage: 1, aimLead: 0.18, extraWaves: true, maxGunners: 3 },
} as const
export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'relaxed' || value === 'standard' || value === 'veteran'
}
