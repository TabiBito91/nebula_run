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
export const SOUNDS: Record<string, SoundDefinition> = {
  playerShot: { bus: 'playerWeapons', gain: .24, max: 3, cooldown: .065, priority: 3 },
  enemyShot: { bus: 'enemyWeapons', gain: .2, max: 4, cooldown: .045, priority: 2 },
  hit: { bus: 'impacts', gain: .12, max: 3, cooldown: .045, priority: 2 },
  shield: { bus: 'impacts', gain: .48, max: 2, cooldown: .15, priority: 8 },
  explosion: { bus: 'impacts', gain: .32, max: 4, cooldown: .045, priority: 4 },
  coreExplosion: { bus: 'impacts', gain: .5, max: 1, cooldown: 1, priority: 9 },
  engine: { bus: 'engines', gain: .06, loop: true, max: 1, cooldown: 0, priority: 1 },
  dodge: { bus: 'engines', gain: .24, max: 1, cooldown: .65, priority: 4 },
  boostStart: { bus: 'engines', gain: .25, max: 1, cooldown: .5, priority: 3 },
  boostEnd: { bus: 'engines', gain: .18, max: 1, cooldown: .5, priority: 3 },
  lock: { bus: 'warnings', gain: .13, max: 1, cooldown: 1.4, priority: 5 },
  critical: { bus: 'warnings', gain: .4, max: 1, cooldown: 5, priority: 10 },
  bossWarning: { bus: 'warnings', gain: .32, max: 1, cooldown: 3, priority: 9 },
  launch: { bus: 'ui', gain: .28, max: 1, cooldown: .15, priority: 5 },
  confirm: { bus: 'ui', gain: .16, max: 1, cooldown: .12, priority: 4 },
  pause: { bus: 'ui', gain: .18, max: 1, cooldown: .12, priority: 5 },
  resume: { bus: 'ui', gain: .18, max: 1, cooldown: .12, priority: 5 },
  victory: { bus: 'warnings', gain: .35, max: 1, cooldown: 2, priority: 10 },
  failure: { bus: 'warnings', gain: .3, max: 1, cooldown: 2, priority: 10 },
}
export const definition = (id: string) => id.startsWith('music:') ? MUSIC[id.slice(6) as MusicState] : SOUNDS[id]
