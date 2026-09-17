import { vec } from '../entities/types'
import { createMission } from './mission'
import { spawnEnemy, spawnHazard } from '../systems/spawning'
import { projectile } from '../systems/combat'

export const SCENES = ['mission-start', 'basic-flight', 'asteroid-field', 'basic-enemy', 'enemy-wave', 'enemy-fire', 'low-health', 'final-encounter', 'mission-complete', 'ship-showcase', 'environment-normal', 'environment-boost', 'environment-combat', 'environment-dense'] as const
export type SceneName = typeof SCENES[number]
export function createFixture(name: string) {
  if (!(SCENES as readonly string[]).includes(name)) throw new Error(`Unknown scene: ${name}`)
  const s = createMission(true)
  s.scene = name
  s.route = name === 'mission-start' || name === 'final-encounter'
  s.paused = true
  if(name==='environment-combat'){
    for(let i=0;i<6;i++)spawnEnemy(s,i%2?'gunner':'sweep',(i-2.5)*3.4,i%2?2:-2,-40-i*7)
    for(let i=0;i<6;i++)projectile(s,'enemy',vec((i-2.5)*3,3,-25-i*5),vec(0,0,12))
  }
  if (name === 'asteroid-field') {
    for (let i = 0; i < 12; i++) spawnHazard(s, (i % 2 ? 1 : -1) * (4.5 + s.random() * 3), (s.random() - 0.5) * 8, -20 - i * 7, 1.3 + s.random())
    s.phaseIndex = 2
  }
  if (name === 'basic-enemy') spawnEnemy(s, 'straight', 0, -1, -32)
  if (name === 'enemy-wave') for (let i = 0; i < 5; i++) spawnEnemy(s, 'sweep', (i - 2) * 3.8, i % 2 ? 2 : -1, -36 - i * 6)
  if (name === 'enemy-fire') spawnEnemy(s, 'gunner', 0, -1, -45)
  if (name === 'low-health') {
    s.player.shields = 10
    projectile(s, 'enemy', vec(0, -1, -15), vec(0, 0, 12))
  }
  if (name === 'final-encounter') {
    s.elapsed = 120; s.phaseIndex = 4; s.coreSpawned = true; s.spawnAt = 123
    spawnEnemy(s, 'core', 0, 0, -55)
  }
  if (name === 'mission-complete') { s.elapsed = 140; s.score = 4200; s.phaseIndex = 4; s.finish(true); s.paused = true }
  return s
}
