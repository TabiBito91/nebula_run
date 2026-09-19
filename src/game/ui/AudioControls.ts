import type { AudioManager } from '../audio/AudioManager'
import './audio.css'

export class AudioControls {
  private root = document.createElement('div')
  private audio: AudioManager
  private menuMode = false
  private modeKey = ''
  private outside = (event: PointerEvent) => { if (!this.root.contains(event.target as Node)) this.closePanels() }
  private closePanels() {
    this.root.querySelector<HTMLElement>('[data-utilities]')!.hidden = true
    this.root.querySelector<HTMLElement>('section')!.hidden = true
    this.root.querySelector('[data-more]')!.setAttribute('aria-expanded','false')
    this.root.querySelector('[data-audio-toggle]')!.setAttribute('aria-expanded','false')
  }
  setMenuMode(menu: boolean, title: boolean) {
    const key = `${menu}-${title}`
    if (key === this.modeKey) return
    this.modeKey = key; this.menuMode = menu; this.closePanels()
    this.root.classList.toggle('menu-utilities', menu)
    this.root.querySelector<HTMLButtonElement>('[data-more]')!.hidden = !menu
    this.root.querySelector<HTMLButtonElement>('[data-audio-toggle]')!.hidden = menu
    this.root.querySelector<HTMLButtonElement>('[data-board]')!.hidden = title
  }
  constructor(audio: AudioManager, clearInput: () => void, feedback: () => void, leaderboard: () => void) {
    this.audio = audio; this.root.className = 'audio-controls'; this.root.dataset.audioControls = ''
    this.root.innerHTML = `<button type="button" data-more hidden aria-expanded="false" aria-controls="menu-utilities">More ⋯</button><button type="button" data-audio-toggle aria-expanded="false" aria-controls="audio-settings">Audio</button>
      <div id="menu-utilities" data-utilities hidden aria-label="More options"><button type="button" data-open-audio>Audio</button><button type="button" data-board>Leaderboard</button><button type="button" data-feedback>Feedback</button></div>
      <section id="audio-settings" aria-label="Audio settings" hidden><strong>FLIGHT AUDIO</strong><p data-audio-status aria-live="polite">Sound starts after interaction.</p><button type="button" data-enable>Enable sound</button>
      ${['master', 'music', 'sfx'].map(key => `<label>${key === 'sfx' ? 'Sound effects' : key[0].toUpperCase() + key.slice(1)}<input aria-label="${key === 'sfx' ? 'Sound effects' : key[0].toUpperCase() + key.slice(1)} volume" data-volume="${key}" type="range" min="0" max="100" step="1"><output></output></label>`).join('')}
      <button type="button" data-mute>Mute audio</button><button type="button" data-close-audio>Close audio</button><small>Original procedural preview soundtrack</small></section>`
    document.body.append(this.root)
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-audio-toggle]')!, panel = this.root.querySelector('section')!
    const more = this.root.querySelector<HTMLButtonElement>('[data-more]')!, utilities = this.root.querySelector<HTMLElement>('[data-utilities]')!
    more.onclick = () => { const open = utilities.hidden; this.closePanels(); utilities.hidden = !open; more.setAttribute('aria-expanded',String(open)); clearInput() }
    this.root.querySelector<HTMLButtonElement>('[data-open-audio]')!.onclick = () => { this.closePanels(); panel.hidden = false; panel.querySelector<HTMLButtonElement>('button:not([hidden])')!.focus() }
    this.root.querySelector<HTMLButtonElement>('[data-feedback]')!.onclick = () => { this.closePanels(); more.focus(); feedback() }
    this.root.querySelector<HTMLButtonElement>('[data-board]')!.onclick = () => { this.closePanels(); more.focus(); leaderboard() }
    this.root.querySelector<HTMLButtonElement>('[data-close-audio]')!.onclick = () => { this.closePanels(); (this.menuMode ? more : toggle).focus() }
    document.addEventListener('pointerdown',this.outside)
    toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); clearInput(); audio.play('confirm') }
    this.root.addEventListener('focusin', clearInput)
    this.root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); this.closePanels(); (this.menuMode ? more : toggle).focus() } })
    this.root.querySelectorAll<HTMLInputElement>('input').forEach(input => {
      input.oninput = () => audio.setSettings({ [input.dataset.volume!]: Number(input.value) / 100 })
    })
    this.root.querySelector<HTMLButtonElement>('[data-mute]')!.onclick = () => audio.setSettings({ muted: !audio.getSettings().muted })
    this.root.querySelector<HTMLButtonElement>('[data-enable]')!.onclick = () => { void audio.enableSound(true) }
    audio.onSettingsChange = () => this.refresh(); this.refresh()
  }
  private refresh() {
    const settings = this.audio.getSettings()
    this.root.querySelectorAll<HTMLInputElement>('input').forEach(input => {
      input.value = String(Math.round(settings[input.dataset.volume as 'master' | 'music' | 'sfx'] * 100))
      input.nextElementSibling!.textContent = `${input.value}%`
    })
    const mute = this.root.querySelector<HTMLButtonElement>('[data-mute]')!
    mute.textContent = settings.muted ? 'Unmute audio' : 'Mute audio'; mute.setAttribute('aria-pressed', String(settings.muted))
    const state = this.audio.inspect()
    const running = state.contextState === 'running' && state.unlocked
    this.root.querySelector<HTMLButtonElement>('[data-enable]')!.hidden = running || !state.available
    this.root.querySelector('[data-audio-status]')!.textContent = !state.available ? 'Audio unavailable. Flight remains playable.' : !running ? 'Tap Enable sound to start audio.' : settings.muted ? 'Audio is muted. Unmute to hear sound.' : settings.master === 0 ? 'Master volume is zero.' : 'Audio ready. Settings saved on this device.'
  }
  dispose() { document.removeEventListener('pointerdown',this.outside); this.audio.onSettingsChange = undefined; this.root.remove() }
}
