import { CONFIG } from './config'
import { Keyboard } from './input/Keyboard'
import { Renderer } from './rendering/Renderer'
import { Hud } from './ui/Hud'
import { createMission } from './scenes/mission'
import { GameState } from './state'
import { updateMission } from './systems/spawning'
import { move } from './systems/movement'
import { combat } from './systems/combat'

export class Game {
  state = createMission()
  renderer: Renderer
  input: Keyboard
  hud: Hud
  errors: { message: string; source: string }[] = []
  private accumulator = 0
  private lastTime = 0
  private frameId = 0
  private generation = 0
  private disposed = false
  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    window.addEventListener('error', this.onError)
    window.addEventListener('unhandledrejection', this.onRejection)
    this.renderer = new Renderer(canvas)
    this.input = new Keyboard(key => this.key(key), () => this.pause())
    this.hud = new Hud(ui, () => this.action())
    canvas.addEventListener('webglcontextlost', this.contextLost)
    this.frameId = requestAnimationFrame(this.frame)
  }
  private onError = (e: ErrorEvent) => { this.capture(e.message, e.filename || 'window') }
  private onRejection = (e: PromiseRejectionEvent) => { this.capture(String(e.reason), 'unhandledrejection') }
  private contextLost = () => { this.capture('WebGL context lost. Reload to recover.', 'renderer'); this.pause() }
  capture(message: string, source: string) { this.errors.push({ message, source }); if (this.errors.length > 50) this.errors.shift() }
  private key(key: string) {
    if (key === 'KeyP' || key === 'Escape') { if (this.state.status === 'playing') this.state.paused ? this.resume() : this.pause() }
    if (key === 'Enter' && this.state.status === 'title') this.start()
    if (key === 'KeyR' && ['game-over', 'mission-complete'].includes(this.state.status)) this.start(true)
  }
  private action() {
    if (this.state.status === 'title') this.start()
    else if (this.state.status !== 'playing') this.start(true)
    else this.state.paused ? this.resume() : this.pause()
  }
  start(restarted = false) {
    this.replace(createMission(true))
    if (restarted) this.state.event('game-restarted')
  }
  replace(s: GameState) {
    this.input.clear(); this.accumulator = 0
    s.generation = ++this.generation; this.state = s
  }
  pause() {
    if (this.state.status === 'playing') this.state.paused = true
    this.input.clear(); this.accumulator = 0
  }
  resume() {
    if (this.state.status === 'playing') { this.state.paused = false; this.input.clear(); this.accumulator = 0 }
  }
  target() {
    const p = this.state.player.position
    return this.state.enemies.filter(e => e.position.z < -2 && Math.hypot(e.position.x - p.x, e.position.y - p.y) < e.radius + 0.4).sort((a, b) => b.position.z - a.position.z)[0] ?? null
  }
  private frame = (time: number) => {
    if (this.disposed) return
    const wallDt = this.lastTime ? (time - this.lastTime) / 1000 : CONFIG.step
    this.lastTime = time
    const s = this.state
    let simulatedDt = 0
    if (s.status === 'playing' && !s.paused) {
      this.accumulator += Math.min(0.1, wallDt)
      while (this.accumulator >= CONFIG.step && s.status === 'playing') {
        s.elapsed += CONFIG.step
        updateMission(s)
        if (s.status === 'playing') { move(s, this.input.axis, CONFIG.step); combat(s, this.input.axis.fire, this.renderer.activeShip === 'strix') }
        this.accumulator -= CONFIG.step; simulatedDt += CONFIG.step
      }
    } else this.accumulator = 0
    this.renderer.render(s, s.paused || s.status !== 'playing' ? 1 : this.accumulator / CONFIG.step, wallDt, simulatedDt)
    this.hud.update(s, this.renderer.reticle, this.target()?.id ?? null, this.renderer.activeShip)
    s.ready = this.renderer.strix.status !== 'pending'
    this.frameId = requestAnimationFrame(this.frame)
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frameId); this.input.dispose()
    this.renderer.webgl.domElement.removeEventListener('webglcontextlost', this.contextLost)
    this.renderer.dispose()
    window.removeEventListener('error', this.onError); window.removeEventListener('unhandledrejection', this.onRejection)
  }
}
