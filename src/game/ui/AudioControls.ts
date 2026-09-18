import type { AudioManager } from '../audio/AudioManager'
import './audio.css'

export class AudioControls {
  private root = document.createElement('div')
  private audio: AudioManager
  constructor(audio: AudioManager, clearInput: () => void) {
    this.audio = audio; this.root.className = 'audio-controls'; this.root.dataset.audioControls = ''
    this.root.innerHTML = `<button type="button" aria-expanded="false" aria-controls="audio-settings">Audio</button>
      <section id="audio-settings" aria-label="Audio settings" hidden><strong>FLIGHT AUDIO</strong><p data-audio-status aria-live="polite">Sound starts after interaction.</p><button type="button" data-enable>Enable sound</button>
      ${['master', 'music', 'sfx'].map(key => `<label>${key === 'sfx' ? 'Sound effects' : key[0].toUpperCase() + key.slice(1)}<input aria-label="${key === 'sfx' ? 'Sound effects' : key[0].toUpperCase() + key.slice(1)} volume" data-volume="${key}" type="range" min="0" max="100" step="1"><output></output></label>`).join('')}
      <button type="button" data-mute>Mute audio</button><small>Original procedural preview soundtrack</small></section>`
    document.body.append(this.root)
    const toggle = this.root.querySelector('button')!, panel = this.root.querySelector('section')!
    toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); clearInput(); audio.play('confirm') }
    this.root.addEventListener('focusin', clearInput)
    this.root.addEventListener('keydown', event => { if (event.key === 'Escape') { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.blur() } })
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
  dispose() { this.audio.onSettingsChange = undefined; this.root.remove() }
}
