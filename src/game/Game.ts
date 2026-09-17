import { CONFIG } from './config'
import { Keyboard } from './input/Keyboard'
import { Renderer } from './rendering/Renderer'
import { Hud } from './ui/Hud'
import { createMission } from './scenes/mission'
import { GameState } from './state'
import { updateMission } from './systems/spawning'
import { move } from './systems/movement'
import { combat } from './systems/combat'
import { Diagnostics } from './Diagnostics'
import { AudioSession } from './audio/AudioSession'
import { AudioControls } from './ui/AudioControls'

export class Game {
  state = createMission()
  renderer: Renderer
  input: Keyboard
  hud: Hud
  errors: { message: string; source: string }[] = []
  readonly diagnostics = new Diagnostics()
  readonly audio = new AudioSession()
  private audioControls: AudioControls
  graphicsState: 'ready' | 'lost' | 'failed' = 'ready'
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
    this.audioControls = new AudioControls(this.audio.manager, () => this.input.clear())
    canvas.addEventListener('webglcontextlost', this.contextLost)
    canvas.addEventListener('webglcontextrestored', this.contextRestored)
    this.renderer.webgl.debug.onShaderError = (gl, program, vertex, fragment) => {
      this.fail([gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].join('\n'), 'shader')
    }
    this.frameId = requestAnimationFrame(this.frame)
  }
  private onError = (e: ErrorEvent) => { this.capture(e.message, e.filename || 'window'); if (this.renderer) this.recordDiagnostic(true) }
  private onRejection = (e: PromiseRejectionEvent) => { this.capture(String(e.reason), 'unhandledrejection'); if (this.renderer) this.recordDiagnostic(true) }
  private contextLost = (event: Event) => {
    event.preventDefault()
    this.graphicsState = 'lost'; this.pause()
    this.capture('WebGL context lost', 'renderer'); this.recordDiagnostic(true)
    this.diagnostics.show('Graphics connection interrupted. Your flight is paused while graphics recover. You can also reload the game.')
  }
  private contextRestored = () => {
    if (this.graphicsState !== 'lost') return
    this.graphicsState = 'ready'; this.lastTime = 0; this.accumulator = 0
    this.diagnostics.hide(); this.recordDiagnostic(true)
    // Remain paused so restoration cannot cause an unseen collision.
  }
  private fail(message: string, source: string) {
    this.graphicsState = 'failed'; this.pause(); this.capture(message, source)
    this.recordDiagnostic(true)
    this.diagnostics.show('Flight stopped after an unexpected error. A diagnostic report was saved on this device. Reload to return to the menu.')
  }
  private recordDiagnostic(force = false) {
    this.diagnostics.record({ graphicsState: this.graphicsState, scene: this.state.scene, status: this.state.status,
      time: this.state.elapsed, events: this.state.events.slice(-20), errors: this.errors,
      metrics: this.renderer.metrics, ship: { status: this.renderer.strix.status, error: this.renderer.strix.error },
      viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio } }, force)
  }
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
    if (this.graphicsState !== 'ready') return
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
    this.audio.manager.setPaused(true)
  }
  resume() {
    if (this.graphicsState !== 'ready') return
    if (this.state.status === 'playing') { this.state.paused = false; this.input.clear(); this.accumulator = 0 }
  }
  target() {
    const p = this.state.player.position
    return this.state.enemies.filter(e => e.position.z < -2 && Math.hypot(e.position.x - p.x, e.position.y - p.y) < e.radius + 0.4).sort((a, b) => b.position.z - a.position.z)[0] ?? null
  }
  private frame = (time: number) => {
    if (this.disposed) return
    if (this.graphicsState !== 'ready') { this.audio.manager.setPaused(true); this.frameId = requestAnimationFrame(this.frame); return }
    try {
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
    this.audio.update(s, this.graphicsState === 'ready')
    this.renderer.render(s, s.paused || s.status !== 'playing' ? 1 : this.accumulator / CONFIG.step, wallDt, simulatedDt)
    this.hud.update(s, this.renderer.reticle, this.target()?.id ?? null, this.renderer.activeShip)
    s.ready = this.renderer.strix.status !== 'pending'
    this.recordDiagnostic()
    } catch (error) { this.fail(error instanceof Error ? error.stack || error.message : String(error), 'frame') }
    this.frameId = requestAnimationFrame(this.frame)
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frameId); this.input.dispose()
    this.audioControls.dispose(); this.audio.dispose()
    this.renderer.webgl.domElement.removeEventListener('webglcontextlost', this.contextLost)
    this.renderer.webgl.domElement.removeEventListener('webglcontextrestored', this.contextRestored)
    this.diagnostics.dispose()
    this.renderer.dispose()
    window.removeEventListener('error', this.onError); window.removeEventListener('unhandledrejection', this.onRejection)
  }
}
