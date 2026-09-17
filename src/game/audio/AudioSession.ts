import type { GameState } from '../state'
import { AudioManager } from './AudioManager'
import { MIX, type MusicState } from './manifest'

/** Presentation-only state adapter. All timings use mission time, never alter simulation. */
export class AudioSession {
  readonly manager = new AudioManager()
  private generation = -1
  private combatUntil = 0
  private quietSince = 0
  private music: MusicState = 'menu'
  update(s: GameState, graphicsReady: boolean) {
    if (s.generation !== this.generation) {
      this.generation = s.generation; this.combatUntil = 0; this.quietSince = s.elapsed
      this.manager.reset()
    }
    this.manager.setPaused(s.paused || !graphicsReady)
    let next: MusicState = s.status === 'title' ? 'menu' : s.status === 'mission-complete' ? 'victory' : s.status === 'game-over' ? 'failure' : 'flight'
    if (s.status === 'playing') {
      const intense = s.enemies.length >= 3 || s.projectiles.filter(p => p.owner === 'enemy').length >= 4
      if (intense) { this.quietSince = s.elapsed; if (this.music !== 'combat') this.combatUntil = s.elapsed + MIX.combatHold }
      if (intense || (this.music === 'combat' && (s.elapsed < this.combatUntil || s.elapsed - this.quietSince < MIX.combatQuiet))) next = 'combat'
      if (s.enemies.some(e => e.type === 'core') || s.phaseIndex === 4) next = 'boss'
    }
    this.music = next; this.manager.setMusic(next); this.manager.update()
  }
  dispose() { this.manager.dispose() }
}
