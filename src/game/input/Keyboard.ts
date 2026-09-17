export class Keyboard {
  held = new Set<string>()
  private onAction: (key: string) => void
  private onBlur: () => void
  constructor(onAction: (key: string) => void, onBlur: () => void) {
    this.onAction = onAction
    this.onBlur = onBlur
    window.addEventListener('keydown', this.down)
    window.addEventListener('keyup', this.up)
    window.addEventListener('blur', this.blur)
    document.addEventListener('visibilitychange', this.visibility)
  }
  private down = (event: KeyboardEvent) => {
    if (document.querySelector('dialog[data-quit-dialog][open]')) return
    if (event.target instanceof Element && event.target.closest('[data-audio-controls]')) return
    if (event.target instanceof Element && event.target.closest('#overlay button') && ['Enter', 'Space'].includes(event.code)) return
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.code)) event.preventDefault()
    this.held.add(event.code)
    if (!event.repeat) this.onAction(event.code)
  }
  private up = (event: KeyboardEvent) => { this.held.delete(event.code) }
  private blur = () => { this.clear(); this.onBlur() }
  private visibility = () => { if (document.hidden) this.blur() }
  clear() { this.held.clear() }
  get axis() {
    let x = Number(this.held.has('KeyD') || this.held.has('ArrowRight')) - Number(this.held.has('KeyA') || this.held.has('ArrowLeft'))
    let y = Number(this.held.has('KeyW') || this.held.has('ArrowUp')) - Number(this.held.has('KeyS') || this.held.has('ArrowDown'))
    const length = Math.hypot(x, y)
    if (length > 1) { x /= length; y /= length }
    return { x, y, fire: this.held.has('Space') }
  }
  dispose() {
    window.removeEventListener('keydown', this.down)
    window.removeEventListener('keyup', this.up)
    window.removeEventListener('blur', this.blur)
    document.removeEventListener('visibilitychange', this.visibility)
  }
}
