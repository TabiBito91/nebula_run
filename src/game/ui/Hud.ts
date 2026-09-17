import { GameState } from '../state'

export class Hud {
  private root: HTMLElement
  private score: HTMLElement
  private shields: HTMLElement
  private fill: HTMLElement
  private progress: HTMLElement
  private phase: HTMLElement
  private hint: HTMLElement
  private time: HTMLElement
  private overlay: HTMLElement
  private reticle: HTMLElement
  private core: HTMLElement
  private previousOverlay = ''
  constructor(root: HTMLElement, action: () => void) {
    this.root = root
    root.innerHTML = `
      <header class="topbar"><div class="brand"><span class="brand-mark">⌁</span> NEBULA<span class="brand-light">RUN</span><small>SIGNALBREAK</small></div><div class="mission-tag"><i></i> SOLO SORTIE <span> / </span> NR—01</div><button class="pause-button" aria-label="Pause or resume">Ⅱ <span>PAUSE</span></button></header>
      <section class="mission-info"><div class="eyebrow">RELAY BELT / OUTER SECTOR</div><h1 id="phase"></h1><p id="hint"></p></section>
      <div class="score-box"><span class="eyebrow">FLIGHT SCORE</span><strong id="score">000000</strong></div>
      <div id="core" class="core-bar"></div>
      <div class="reticle" id="reticle"><span></span><b>+</b></div><div class="damage-vignette"></div>
      <footer class="telemetry"><div class="shield-module"><div class="module-label"><span>◈ &nbsp; SHIELD INTEGRITY</span><strong id="shields">100<span>%</span></strong></div><div class="shield-track"><div id="shield-fill"></div></div><small>COURIER / KESTREL-9</small></div><div class="route-module"><div class="module-label"><span>MISSION TRANSIT</span><span id="time">00:00 / 02:30</span></div><div class="route-track"><div id="progress"></div><i></i><i></i><i></i><i></i></div><small>APPROACH <span>BLOCKADE CORE</span></small></div><div class="flight-status"><span class="status-dot"></span> AUTO-FLIGHT ACTIVE<small>WASD MOVE &nbsp;·&nbsp; SPACE FIRE</small></div></footer>
      <section id="overlay" class="overlay"></section>`
    const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!
    this.score = el('score'); this.shields = el('shields'); this.fill = el('shield-fill'); this.progress = el('progress')
    this.phase = el('phase'); this.hint = el('hint'); this.time = el('time'); this.overlay = el('overlay'); this.reticle = el('reticle'); this.core = el('core')
    root.querySelector('button')!.addEventListener('click', () => { action(); (document.activeElement as HTMLElement)?.blur() })
    this.overlay.addEventListener('click', event => { if ((event.target as HTMLElement).closest('button')) { action(); (document.activeElement as HTMLElement)?.blur() } })
  }
  update(s: GameState, reticle: { x: number; y: number }, target: string | null, ship: 'strix'|'legacy' = 'legacy') {
    const shipName=ship==='strix'?'STRIX—9':'KESTREL—9'
    this.root.querySelector('.shield-module small')!.textContent=ship==='strix'?'INTERCEPTOR / STRIX-9':'COURIER / KESTREL-9'
    this.score.textContent = String(s.score).padStart(6, '0'); this.shields.innerHTML = `${s.player.shields}<span>%</span>`
    this.fill.style.width = `${s.player.shields}%`; this.root.classList.toggle('critical', s.player.shields <= 25)
    this.root.classList.toggle('hit', s.player.invulnerable > 0.75); this.progress.style.width = `${s.progress * 100}%`
    this.phase.textContent = s.phase.label; this.hint.textContent = s.phase.hint
    const seconds = Math.floor(s.elapsed)
    this.time.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} / 02:30`
    this.reticle.style.left = `${reticle.x}%`; this.reticle.style.top = `${reticle.y}%`; this.reticle.classList.toggle('locked', !!target)
    const core = s.enemies.find(e => e.type === 'core'); this.core.hidden = !core
    if (core) this.core.innerHTML = `<span>BLOCKADE CORE <b>${Math.ceil(core.health / core.maxHealth * 100)}%</b></span><div><i style="width:${core.health / core.maxHealth * 100}%"></i></div>`
    const key = `${s.status}-${s.paused}-${ship}-${s.status === 'playing' || s.status === 'title' ? '' : s.score}`
    if (key === this.previousOverlay) return
    this.previousOverlay = key; this.overlay.hidden = s.status === 'playing' && !s.paused
    this.root.classList.toggle('title-screen', s.status === 'title')
    if (s.status === 'title') {
      this.overlay.innerHTML = `<div class="briefing"><div class="eyebrow"><span class="live-dot"></span> FLIGHT OPERATIONS / MISSION 001</div><h2>One ship.<br>One last <em>signal.</em></h2><p>The relay has gone dark. Cut through the drone patrol, cross the debris belt, and break the blockade before the signal is lost.</p><div class="mission-chips"><span>02:30 TRANSIT</span><span>OUTER RELAY BELT</span></div><button class="launch">LAUNCH SORTIE <span>↗</span></button><div class="key-hint">PRESS ENTER TO LAUNCH</div><div class="brief-controls"><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>STEER</span></div><div><kbd>SPACE</kbd><span>FIRE</span></div></div></div><div class="brief-aside"><span>KESTREL—9</span><small>LIGHT COURIER / COMBAT RETROFIT</small><div class="ship-line"></div><p>Keep moving. Hold your fire line.<br>The core is your only way through.</p></div>`
      this.overlay.querySelector('.brief-aside span')!.textContent=shipName
      this.overlay.querySelector('.brief-aside small')!.textContent=ship==='strix'?'STX9-A1 / RELAY INTERCEPTOR':'LIGHT COURIER / COMBAT RETROFIT'
    } else if (s.status === 'playing') {
      this.overlay.innerHTML = `<div class="end-card"><div class="eyebrow">FLIGHT SUSPENDED</div><h2>Take a breath.</h2><p>Your sortie is paused.</p><button class="launch">RESUME FLIGHT <span>↗</span></button><small>P / ESC TO RESUME</small></div>`
    } else {
      const won = s.status === 'mission-complete'
      this.overlay.innerHTML = `<div class="end-card"><div class="eyebrow">${won ? 'MISSION COMPLETE / SIGNAL RESTORED' : 'SORTIE ENDED / SIGNAL LOST'}</div><h2>${won ? 'The way is open.' : 'Out of the fight.'}</h2><p>${won ? 'Blockade disabled. The relay is transmitting again.' : s.reason}</p><div class="final-score">${String(s.score).padStart(6, '0')}<small>FLIGHT SCORE</small></div><button class="launch">FLY AGAIN <span>↗</span></button><small>PRESS R TO RESTART</small></div>`
    }
  }
}
