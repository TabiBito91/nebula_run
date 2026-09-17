import type { GameState } from '../state'
import { AudioManager } from './AudioManager'
import { MIX, type MusicState } from './manifest'
import type { GameEvent } from '../entities/types'

/** Presentation-only state adapter. All timings use mission time, never alter simulation. */
export class AudioSession {
  readonly manager = new AudioManager()
  private generation = -1
  private combatUntil = 0
  private quietSince = 0
  private music: MusicState = 'menu'
  private consumed = new WeakSet<GameEvent>()
  private target: string | null = null
  private targetSince = 0
  private lockPlayed = false
  private warningAt = 0
  private shotSerial = 0
  private previewBoost = false
  /** Installed only by the development fixture registry. */
  reviewUpdate?: (s: GameState) => { boost: boolean }
  update(s: GameState, graphicsReady: boolean) {
    if (!this.manager.available) return
    try { this.tick(s, graphicsReady) } catch (error) { this.manager.disable(error) }
  }
  private tick(s: GameState, graphicsReady: boolean) {
    if (s.generation !== this.generation) {
      this.generation = s.generation; this.combatUntil = 0; this.quietSince = s.elapsed; this.music = 'menu'
      this.manager.reset()
      this.consumed = new WeakSet(); this.target = null; this.lockPlayed = false; this.warningAt = 0; this.shotSerial = 0; this.previewBoost = false
    }
    this.manager.setPaused(s.paused || !graphicsReady)
    let next: MusicState = s.status === 'title' ? 'menu' : s.status === 'mission-complete' ? 'victory' : s.status === 'game-over' ? 'failure' : 'flight'
    if (s.status === 'playing') {
      const intense = s.enemies.length >= 3 || s.projectiles.filter(p => p.owner === 'enemy').length >= 4
      if (intense) { this.quietSince = s.elapsed; if (this.music !== 'combat') this.combatUntil = s.elapsed + MIX.combatHold }
      if (intense || (this.music === 'combat' && (s.elapsed < this.combatUntil || s.elapsed - this.quietSince < MIX.combatQuiet))) next = 'combat'
      if (s.enemies.some(e => e.type === 'core') || s.phaseIndex === 4) next = 'boss'
    }
    const active = graphicsReady && !s.paused
    const preview = active ? this.reviewUpdate?.(s) : undefined
    if (active) {
      const destroyed = new Set(s.events.filter(e => !this.consumed.has(e) && e.type === 'enemy-destroyed').map(e => e.id))
      for (const event of s.events) {
        if (this.consumed.has(event)) continue
        this.consumed.add(event)
        const position = event.position as { x: number } | undefined
        const enemy = s.enemies.find(e => e.id === event.id || e.id === event.owner)
        const pan = (position?.x ?? enemy?.position.x ?? 0) / 18
        switch (event.type) {
          case 'mission-started': this.manager.play('launch'); break
          case 'weapon-fired': this.manager.play(event.owner === 'player' ? 'playerShot' : 'enemyShot', event.owner === 'player' ? 0 : pan, 1 + ((this.shotSerial++ % 5) - 2) * .015); break
          case 'enemy-hit': if (!destroyed.has(event.id)) this.manager.play('hit', pan); break
          case 'player-hit': this.manager.play('shield'); this.manager.duck(); break
          case 'enemy-destroyed': this.manager.play(event.enemyType === 'core' ? 'coreExplosion' : 'explosion', pan); if (event.enemyType === 'core') this.manager.duck(); break
          case 'collision': if (s.hazards.some(h => h.id === event.b) && !s.events.some(e => e.type === 'player-hit' && e.time === event.time)) this.manager.play('hit'); break
          case 'enemy-spawned': if (event.enemyType === 'core') { this.manager.play('bossWarning'); this.manager.duck() }; break
          case 'mission-completed': this.manager.play('victory'); this.manager.duck(); break
          case 'game-over': this.manager.play('failure'); this.manager.duck(); break
        }
      }
    }
    if (active && s.status === 'playing') {
      this.manager.setEngine(Math.hypot(s.player.velocity.x, s.player.velocity.y) / 12, preview?.boost)
      if (!!preview?.boost !== this.previewBoost) { this.manager.play(preview?.boost ? 'boostStart' : 'boostEnd'); this.previewBoost = !!preview?.boost }
      const p = s.player.position
      const target = s.enemies.filter(e => e.position.z < -2 && Math.hypot(e.position.x - p.x, e.position.y - p.y) < e.radius + .4).sort((a, b) => b.position.z - a.position.z)[0]?.id ?? null
      if (target !== this.target) { this.target = target; this.targetSince = s.elapsed; this.lockPlayed = false }
      if (target && !this.lockPlayed && s.elapsed - this.targetSince >= .25) { this.manager.play('lock'); this.lockPlayed = true }
      if (s.player.shields <= 25 && s.elapsed >= this.warningAt) { this.manager.play('critical'); this.manager.duck(); this.warningAt = s.elapsed + 6 }
    } else this.manager.stopEngine()
    this.music = next; this.manager.setMusic(next); this.manager.update()
  }
  dispose() { this.manager.dispose() }
}
