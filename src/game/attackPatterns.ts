export type Pattern = 'burst' | 'fan' | 'sweep'
export type Attack = { sequence: Pattern[]; index: number; stage: 'idle' | 'warning' | 'firing'; next: number; shot: number; target: { x: number; y: number }; direction: number }
// Shared vocabulary for future levels; encounter authoring chooses sequences, not logic.
export const PATTERNS = {
  burst: { warning: 1, shots: 3, spacing: 0.24, recovery: 1.7 },
  fan: { warning: 1.2, shots: 1, spacing: 0, recovery: 2.4 },
  sweep: { warning: 1.2, shots: 7, spacing: 0.18, recovery: 1.8 },
} as const
export const THREAT_LIMITS = { active: 2, startGap: 0.8, projectiles: 48, minimumDistance: 24 } as const
export function attackSequence(sequence: Pattern[]): Attack {
  return { sequence, index: 0, stage: 'idle', next: 0, shot: 0, target: { x: 0, y: 0 }, direction: 1 }
}
