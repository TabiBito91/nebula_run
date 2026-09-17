/** Small local flight journal survives reloads; it is never sent anywhere. */
export class Diagnostics {
  private key = 'nebula-run:last-flight'
  previous: unknown = null
  private lastWrite = -Infinity
  private notice = document.createElement('div')
  constructor() {
    try { this.previous = JSON.parse(localStorage.getItem(this.key) || 'null') } catch { /* Storage may be disabled. */ }
    this.notice.setAttribute('role', 'alert')
    this.notice.hidden = true
    this.notice.style.cssText = 'position:fixed;inset:25% 15% auto;z-index:100;background:#08131d;color:#dcebea;padding:32px;border:1px solid #76eed2;font:16px sans-serif'
    document.body.append(this.notice)
  }
  record(data: unknown, force = false) {
    if (!force && performance.now() - this.lastWrite < 1000) return
    this.lastWrite = performance.now()
    try { localStorage.setItem(this.key, JSON.stringify({ recordedAt: new Date().toISOString(), data })) } catch { /* Diagnostics must never stop play. */ }
  }
  show(message: string) {
    this.notice.replaceChildren(document.createTextNode(message), document.createElement('br'))
    const reload = document.createElement('button')
    reload.textContent = 'Reload game'
    reload.onclick = () => location.reload()
    this.notice.append(reload)
    this.notice.hidden = false
  }
  hide() { this.notice.hidden = true }
  dispose() { this.notice.remove() }
}
