import type { GameState } from '../state'
import { boardVersion } from '../leaderboard/rules'
import './feedback.css'

/** A level supplies metadata here; neither the form nor storage knows level internals. */
export function feedbackContext(s: GameState, touch: boolean, level = { id:'signalbreak', name:'Relay belt' }) {
  return { schema:1, build:import.meta.env.VITE_BUILD_ID || 'development', levelId:level.id, levelName:level.name,
    difficulty:s.difficulty, rules:boardVersion(s.difficulty),
    screen:s.status === 'title' ? 'title' : s.status === 'playing' ? 'pause' : s.status === 'mission-complete' ? 'victory' : 'defeat',
    phase:s.status === 'title' ? null : s.phase.name, elapsed:s.status === 'title' ? null : Math.round(s.elapsed), controls:touch ? 'touch' : 'keyboard' }
}
export class Feedback {
  private dialog = document.createElement('dialog')
  private form: HTMLFormElement
  private message: HTMLTextAreaElement
  private status: HTMLElement
  private send: HTMLButtonElement
  private context: ReturnType<typeof feedbackContext> | null = null
  private payload: { id:string; category:string; message:string; feeling:string; context:ReturnType<typeof feedbackContext> } | null = null
  private pending = false
  private controller: AbortController | null = null
  constructor() {
    this.dialog.className = 'feedback-dialog'
    this.dialog.dataset.feedback = ''
    this.dialog.setAttribute('aria-labelledby','feedback-title')
    this.dialog.innerHTML = `<h2 id="feedback-title">Send feedback</h2><form>
      <fieldset><label>Feedback type<select name="category"><option value="other">Other</option><option value="bug">Bug</option><option value="difficulty">Difficulty</option><option value="suggestion">Suggestion</option></select></label>
      <label>Your feedback<textarea name="message" required maxlength="1000" rows="4" placeholder="What happened, or what would you improve?" aria-describedby="feedback-count"></textarea></label>
      <small id="feedback-count">0 / 1,000 characters</small>
      <label>How did the difficulty feel? (optional)<select name="feeling"><option value="">No answer</option><option value="easy">Too easy</option><option value="right">About right</option><option value="hard">Too hard</option></select></label></fieldset>
      <p>Feedback is private and retained for up to 180 days, with cleanup on new submissions. Please don’t include personal information.</p>
      <details><summary>Included details</summary><pre></pre><p>No player name, screenshots, or logs. A temporary hashed network identifier limits spam; no raw IP is stored with feedback.</p></details>
      <p role="status" aria-live="polite"></p><div class="feedback-actions"><button type="submit">Send feedback</button><button type="button" data-close>Cancel</button></div>
      <div data-discard hidden><p>Discard this draft? An attempted submission may already have arrived.</p><button type="button" data-keep>Keep editing</button><button type="button" data-discard-confirm>Discard draft</button></div>
      </form>`
    document.body.append(this.dialog)
    this.form = this.dialog.querySelector('form')!
    this.message = this.dialog.querySelector('textarea')!
    this.status = this.dialog.querySelector('[role=status]')!
    this.send = this.dialog.querySelector('[type=submit]')!
    this.form.addEventListener('submit', e => { e.preventDefault(); void this.submit() })
    this.message.addEventListener('input', () => { this.dialog.querySelector('#feedback-count')!.textContent = `${this.message.value.length} / 1,000 characters` })
    this.dialog.querySelector('[data-close]')!.addEventListener('click', () => this.close())
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); this.close() })
    this.dialog.querySelector('[data-keep]')!.addEventListener('click', () => { this.discard.hidden = true; this.message.focus() })
    this.dialog.querySelector('[data-discard-confirm]')!.addEventListener('click', () => { this.reset(); this.dialog.close() })
  }
  private get discard() { return this.dialog.querySelector<HTMLElement>('[data-discard]')! }
  show(context: ReturnType<typeof feedbackContext>) {
    if (this.dialog.open) return
    this.context ??= context
    this.dialog.querySelector('pre')!.textContent = JSON.stringify(this.context, null, 2)
    this.dialog.showModal(); this.message.focus()
  }
  private close() {
    if (this.pending) { this.status.textContent = 'Sending—please wait for confirmation.'; return }
    if (this.message.value.trim()) { this.discard.hidden = false; this.dialog.querySelector<HTMLButtonElement>('[data-keep]')!.focus(); return }
    this.reset(); this.dialog.close()
  }
  private reset() {
    this.form.reset(); this.payload = null; this.context = null; this.status.textContent = ''; this.discard.hidden = true
    this.form.querySelector('fieldset')!.disabled = false; this.send.disabled = false; this.send.textContent = 'Send feedback'
    this.dialog.querySelector('[data-close]')!.textContent = 'Cancel'
    this.dialog.querySelector('#feedback-count')!.textContent = '0 / 1,000 characters'
  }
  private async submit() {
    if (this.pending || !this.context) return
    if (!this.message.value.trim()) { this.status.textContent = 'Please enter a message.'; return }
    this.payload ??= { id:crypto.randomUUID(), category:(this.form.elements.namedItem('category') as HTMLSelectElement).value,
      message:this.message.value.trim(), feeling:(this.form.elements.namedItem('feeling') as HTMLSelectElement).value, context:this.context }
    this.pending = true; this.send.disabled = true; this.form.querySelector('fieldset')!.disabled = true
    this.status.textContent = 'Sending…'; this.discard.hidden = true
    const controller = this.controller = new AbortController(), timer = window.setTimeout(()=>controller.abort(),8000)
    try {
      const res = await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(this.payload), signal:controller.signal })
      if (!res.ok) throw new Error(res.status === 429 ? 'Too many attempts. Please wait ten minutes before retrying.' : 'Could not confirm delivery.')
      const result = await res.json()
      if (result.accepted !== true || result.id !== this.payload.id) throw new Error('Could not confirm delivery.')
      this.reset(); this.status.textContent = 'Thanks—your feedback was sent!'; this.send.disabled = true
      this.dialog.querySelector('[data-close]')!.textContent = 'Done'
      this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus()
    } catch (error) {
      this.status.textContent = `${error instanceof Error && error.name !== 'AbortError' ? error.message : 'Could not confirm delivery.'} Your draft is kept. Retry sends the same submission without duplicates. Discard to start a different message.`
      this.send.textContent = 'Retry'; this.send.disabled = false
    } finally { clearTimeout(timer); this.pending = false; this.controller = null }
  }
  dispose() { this.controller?.abort(); this.dialog.remove() }
}
