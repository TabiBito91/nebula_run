import { vec } from '../entities/types'
import { createMission } from './mission'
import { spawnEnemy, spawnHazard } from '../systems/spawning'
import { projectile } from '../systems/combat'
import { AUDIO_SCENES, setupAudioFixture } from '../debug/AudioFixtures'
import type { Difficulty } from '../difficulty'
import { attackSequence } from '../attackPatterns'

export const SCENES = ['mission-start', 'basic-flight', 'asteroid-field', 'asteroid-targets', 'basic-enemy', 'enemy-wave', 'enemy-fire', 'low-health', 'final-encounter', 'mission-complete', 'ship-showcase', 'environment-normal', 'environment-boost', 'environment-combat', 'environment-dense', 'relaxed-final-encounter', 'veteran-final-encounter', 'relaxed-enemy-fire', 'veteran-enemy-fire', 'veteran-enemy-wave', ...AUDIO_SCENES] as const
export type SceneName = typeof SCENES[number]
export function createFixture(name: string) {
  if (!(SCENES as readonly string[]).includes(name)) throw new Error(`Unknown scene: ${name}`)
  const sceneName = name
  const difficulty: Difficulty = name.startsWith('relaxed-') ? 'relaxed' : name.startsWith('veteran-') ? 'veteran' : 'standard'
  if (difficulty !== 'standard') name = name.slice(difficulty.length + 1)
  const s = createMission(true, difficulty)
  s.scene = sceneName
  s.route = name === 'mission-start' || name === 'final-encounter'
  s.paused = true
  setupAudioFixture(s)
  if(name==='environment-combat'){
    for(let i=0;i<6;i++)spawnEnemy(s,i%2?'gunner':'sweep',(i-2.5)*3.4,i%2?2:-2,-40-i*7)
    for(let i=0;i<6;i++)projectile(s,'enemy',vec((i-2.5)*3,3,-25-i*5),vec(0,0,12))
  }
  if (name === 'asteroid-field') {
    for (let i = 0; i < 12; i++) spawnHazard(s, (i % 2 ? 1 : -1) * (4.5 + s.random() * 3), (s.random() - 0.5) * 8, -20 - i * 7, 1.3 + s.random(), i % 3 === 0 ? 'solid' : 'fractured')
    s.phaseIndex = 2
  }
  if (name === 'asteroid-targets') {
    spawnHazard(s, 0, -1, -38, 1.5, 'fractured')
    spawnHazard(s, 5, -1, -45, 1.8, 'solid')
    s.phaseIndex = 2
  }
  if (name === 'basic-enemy') spawnEnemy(s, 'straight', 0, -1, -32)
  if (name === 'enemy-wave') for (let i = 0; i < 5; i++) spawnEnemy(s, 'sweep', (i - 2) * 3.8, i % 2 ? 2 : -1, -36 - i * 6)
  if (name === 'enemy-fire') spawnEnemy(s, 'gunner', 0, -1, difficulty === 'veteran' ? -75 : -45)
  if (name === 'enemy-wave' && difficulty === 'veteran') {
    s.enemies.forEach((e, i) => { e.position.z = e.previous.z = -80 - i * 8; e.attack = attackSequence(['fan']); e.fireCooldown = i * 0.8 })
  }
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
