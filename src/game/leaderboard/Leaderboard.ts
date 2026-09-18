import type { GameState } from '../state'
import { BOARD_VERSION, ONLINE_LIMIT, validDisplayName, validEntry, type ScoreEntry } from './rules'
import { LocalScores } from './LocalScores'
import './leaderboard.css'

type Ticket = { id: string; token: string; expires: number }
type Flight = { state: GameState; ticket: Promise<Ticket | null>; result?: ScoreEntry; best?: boolean; message: string; sharing: boolean; shared: boolean; submittedCallsign?: string }

/** Presentation/service adapter. No network result can change simulation. */
export class Leaderboard {
  readonly local = new LocalScores()
  private flight: Flight | null = null
  private dialog = document.createElement('dialog')
  private online: ScoreEntry[] = []
  private tab: 'online' | 'local' = 'online'
  private status = 'Loading online scores…'
  private requests = new Set<AbortController>()
  private disposed = false
  private renderKey = ''
  private refreshId = 0
  constructor() {
    this.dialog.dataset.leaderboard = ''
    this.dialog.className = 'leaderboard-dialog'
    this.dialog.setAttribute('aria-labelledby','leaderboard-title')
    this.dialog.innerHTML = `<header><div><small>CASUAL COMPETITION · ${BOARD_VERSION}</small><h2 id="leaderboard-title">Flight records</h2></div><button data-close autofocus aria-label="Close leaderboard">Close</button></header><p>Guest callsigns are not verified identities. Scores are browser-reported, not cheat-proof.</p><nav aria-label="Score lists"><button data-online>Online top 25</button><button data-local>On this device</button><button data-refresh>Refresh</button></nav><p data-status role="status"></p><ol data-rows></ol><section data-clear-area><button data-clear>Clear local scores</button><div data-confirm hidden><p>Clear this device’s scores? Online entries are unaffected.</p><button data-keep>Keep scores</button><button data-erase>Clear scores permanently</button></div></section>`
    document.body.append(this.dialog)
    const button = (selector: string, fn: () => void) => this.dialog.querySelector<HTMLButtonElement>(selector)!.onclick = fn
    button('[data-close]', ()=>this.dialog.close())
    button('[data-online]', ()=>{ this.tab='online'; this.renderBoard() })
    button('[data-local]', ()=>{ this.tab='local'; this.renderBoard() })
    button('[data-refresh]', ()=>{ void this.refresh() })
    button('[data-clear]', ()=>{ this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=false; this.dialog.querySelector<HTMLButtonElement>('[data-keep]')!.focus() })
    button('[data-keep]', ()=>{ this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=true; this.dialog.querySelector<HTMLButtonElement>('[data-clear]')!.focus() })
    button('[data-erase]', ()=>{ this.local.clear(); this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=true; this.renderBoard(); this.dialog.querySelector<HTMLButtonElement>('[data-clear]')!.focus() })
  }
  private async api(path: string, data?: unknown) {
    const controller = new AbortController(); this.requests.add(controller)
    const timeout = setTimeout(()=>controller.abort(), 4000)
    try {
      const response = await fetch(`/api/${path}`, { method:data ? 'POST':'GET', headers:data ? { 'Content-Type':'application/json' }:undefined, body:data ? JSON.stringify(data):undefined, signal:controller.signal, cache:'no-store' })
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Try later.' : response.status === 410 ? 'Run expired. Score remains local.' : 'Online service unavailable or score rejected.')
      return await response.json()
    } finally { clearTimeout(timeout); this.requests.delete(controller) }
  }
  private async ticket(): Promise<Ticket | null> {
    try {
      // Static hosting can still play locally, without posting to a nonexistent API.
      const board = await this.api('leaderboard')
      if (board.version !== BOARD_VERSION || !Array.isArray(board.entries)) return null
      const ticket = await this.api('runs', { version:BOARD_VERSION })
      return typeof ticket.id === 'string' && typeof ticket.token === 'string' && Number.isFinite(ticket.expires) ? ticket : null
    } catch { return null }
  }
  begin(state: GameState) {
    this.flight = { state, ticket:this.ticket(), message:'', sharing:false, shared:false }
    this.renderKey = ''
  }
  abandon() { this.flight = null; this.renderKey=''; if (this.dialog.open) this.dialog.close() }
  update(s: GameState) {
    const f = this.flight
    if (!f || f.state !== s || !['mission-complete','game-over'].includes(s.status)) return
    if (!f.result) {
      f.result = { id:crypto.randomUUID(), version:BOARD_VERSION, callsign:this.local.callsign, score:s.score, outcome:s.status === 'mission-complete' ? 'victory':'defeat', elapsed:s.elapsed, createdAt:new Date().toISOString() }
      f.best = this.local.add(f.result)
      f.message = this.local.persistent ? 'Saved on this device.' : 'Saved for this session only; browser storage unavailable.'
      void f.ticket.then(ticket=>{ if (!ticket) { f.message += ' Online registration unavailable; this run is local only.'; this.renderKey='' } })
    }
    this.renderResult(f)
  }
  private renderResult(f: Flight) {
    const host = document.querySelector('#overlay .end-card')
    if (!host || !f.result) return
    const key = f.result.id + f.message + f.sharing + f.shared + (f.submittedCallsign || '')
    if (key === this.renderKey && host.querySelector('[data-score-result]')) return
    this.renderKey=key
    host.querySelector('[data-score-result]')?.remove()
    const box = document.createElement('section'); box.dataset.scoreResult=''; box.className='score-result'
    const text = document.createElement('p'); text.setAttribute('role','status'); text.textContent=`${f.best ? 'New personal best! ' : ''}${f.message}`
    const label = document.createElement('label'); label.className='score-name-label'; label.textContent='Public display name (optional)'
    const name = document.createElement('input'); name.dataset.displayName=''; name.name='display-name'; name.maxLength=16; name.setAttribute('autocomplete','nickname'); name.spellcheck=false
    name.value=f.submittedCallsign || f.result.callsign; name.disabled=f.shared || f.sharing
    name.setAttribute('aria-describedby','display-name-help')
    const help = document.createElement('small'); help.id='display-name-help'; help.textContent='3–16 letters, numbers, spaces, hyphens, or underscores. Names are public and may be hidden.'
    const consent = document.createElement('small'); consent.textContent='Share this name, score, outcome and date publicly? No account required.'
    const share = document.createElement('button'); share.textContent=f.shared ? 'Score shared' : f.sharing ? 'Sharing…' : 'Share score online'; share.disabled=f.shared || f.sharing
    share.onclick=event=>{ event.stopPropagation(); void this.share(f) }
    box.append(text,label,name,help,consent,share); host.append(box)
  }
  private async share(f: Flight) {
    if (!f.result || f.shared || f.sharing) return
    const input = document.querySelector<HTMLInputElement>('[data-score-result] [data-display-name]')
    const callsign = f.submittedCallsign || (input ? input.value : f.result.callsign)
    if (!validDisplayName(callsign)) { f.message='Use a public name of 3–16 letters, numbers, spaces, hyphens, or underscores.'; this.renderKey=''; this.renderResult(f); return }
    f.submittedCallsign=callsign
    f.sharing=true; this.renderKey=''; this.renderResult(f)
    try {
      const ticket = await f.ticket
      if (!ticket) throw new Error('This run started offline. Score retained locally; play a new sortie when online.')
      const result = await this.api('scores', { id:ticket.id, token:ticket.token, version:BOARD_VERSION, score:f.result.score, elapsed:f.result.elapsed, outcome:f.result.outcome, callsign })
      if (result.accepted !== true || result.id !== ticket.id) throw new Error('Submission was not confirmed. You can retry safely.')
      f.shared=true; f.message='Shared online. Your local score is also retained.'
    } catch (error) { f.message = error instanceof Error ? error.message : 'Unable to share; score retained locally.' }
    finally { f.sharing=false; this.renderKey=''; if (this.flight===f) this.renderResult(f) }
  }
  show() {
    if (!this.dialog.open) this.dialog.showModal()
    this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus()
    this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=true
    void this.refresh()
  }
  private async refresh() {
    const request = ++this.refreshId
    this.status='Loading online scores…'; this.renderBoard()
    try {
      const body = await this.api('leaderboard')
      if (body.version !== BOARD_VERSION || !Array.isArray(body.entries) || body.entries.length > ONLINE_LIMIT || !body.entries.every(validEntry)) throw new Error('Invalid board')
      if (request !== this.refreshId || this.disposed) return
      this.online=body.entries; this.status='Online scores · current game version'
    } catch {
      if (request !== this.refreshId || this.disposed) return
      this.online=[]; this.tab='local'; this.status='Online leaderboard unavailable. Showing this device’s scores.'
    }
    this.renderBoard()
  }
  private renderBoard() {
    this.dialog.querySelector('[data-status]')!.textContent=(this.tab==='local' ? 'On this device · top 10. ' : '') + this.status + (this.local.persistent ? '' : ' Local storage unavailable; scores last only this session.')
    this.dialog.querySelector('[data-online]')!.setAttribute('aria-pressed',String(this.tab==='online'))
    this.dialog.querySelector('[data-local]')!.setAttribute('aria-pressed',String(this.tab==='local'))
    this.dialog.querySelector<HTMLElement>('[data-clear-area]')!.hidden=this.tab!=='local'
    const rows = this.dialog.querySelector('[data-rows]')!; rows.replaceChildren()
    const entries=this.tab==='online' ? this.online:this.local.entries
    if (!entries.length) { const empty=document.createElement('li'); empty.textContent='No scores yet. Finish a sortie to set a record.'; rows.append(empty) }
    entries.forEach((entry,index)=>{
      const row=document.createElement('li')
      const identity=document.createElement('span'); identity.textContent=`${index+1}. ${entry.callsign}`
      const score=document.createElement('strong'); score.textContent=entry.score.toLocaleString()
      const detail=document.createElement('small'); detail.textContent=`${entry.outcome==='victory'?'Signal restored':'Sortie ended'} · ${new Date(entry.createdAt).toLocaleDateString()}`
      if (entry.id === this.flight?.result?.id) row.className='new-score'
      row.append(identity,score,detail); rows.append(row)
    })
  }
  inspect() { return { localCount:this.local.entries.length, persistent:this.local.persistent, version:BOARD_VERSION, eligible:!!this.flight, recorded:!!this.flight?.result, shared:!!this.flight?.shared } }
  dispose() { this.disposed=true; this.flight=null; this.requests.forEach(c=>c.abort()); this.dialog.remove() }
}
