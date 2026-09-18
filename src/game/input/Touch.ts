import { CONFIG } from '../config'
import type { GameState } from '../state'

/** Relative finger displacement becomes a target, approached at normal flight speed. */
export class Touch {
  enabled = matchMedia('(pointer: coarse)').matches
  private pointer: number | null = null
  private last = { x: 0, y: 0 }
  private target = { x: 0, y: 0 }
  private prompt = document.createElement('div')
  private canvas: HTMLCanvasElement
  private state: () => GameState
  private pause: () => void
  constructor(canvas: HTMLCanvasElement, state: () => GameState, pause: () => void) {
    this.canvas=canvas; this.state=state; this.pause=pause
    this.prompt.className = 'rotate-prompt'
    this.prompt.textContent = 'Rotate your phone to landscape to fly.'
    document.body.append(this.prompt)
    document.body.classList.toggle('touch-play', this.enabled)
    canvas.addEventListener('pointerdown', this.down)
    canvas.addEventListener('pointermove', this.move)
    canvas.addEventListener('pointerup', this.end)
    canvas.addEventListener('pointercancel', this.end)
    canvas.addEventListener('lostpointercapture', this.end)
    window.addEventListener('resize', this.resize)
    this.resize()
  }
  get portrait() { return this.enabled && innerHeight > innerWidth }
  private resize = () => {
    this.prompt.hidden = !this.portrait
    this.clear()
    if (this.portrait) this.pause()
  }
  private down = (e: PointerEvent) => {
    const s = this.state()
    if (e.pointerType !== 'touch' || this.pointer !== null || s.status !== 'playing' || s.paused || this.portrait) return
    this.enabled = true; document.body.classList.add('touch-play')
    this.pointer = e.pointerId; this.last = { x:e.clientX, y:e.clientY }
    this.target = { x:s.player.position.x, y:s.player.position.y }
    this.canvas.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return
    const scale = 22 / Math.max(1, this.canvas.clientHeight)
    this.target.x = Math.max(-CONFIG.bounds.x, Math.min(CONFIG.bounds.x, this.target.x + (e.clientX-this.last.x)*scale))
    this.target.y = Math.max(-CONFIG.bounds.y, Math.min(CONFIG.bounds.y, this.target.y - (e.clientY-this.last.y)*scale))
    this.last = {x:e.clientX,y:e.clientY}; e.preventDefault()
  }
  private end = (e: PointerEvent) => { if (e.pointerId === this.pointer) this.clear() }
  clear() {
    const id = this.pointer; this.pointer = null
    if (id !== null && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id)
  }
  get axis() {
    const p = this.state().player.position
    let x = this.pointer === null ? 0 : (this.target.x-p.x)/(CONFIG.speed*CONFIG.step)
    let y = this.pointer === null ? 0 : (this.target.y-p.y)/(CONFIG.speed*CONFIG.step)
    const length = Math.max(1, Math.hypot(x,y)); x/=length; y/=length
    return {x,y,fire:this.enabled && !this.portrait}
  }
  dispose() {
    this.clear(); this.prompt.remove(); document.body.classList.remove('touch-play')
    this.canvas.removeEventListener('pointerdown',this.down)
    this.canvas.removeEventListener('pointermove',this.move)
    for (const type of ['pointerup','pointercancel','lostpointercapture']) this.canvas.removeEventListener(type,this.end as EventListener)
    window.removeEventListener('resize',this.resize)
  }
}
