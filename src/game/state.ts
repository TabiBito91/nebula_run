import { CONFIG, PHASES } from './config'
import { DIFFICULTIES, type Difficulty } from './difficulty'
import { vec, type Enemy, type GameEvent, type GameStatus, type Hazard, type Player, type Projectile } from './entities/types'

export class GameState {
  readonly difficulty: Difficulty
  constructor(difficulty: Difficulty = 'standard') { this.difficulty = difficulty }
  get tuning() { return DIFFICULTIES[this.difficulty] }
  waveNumber = 0
  nextAttackAt = 0
  ready = false
  scene = 'mission-start'
  status: GameStatus = 'title'
  paused = false
  elapsed = 0
  route = true
  phaseIndex = 0
  score = 0
  reason = ''
  seed: number = CONFIG.seed
  serial = 0
  spawnAt = 1
  coreSpawned = false
  generation = 0
  enemies: Enemy[] = []
  projectiles: Projectile[] = []
  hazards: Hazard[] = []
  events: GameEvent[] = []
  collisions: GameEvent[] = []
  player: Player = {
    id: 'player', position: vec(0, -1, 0), previous: vec(0, -1, 0), velocity: vec(),
    radius: 0.65, rotation: vec(), shields: 100, weaponCooldown: 0, invulnerable: 0,
  }
  get phase() { return PHASES[this.phaseIndex] }
  get progress() { return this.status === 'mission-complete' ? 1 : Math.min(1, this.elapsed / CONFIG.duration) }
  id(prefix: string) { return `${prefix}-${++this.serial}` }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0
    return this.seed / 4294967296
  }
  event(type: string, details: Record<string, unknown> = {}) {
    const event = { type, time: this.elapsed, ...details }
    this.events.push(event)
    if (this.events.length > 200) this.events.shift()
    if (type === 'collision') {
      this.collisions.push(event)
      if (this.collisions.length > 20) this.collisions.shift()
    }
  }
  finish(won: boolean, reason = '') {
    if (this.status !== 'playing') return
    this.status = won ? 'mission-complete' : 'game-over'
    this.reason = reason
    this.paused = false
    this.event(won ? 'mission-completed' : 'game-over', { score: this.score, reason, difficulty: this.difficulty })
  }
}
