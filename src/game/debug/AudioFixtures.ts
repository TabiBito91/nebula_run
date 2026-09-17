import type { GameState } from '../state'
import type { AudioSession } from '../audio/AudioSession'
import { spawnEnemy } from '../systems/spawning'
import { projectile } from '../systems/combat'
import { vec } from '../entities/types'

export const AUDIO_SCENES = ['audio-flight', 'audio-firing', 'audio-dodge-shoot', 'audio-boost', 'audio-enemy-fire', 'audio-impacts', 'audio-damage', 'audio-transition', 'audio-boss', 'audio-pause', 'audio-restart', 'audio-victory', 'audio-failed-load'] as const
export function setupAudioFixture(s: GameState) {
  if (s.scene === 'audio-enemy-fire') for (let i = 0; i < 4; i++) spawnEnemy(s, 'gunner', (i - 1.5) * 4, 2, -65)
  if (s.scene === 'audio-impacts') for (let i = 0; i < 6; i++) spawnEnemy(s, 'straight', (i % 2 ? 1 : -1) * 1.22, -1, -20 - i * 3)
  if (s.scene === 'audio-damage') { s.player.shields = 25; projectile(s, 'enemy', vec(0, -1, -15), vec(0, 0, 12)) }
  if (s.scene === 'audio-victory') { const core = spawnEnemy(s, 'core', 0, -1, -30); core.health = 2; s.phaseIndex = 4 }
}
/** Audio-only future-maneuver previews, plus deterministic timed fixture spawns. */
export function installAudioFixtures(session: AudioSession) {
  let generation = -1, fired = false, dodgeAt = 0
  session.reviewUpdate = s => {
    if (s.generation !== generation) { generation = s.generation; fired = false; dodgeAt = 0 }
    if (s.status !== 'playing') return { boost: false }
    if (!fired && s.elapsed >= 2) {
      if (s.scene === 'audio-transition') for (let i = 0; i < 4; i++) spawnEnemy(s, 'sweep', (i - 1.5) * 4, 2, -65)
      if (s.scene === 'audio-boss') { spawnEnemy(s, 'core', 0, 0, -55); s.phaseIndex = 4 }
      if (s.scene === 'audio-failed-load') {
        // Decode failure with no external request or copyrighted source. Production never loads this module.
        void session.manager.load('music:flight', 'data:audio/wav;base64,AAAA')
      }
      fired = true
    }
    if (s.scene === 'audio-dodge-shoot' && Math.abs(s.player.velocity.x) > 1 && s.elapsed >= dodgeAt) {
      session.manager.play('dodge', Math.sign(s.player.velocity.x) * .4); dodgeAt = s.elapsed + 1
    }
    return { boost: s.scene === 'audio-boost' && s.elapsed >= 2 && s.elapsed < 5 }
  }
}

export function createAudioRecorder(session: AudioSession) {
  let recorder: MediaRecorder | null = null
  let output: ReturnType<typeof session.manager.captureOutput> | null = null
  let chunks: Blob[] = []
  let timeout: ReturnType<typeof setTimeout> | undefined
  return {
    start() {
      if (recorder) throw new Error('Audio capture is already active')
      output = session.manager.captureOutput(); chunks = []
      recorder = new MediaRecorder(output.stream)
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.start(250)
      // Bounded capture prevents review tools from leaving an unbounded recorder running.
      timeout = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop() }, 60000)
    },
    async stop() {
      if (!recorder) throw new Error('No capture active')
      const active = recorder
      if (active.state !== 'inactive') await new Promise<void>(resolve => { active.onstop = () => resolve(); active.stop() })
      clearTimeout(timeout); output?.disconnect(); output = null; recorder = null
      const blob = new Blob(chunks, { type: active.mimeType }); chunks = []
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
      return { base64: btoa(binary), mimeType: blob.type }
    },
    dispose() { clearTimeout(timeout); if (recorder?.state === 'recording') recorder.stop(); output?.disconnect(); recorder = null; output = null; chunks = [] },
  }
}
