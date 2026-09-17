export type MusicState = 'menu' | 'flight' | 'combat' | 'boss' | 'victory' | 'failure'
export type Bus = 'music' | 'playerWeapons' | 'enemyWeapons' | 'impacts' | 'engines' | 'warnings' | 'ui'
export interface SoundDefinition {
  bus: Bus; gain: number; loop?: boolean; max: number; cooldown: number; priority: number
  /** Optional replacement, relative to Vite's public directory. Procedural fallback remains available. */
  url?: string; fallbackUrl?: string; loopStart?: number; loopEnd?: number
}
export const MIX = {
  voiceLimit: 28, fade: 2, combatHold: 8, combatQuiet: 4,
  buses: { music: 1, playerWeapons: .65, enemyWeapons: .6, impacts: .8, engines: .35, warnings: .85, ui: .65 },
  limits: { music: 2, playerWeapons: 4, enemyWeapons: 6, impacts: 8, engines: 2, warnings: 2, ui: 2 },
} as const
export const MUSIC: Record<MusicState, SoundDefinition> = Object.fromEntries(
  ['menu', 'flight', 'combat', 'boss', 'victory', 'failure'].map(id => [id, {
    bus: 'music', gain: .65, loop: !['victory', 'failure'].includes(id), max: 1, cooldown: 0, priority: 10,
  }]),
) as Record<MusicState, SoundDefinition>
export const SOUNDS: Record<string, SoundDefinition> = {}
export const definition = (id: string) => id.startsWith('music:') ? MUSIC[id.slice(6) as MusicState] : SOUNDS[id]
