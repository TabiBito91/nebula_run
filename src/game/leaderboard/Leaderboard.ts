import type { GameState } from '../state'
import { BOARD_VERSION, BOARDS, boardVersion, currentVersion, ONLINE_LIMIT, validDisplayName, validEntry, type ScoreEntry } from './rules'
import type { Difficulty } from '../difficulty'
import { LocalScores } from './LocalScores'
import './leaderboard.css'

type Ticket = { id: string; token: string; expires: number }
type Flight = { state: GameState; ticket: Promise<Ticket | null>; result?: ScoreEntry; best?: boolean; message: string; sharing: boolean; shared: boolean; submittedCallsign?: string; draft: string; nameSaved: boolean; registration: 'pending' | 'ready' | 'offline'; localMessage: string }

/** Presentation/service adapter. No network result can change simulation. */
export class Leaderboard {
  readonly local = new LocalScores()
  private flight: Flight | null = null
  private dialog = document.createElement('dialog')
  private saveDialog = document.createElement('dialog')
  private archived = false
  private currentBoard = BOARD_VERSION
  private online: ScoreEntry[] = []
  private tab: 'online' | 'local' = 'online'
  private status = 'Loading online scores…'
  private requests = new Set<AbortController>()
  private disposed = false
  private renderKey = ''
  private refreshId = 0
  private version = BOARD_VERSION
  constructor() {
    this.dialog.dataset.leaderboard = ''
    this.dialog.className = 'leaderboard-dialog'
    this.dialog.setAttribute('aria-labelledby','leaderboard-title')
    this.dialog.innerHTML = `<header><div><small>CASUAL COMPETITION</small><h2 id="leaderboard-title">Flight records</h2></div><button data-close autofocus aria-label="Close leaderboard">Close</button></header><p>Guest callsigns are not verified identities. Scores are browser-reported, not cheat-proof.</p><nav aria-label="Score lists"><button data-online>Online top 25</button><button data-local>On this device</button><button data-refresh>Refresh</button></nav><p data-status role="status"></p><ol data-rows></ol><button data-archive class="archive-link">Archived rankings</button><p data-archive-help hidden>Previous rules · read-only. These scores are kept separate for fair comparisons.</p><section data-clear-area><button data-clear>Clear local scores</button><div data-confirm hidden><p>Clear this device’s scores? Online entries are unaffected.</p><button data-keep>Keep scores</button><button data-erase>Clear scores permanently</button></div></section>`
    document.body.append(this.dialog)
    const filter = document.createElement('label')
    filter.className = 'difficulty-settings'
    filter.innerHTML = `Ranking <select aria-label="Ranking difficulty"></select>`
    const select = filter.querySelector('select')!
    select.onchange = () => { this.version = select.value; if (!this.archived) this.currentBoard = this.version; this.online = []; void this.refresh() }
    const toolbar = document.createElement('div'); toolbar.className = 'ranking-toolbar'
    toolbar.append(filter, this.dialog.querySelector('[data-archive]')!)
    this.dialog.querySelector('nav')!.before(toolbar, this.dialog.querySelector('[data-archive-help]')!)
    this.updateRankingOptions()
    const button = (selector: string, fn: () => void) => this.dialog.querySelector<HTMLButtonElement>(selector)!.onclick = fn
    button('[data-close]', ()=>this.dialog.close())
    button('[data-online]', ()=>{ this.tab='online'; this.renderBoard() })
    button('[data-local]', ()=>{ this.tab='local'; this.renderBoard() })
    button('[data-refresh]', ()=>{ void this.refresh() })
    button('[data-archive]', ()=>{
      this.archived = !this.archived
      this.version = this.archived ? BOARDS.find(b => !currentVersion(b.version))!.version : this.currentBoard
      this.online = []; this.updateRankingOptions(); void this.refresh()
    })
    button('[data-clear]', ()=>{ this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=false; this.dialog.querySelector<HTMLButtonElement>('[data-keep]')!.focus() })
    button('[data-keep]', ()=>{ this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=true; this.dialog.querySelector<HTMLButtonElement>('[data-clear]')!.focus() })
    button('[data-erase]', ()=>{ this.local.clear(); this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=true; this.renderBoard(); this.dialog.querySelector<HTMLButtonElement>('[data-clear]')!.focus() })
    this.saveDialog.dataset.saveScoreDialog = ''
    this.saveDialog.className = 'leaderboard-dialog save-score-dialog'
    this.saveDialog.setAttribute('aria-labelledby', 'save-score-title')
    this.saveDialog.addEventListener('close', () => document.querySelector<HTMLButtonElement>('[data-open-save]')?.focus())
    document.body.append(this.saveDialog)
  }
  private updateRankingOptions() {
    const select = this.dialog.querySelector('select')!
    select.replaceChildren(...BOARDS.filter(b => currentVersion(b.version) !== this.archived).map(b => new Option(b.label, b.version)))
    select.value = this.version
    this.dialog.querySelector('[data-archive]')!.textContent = this.archived ? 'Back to current rankings' : 'Archived rankings'
    this.dialog.querySelector<HTMLElement>('[data-archive-help]')!.hidden = !this.archived
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
  private async ticket(version: string): Promise<Ticket | null> {
    try {
      // Static hosting can still play locally, without posting to a nonexistent API.
      const board = await this.api(`leaderboard?version=${encodeURIComponent(version)}`)
      if (board.version !== version || !Array.isArray(board.entries)) return null
      const ticket = await this.api('runs', { version })
      return typeof ticket.id === 'string' && typeof ticket.token === 'string' && Number.isFinite(ticket.expires) ? ticket : null
    } catch { return null }
  }
  begin(state: GameState) {
    const f: Flight = { state, ticket:this.ticket(boardVersion(state.difficulty)), message:'', sharing:false, shared:false, draft:this.local.callsign, nameSaved:false, registration:'pending', localMessage:'' }
    this.flight = f
    void f.ticket.then(ticket => { f.registration = ticket ? 'ready' : 'offline'; if (this.flight === f) this.renderKey = '' })
    this.renderKey = ''
  }
  abandon() { this.flight = null; this.renderKey=''; if (this.dialog.open) this.dialog.close(); if (this.saveDialog.open) this.saveDialog.close() }
  update(s: GameState) {
    const f = this.flight
    if (!f || f.state !== s || !['mission-complete','game-over'].includes(s.status)) return
    if (!f.result) {
      f.result = { id:crypto.randomUUID(), version:boardVersion(s.difficulty), callsign:this.local.callsign, score:s.score, outcome:s.status === 'mission-complete' ? 'victory':'defeat', elapsed:s.elapsed, createdAt:new Date().toISOString() }
      f.best = this.local.add(f.result)
      f.localMessage = this.local.persistent ? 'Score saved on this device.' : 'Score kept for this session only; browser storage unavailable.'
    }
    this.renderResult(f)
  }
  private renderResult(f: Flight) {
    const host = document.querySelector('#overlay .end-card')
    if (!host || !f.result) return
    const key = JSON.stringify([f.result.id, f.message, f.sharing, f.shared, f.submittedCallsign, f.draft, f.nameSaved, f.registration, f.localMessage])
    if (key === this.renderKey && host.querySelector('[data-score-result]')) return
    this.renderKey=key
    let box = host.querySelector<HTMLElement>('[data-score-result]')
    if (!box) {
    box = document.createElement('section'); box.dataset.scoreResult=''; box.className='score-result'
    const text = document.createElement('p'); text.setAttribute('role','status'); text.setAttribute('aria-live','polite')
    const open = document.createElement('button'); open.dataset.openSave=''; open.textContent='Save score'
    open.onclick = event => { event.stopPropagation(); this.openSave(f) }
    box.append(open,text)
    const menu = host.querySelector('[data-menu]')
    if (menu) menu.before(box); else host.append(box)
    }
    box.querySelector('[role="status"]')!.textContent = `${f.best ? 'New personal best! ' : ''}${f.localMessage}${f.shared ? ' Shared online.' : f.sharing ? ' Sharing online…' : f.submittedCallsign ? ' Online sharing not confirmed.' : ''}`
    box.querySelector('[data-open-save]')!.textContent = f.shared ? 'Score details' : f.submittedCallsign ? 'Retry sharing' : 'Save score'
    if (this.saveDialog.open) this.renderSave(f)
  }
  private openSave(f: Flight) {
    if (this.flight !== f || !f.result) return
    this.saveDialog.innerHTML = '<h2 id="save-score-title">Save score</h2><form class="score-form"><p role="status" aria-live="polite"></p></form>'
    const box = this.saveDialog.querySelector('form')!
    const label = document.createElement('label'); label.className='score-name-label'; label.textContent='Display name'
    const name = document.createElement('input'); name.dataset.displayName=''; name.name='display-name'; name.maxLength=16; name.setAttribute('autocomplete','nickname'); name.spellcheck=false
    name.id='public-display-name'; label.htmlFor=name.id
    name.oninput = () => { f.draft = name.value; f.message = ''; this.renderResult(f) }
    name.setAttribute('aria-describedby','display-name-help')
    const help = document.createElement('small'); help.id='display-name-help'; help.textContent='3–16 letters, numbers, spaces, hyphens, or underscores.'
    const consent = document.createElement('label'); consent.className='share-consent'
    const check = document.createElement('input'); check.type='checkbox'; check.dataset.consent=''; check.checked=!!f.submittedCallsign
    consent.append(check, document.createTextNode('Also share on the public leaderboard'))
    const privacy = document.createElement('small'); privacy.textContent='If selected, your name, score, outcome and date are public. No account required.'
    const save = document.createElement('button'); save.type='submit'; save.dataset.saveName=''; save.textContent='Save'
    box.onsubmit = event => {
      event.preventDefault()
      if (f.sharing || f.shared || this.flight !== f) return
      if (!f.submittedCallsign && !this.saveName(f)) return
      if (check.checked) void this.share(f)
      else this.saveDialog.close()
    }
    const lock = document.createElement('small'); lock.dataset.nameLock=''
    const cancel = document.createElement('button'); cancel.type='button'; cancel.dataset.cancelSave=''; cancel.textContent='Cancel'; cancel.onclick=()=>this.saveDialog.close()
    const actions = document.createElement('div'); actions.className='score-actions'; actions.append(cancel, save)
    box.append(label,name,help,consent,privacy,lock,actions)
    this.saveDialog.showModal(); this.renderSave(f); (name.disabled ? cancel : name).focus()
  }
  private renderSave(f: Flight) {
    if (!f.result) return
    const box = this.saveDialog
    // Update in place: async registration/status changes must not erase a draft or its focus.
    const registration = f.registration === 'offline' ? ' Online registration unavailable; this run is local only.' : f.registration === 'pending' ? ' Checking online availability…' : ''
    box.querySelector('[role="status"]')!.textContent = `${f.localMessage}${registration}${f.sharing ? ' Sharing online… Closing this dialog will not cancel the submission.' : f.message ? ' ' + f.message : ''}`
    const name = box.querySelector<HTMLInputElement>('[data-display-name]')!
    if (name.value !== f.draft) name.value = f.draft
    name.disabled = f.sharing || !!f.submittedCallsign
    const check = box.querySelector<HTMLInputElement>('[data-consent]')!
    check.disabled = f.sharing || !!f.submittedCallsign || f.registration !== 'ready'
    if (!f.submittedCallsign && f.registration !== 'ready') check.checked = false
    box.querySelector('[data-name-lock]')!.textContent = f.submittedCallsign ? (f.shared ? 'Name fixed for this shared score.' : 'Name locked because the server may have received it. Retry sends the same saved name. Stay on this results screen to retry.') : ''
    const save = box.querySelector<HTMLButtonElement>('[data-save-name]')!
    save.textContent = f.shared ? 'Saved' : f.sharing ? 'Saving…' : f.submittedCallsign ? 'Retry sharing' : 'Save'
    save.disabled = f.shared || f.sharing
    box.querySelector('[data-cancel-save]')!.textContent = f.sharing || f.submittedCallsign ? 'Close' : 'Cancel'
  }
  private saveName(f: Flight) {
    if (!f.result || f.sharing || f.submittedCallsign) return false
    if (!validDisplayName(f.draft)) {
      f.message = 'Use a name of 3–16 letters, numbers, spaces, hyphens, or underscores.'
      this.renderResult(f); return false
    }
    const retained = this.local.rename(f.result.id, f.draft)
    f.result = { ...f.result, callsign:f.draft }
    f.nameSaved = true; f.message = ''
    f.localMessage = !retained ? 'Name saved for this run. Score is outside this device’s top 10 or was cleared.' : this.local.persistent ? 'Name and score saved locally.' : 'Name and score saved for this session only; browser storage unavailable.'
    this.renderResult(f)
    return true
  }
  private async share(f: Flight) {
    if (!f.result || f.shared || f.sharing || !f.nameSaved || f.draft !== f.result.callsign || f.registration !== 'ready') return
    const callsign = f.submittedCallsign || f.result.callsign
    f.sharing=true; this.renderKey=''; this.renderResult(f)
    try {
      const ticket = await f.ticket
      if (!ticket) throw new Error('This run started offline. Score retained locally; play a new sortie when online.')
      // Lock only once a POST is about to be attempted. An uncertain response
      // may still mean acceptance; retries must retain the exact original name.
      f.submittedCallsign = callsign
      const result = await this.api('scores', { id:ticket.id, token:ticket.token, version:f.result.version, score:f.result.score, elapsed:f.result.elapsed, outcome:f.result.outcome, callsign })
      if (result.accepted !== true || result.id !== ticket.id) throw new Error('Submission was not confirmed. You can retry safely.')
      f.shared=true; f.message='Shared online. Open Leaderboard to view the matching online ranking.'
      this.tab = 'online'
    } catch (error) { f.message = `Couldn’t confirm online sharing. ${error instanceof Error ? error.message : 'Score retained locally.'} Retry sharing safely.` }
    finally { f.sharing=false; this.renderKey=''; if (this.flight===f) { this.renderResult(f); if (f.shared && this.saveDialog.open) this.saveDialog.close() } }
  }
  show(difficulty: Difficulty = 'standard') {
    this.version = boardVersion(difficulty); this.online = []
    this.currentBoard = this.version; this.archived = false; this.updateRankingOptions()
    if (!this.dialog.open) this.dialog.showModal()
    this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus()
    this.dialog.querySelector<HTMLElement>('[data-confirm]')!.hidden=true
    void this.refresh()
  }
  private async refresh() {
    const request = ++this.refreshId
    const version = this.version
    this.status='Loading online scores…'; this.renderBoard()
    try {
      const body = await this.api(`leaderboard?version=${encodeURIComponent(version)}`)
      if (body.version !== version || !Array.isArray(body.entries) || body.entries.length > ONLINE_LIMIT || !body.entries.every((e: unknown) => validEntry(e) && e.version === version)) throw new Error('Invalid board')
      if (request !== this.refreshId || this.disposed) return
      this.online=body.entries; this.status=`Online scores · ${BOARDS.find(b => b.version === version)!.label}`
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
    const entries=this.tab==='online' ? this.online:this.local.entries.filter(e => e.version === this.version)
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
  inspect() { return { localCount:this.local.entries.length, persistent:this.local.persistent, version:this.flight ? boardVersion(this.flight.state.difficulty) : this.version, eligible:!!this.flight, recorded:!!this.flight?.result, shared:!!this.flight?.shared } }
  dispose() { this.disposed=true; this.flight=null; this.requests.forEach(c=>c.abort()); this.dialog.remove(); this.saveDialog.remove() }
}
