import { definition, MIX, MUSIC, SOUNDS, type Bus, type MusicState } from './manifest'
import { readSettings, saveSettings, cleanSettings, type AudioSettings } from './settings'
import { SAMPLE_RATE, synthesize, prepareMusic } from './procedural'

type Voice = { id: string; source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; bus: Bus; priority: number; start: number; offset: number; loop: boolean; stopping: boolean }
export class AudioManager {
  private context: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private musicBus!: GainNode
  private buses = new Map<Bus, GainNode>()
  private analyser!: AnalyserNode
  private meter = new Float32Array(256)
  private buffers = new Map<string, AudioBuffer>()
  private voices = new Set<Voice>()
  private cooldowns = new Map<string, number>()
  private loading = new Map<string, Promise<void>>()
  private controllers = new Set<AbortController>()
  private disposed = false
  private unlocked = false
  private unlocking: Promise<void> | null = null
  private paused = false
  private hidden = document.hidden
  private currentMusic: MusicState | null = null
  private desiredMusic: MusicState = 'menu'
  private musicOffset = 0
  private musicEnded = false
  private transition: { from: MusicState | null; to: MusicState; end: number } | null = null
  private sequence = 0
  private events: { sequence: number; time: number; wallTime: number; type: string; sound?: string; detail?: string }[] = []
  private failures: { id: string; message: string }[] = []
  private settings = readSettings()
  private blocked = false
  private peak = 0
  private activePeak = 0
  private engine: Voice | null = null
  private enginePower = 0
  private boostPreview = false
  onSettingsChange?: () => void
  get available() { return !this.blocked && !this.disposed }
  constructor() {
    window.addEventListener('pointerdown', this.gesture, true)
    window.addEventListener('keydown', this.gesture, true)
    document.addEventListener('visibilitychange', this.visibility)
  }
  private gesture = (event: Event) => {
    if (!event.isTrusted || this.disposed) return
    if (event instanceof KeyboardEvent && (event.repeat || event.ctrlKey || event.metaKey || event.altKey)) return
    void this.unlock()
  }
  private visibility = () => {
    this.hidden = document.hidden
    if (this.hidden) { this.stopTransient(); this.saveMusicOffset(); this.stopMusic(); this.stopEngine(); void this.context?.suspend().catch(() => {}) }
    else if (this.unlocked) void this.unlock()
  }
  private log(type: string, sound?: string, detail?: string) {
    this.events.push({ sequence: ++this.sequence, time: this.context?.currentTime ?? 0, wallTime: performance.now(), type, sound, detail })
    if (this.events.length > 200) this.events.shift()
  }
  private error(id: string, error: unknown) {
    this.failures.push({ id, message: String(error) }); if (this.failures.length > 50) this.failures.shift()
    this.log('audio-error', id, String(error))
  }
  private async unlock() {
    if (this.disposed || this.hidden || this.blocked) return
    if (this.unlocking) return this.unlocking
    if (this.unlocked && this.context?.state === 'running') return
    this.unlocking = (async () => {
      try {
        if (!this.context) {
          this.context = new AudioContext({ latencyHint: 'interactive' })
          this.master = this.context.createGain(); this.sfx = this.context.createGain(); this.musicBus = this.context.createGain()
          const compressor = this.context.createDynamicsCompressor()
          compressor.threshold.value = -8; compressor.knee.value = 6; compressor.ratio.value = 6
          this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256
          this.master.connect(compressor); compressor.connect(this.analyser); this.analyser.connect(this.context.destination)
          this.musicBus.connect(this.master); this.sfx.connect(this.master)
          for (const [name, gain] of Object.entries(MIX.buses)) {
            const bus = this.context.createGain(); bus.gain.value = gain
            bus.connect(name === 'music' ? this.musicBus : this.sfx); this.buses.set(name as Bus, bus)
          }
          this.applySettings()
          // Small SFX buffers are ready before the first simulation update; music prepares progressively.
          for (const id of Object.keys(SOUNDS)) if (!SOUNDS[id].url) this.proceduralBuffer(id)
        }
        await this.context.resume()
        if (this.disposed) return
        this.unlocked = this.context.state === 'running'
        this.log('unlocked'); this.onSettingsChange?.()
        void this.preload()
        this.syncMusic()
      } catch (error) { this.error('initialization', error); this.blocked = !this.context; this.onSettingsChange?.() }
    })().finally(() => { this.unlocking = null })
    return this.unlocking
  }
  private proceduralBuffer(id: string) {
    if (!this.context || this.buffers.has(id)) return
    const samples = synthesize(id), buffer = this.context.createBuffer(1, samples.length, SAMPLE_RATE)
    buffer.copyToChannel(samples, 0); this.buffers.set(id, buffer)
  }
  private async preload() {
    for (const id of [...Object.keys(MUSIC).map(id => `music:${id}`), ...Object.keys(SOUNDS)]) {
      if (this.disposed) return
      await this.load(id)
      this.syncMusic()
      // Yield between tracks so preparation cannot monopolize the render thread.
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  async load(id: string, overrideUrl?: string) {
    if (!this.context || this.disposed) return
    if (this.loading.has(id)) return this.loading.get(id)
    const def = definition(id)
    if (!def) return
    if (this.buffers.has(id) && !overrideUrl) return
    const task = (async () => {
      const urls = overrideUrl ? [overrideUrl] : [def.url, def.fallbackUrl].filter(Boolean) as string[]
      let loaded = false
      for (const url of urls) {
        const controller = new AbortController(); this.controllers.add(controller)
        const timeout = setTimeout(() => controller.abort(), 5000)
        try {
          const response = await fetch(new URL(url, new URL(import.meta.env.BASE_URL, location.href)), { signal: controller.signal })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const bytes = await response.arrayBuffer()
          if (bytes.byteLength > 24 * 1024 * 1024) throw new Error('Asset exceeds 24 MiB encoded budget')
          const buffer = await this.context!.decodeAudioData(bytes)
          if (buffer.length * buffer.numberOfChannels * 4 > 80 * 1024 * 1024) throw new Error('Asset exceeds decoded budget')
          if (!this.disposed) this.buffers.set(id, buffer)
          loaded = true; break
        } catch (error) { if (!this.disposed) this.error(id, `${url}: ${error}`) }
        finally { clearTimeout(timeout); this.controllers.delete(controller) }
      }
      if (!loaded && !this.disposed && !this.buffers.has(id)) {
        if (id.startsWith('music:')) {
          const samples = await prepareMusic(id)
          if (!this.disposed) { const buffer = this.context!.createBuffer(1, samples.length, SAMPLE_RATE); buffer.copyToChannel(samples, 0); this.buffers.set(id, buffer) }
        } else this.proceduralBuffer(id)
      }
    })().finally(() => this.loading.delete(id))
    this.loading.set(id, task)
    return task
  }
  private ramp(param: AudioParam, value: number, duration = .035) {
    const now = this.context!.currentTime
    param.cancelAndHoldAtTime(now); param.linearRampToValueAtTime(value, now + duration)
  }
  private start(id: string, offset = 0, pan = 0, variation = 1): Voice | null {
    const ctx = this.context, def = definition(id), buffer = this.buffers.get(id)
    if (!ctx || !this.unlocked || this.blocked || ctx.state !== 'running' || this.hidden || !def || !buffer) return null
    const now = ctx.currentTime
    if (this.voices.size >= MIX.voiceLimit || (def.priority < 8 && this.voices.size >= MIX.voiceLimit - 4)) { this.log('voice-dropped', id); return null }
    if (now < (this.cooldowns.get(id) ?? -1)) return null
    const live = [...this.voices].filter(v => !v.stopping)
    if (live.filter(v => v.id === id).length >= def.max) return null
    const category = live.filter(v => v.bus === def.bus)
    if (category.length >= MIX.limits[def.bus] || live.length >= MIX.voiceLimit) {
      const victim = (category.length >= MIX.limits[def.bus] ? category : live).filter(v => !v.loop && v.priority < def.priority).sort((a, b) => a.priority - b.priority)[0]
      if (!victim) { this.log('voice-dropped', id); return null }
      this.stop(victim, .01)
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createStereoPanner()
    source.buffer = buffer; source.loop = !!def.loop; source.playbackRate.value = variation
    source.loopStart = def.loopStart ?? 0; source.loopEnd = def.loopEnd ?? buffer.duration
    panner.pan.value = Math.max(-.55, Math.min(.55, pan))
    gain.gain.value = def.bus === 'music' ? 0 : def.gain
    source.connect(gain); gain.connect(panner); panner.connect(this.buses.get(def.bus)!)
    const voice: Voice = { id, source, gain, pan: panner, bus: def.bus, priority: def.priority, start: now, offset, loop: !!def.loop, stopping: false }
    source.onended = () => {
      this.voices.delete(voice); source.disconnect(); gain.disconnect(); panner.disconnect()
      if (voice.bus === 'music' && !voice.loop && !voice.stopping && this.currentMusic === voice.id.slice(6)) this.musicEnded = true
    }
    source.start(now, offset % buffer.duration)
    this.voices.add(voice); this.activePeak = Math.max(this.activePeak, this.voices.size)
    this.cooldowns.set(id, now + def.cooldown); this.log('sound-started', id)
    return voice
  }
  private stop(voice: Voice, fade = .03) {
    if (voice.stopping) return
    voice.stopping = true; this.ramp(voice.gain.gain, 0, fade)
    try { voice.source.stop(this.context!.currentTime + fade + .005) } catch { /* Already ended. */ }
  }
  private stopMusic() { for (const voice of this.voices) if (voice.bus === 'music') this.stop(voice); this.transition = null }
  private saveMusicOffset() {
    const voice = [...this.voices].find(v => v.id === `music:${this.currentMusic}` && !v.stopping)
    if (voice) this.musicOffset = (voice.offset + this.context!.currentTime - voice.start) % voice.source.buffer!.duration
  }
  setMusic(state: MusicState) {
    if (state !== this.desiredMusic) { this.desiredMusic = state; this.musicOffset = 0; this.musicEnded = false }
    this.syncMusic()
  }
  private syncMusic() {
    if (this.paused || this.hidden || !this.unlocked || this.musicEnded || !this.buffers.has(`music:${this.desiredMusic}`)) return
    if ([...this.voices].some(v => v.id === `music:${this.desiredMusic}` && !v.stopping)) return
    // Keep at most two music voices, including a retiring crossfade.
    if ([...this.voices].filter(v => v.bus === 'music').length >= 2) return
    const next = this.start(`music:${this.desiredMusic}`, this.musicOffset)
    if (!next) return
    const from = this.currentMusic
    for (const voice of this.voices) if (voice !== next && voice.bus === 'music') this.stop(voice, MIX.fade)
    this.ramp(next.gain.gain, MUSIC[this.desiredMusic].gain, from ? MIX.fade : .2)
    this.currentMusic = this.desiredMusic
    this.transition = { from, to: this.currentMusic, end: this.context!.currentTime + (from ? MIX.fade : .2) }
    this.log('music-transition', `music:${this.currentMusic}`, from ?? 'silence')
  }
  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) { this.saveMusicOffset(); this.stopMusic(); this.stopTransient(); this.stopEngine() }
    else this.syncMusic()
  }
  reset() {
    for (const voice of this.voices) this.stop(voice)
    this.engine = null; this.musicOffset = 0; this.musicEnded = false; this.currentMusic = null; this.transition = null
    this.cooldowns.clear(); this.log('audio-reset')
  }
  play(id: string, pan = 0, variation = 1) {
    if (this.paused && definition(id)?.bus !== 'ui') return
    this.start(id, 0, pan, variation)
  }
  /** Isolate audio failure from flight simulation and expose it in diagnostics. */
  disable(error: unknown) { this.error('runtime', error); this.blocked = true; this.setPaused(true); void this.context?.suspend().catch(() => {}); this.onSettingsChange?.() }
  stopTransient() { for (const voice of this.voices) if (!voice.loop && voice.bus !== 'music') this.stop(voice) }
  stopEngine() { if (this.engine) this.stop(this.engine, .08); this.engine = null; this.enginePower = 0; this.boostPreview = false }
  setEngine(power: number, boost = false) {
    if (this.paused || this.hidden || !this.unlocked) return
    this.enginePower = Math.min(1, Math.max(0, power)); this.boostPreview = boost
    if (!this.engine || this.engine.stopping) this.engine = this.start('engine')
    if (this.engine) {
      this.engine.source.playbackRate.setTargetAtTime(.9 + this.enginePower * .22 + (boost ? .3 : 0), this.context!.currentTime, .12)
      this.engine.gain.gain.setTargetAtTime(SOUNDS.engine.gain * (.75 + this.enginePower * .42 + (boost ? .42 : 0)), this.context!.currentTime, .12)
    }
  }
  duck() {
    if (!this.context) return
    this.ramp(this.musicBus.gain, this.settings.music * .58, .035)
    this.musicBus.gain.linearRampToValueAtTime(this.settings.music, this.context.currentTime + 1.2)
  }
  getSettings() { return { ...this.settings } }
  setSettings(value: Partial<AudioSettings>) {
    this.settings = cleanSettings({ ...this.settings, ...value }); saveSettings(this.settings); this.applySettings(); this.onSettingsChange?.()
  }
  private applySettings() {
    if (!this.context) return
    this.ramp(this.master.gain, this.settings.muted ? 0 : this.settings.master)
    this.ramp(this.musicBus.gain, this.settings.music); this.ramp(this.sfx.gain, this.settings.sfx)
  }
  /** Development inspection connects its recorder here; normal gameplay never calls it. */
  captureOutput() {
    if (!this.context || !this.unlocked) throw new Error('Unlock audio before recording')
    const destination = this.context.createMediaStreamDestination()
    this.analyser.connect(destination)
    return { stream: destination.stream, disconnect: () => { this.analyser.disconnect(destination); destination.stream.getTracks().forEach(track => track.stop()) } }
  }
  update() {
    if (this.disposed || this.blocked) return
    this.syncMusic()
    if (this.context && this.transition && this.context.currentTime >= this.transition.end) this.transition = null
    if (this.analyser && this.context?.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.meter)
      for (const sample of this.meter) this.peak = Math.max(this.peak, Math.abs(sample))
    }
  }
  inspect() {
    const music = [...this.voices].find(v => v.id === `music:${this.currentMusic}` && !v.stopping)
    return { initialized: !!this.context, unlocked: this.unlocked, contextState: this.context?.state ?? 'not-created',
      musicState: this.desiredMusic, currentTrack: this.currentMusic ? `music:${this.currentMusic}` : null,
      musicStatus: !this.unlocked ? 'locked' : this.paused || this.hidden ? 'paused' : this.settings.muted ? 'muted' : this.transition ? 'fading' : music ? 'playing' : this.musicEnded ? 'ended' : 'loading',
      musicPosition: music ? (music.offset + this.context!.currentTime - music.start) % music.source.buffer!.duration : this.musicOffset,
      ...this.settings, activeSoundCount: this.voices.size, peakActiveSounds: this.activePeak, voiceLimit: MIX.voiceLimit,
      activeLoops: [...this.voices].filter(v => v.loop && !v.stopping).map(v => v.id), enginePower: this.enginePower, boostState: this.boostPreview ? 'preview' : 'inactive',
      recentEvents: [...this.events], transition: this.transition ? { ...this.transition } : null, failedLoads: [...this.failures], pendingLoads: [...this.loading.keys()],
      preparedBuffers: this.buffers.size, bufferBytes: [...this.buffers.values()].reduce((sum, b) => sum + b.length * b.numberOfChannels * 4, 0),
      baseLatency: this.context?.baseLatency ?? null, outputLatency: this.context?.outputLatency ?? null, measuredPeak: this.peak,
      hidden: this.hidden, temporaryAssets: true, available: !this.blocked }
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    window.removeEventListener('pointerdown', this.gesture, true); window.removeEventListener('keydown', this.gesture, true)
    document.removeEventListener('visibilitychange', this.visibility)
    this.controllers.forEach(controller => controller.abort())
    for (const voice of this.voices) { try { voice.source.stop() } catch {} }
    this.voices.clear(); this.buffers.clear(); void this.context?.close().catch(() => {})
  }
}
