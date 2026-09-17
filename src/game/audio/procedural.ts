import type { MusicState } from './manifest'

export const SAMPLE_RATE = 22050
const TAU = Math.PI * 2
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12)
/** Original temporary score: eight bars at 120 BPM, no recordings or external samples. */
export function synthesize(id: string): Float32Array<ArrayBuffer> {
  if (!id.startsWith('music:')) return new Float32Array(1)
  const state = id.slice(6) as MusicState
  const ending = state === 'victory' || state === 'failure'
  const duration = ending ? 4 : 16, data = new Float32Array(duration * SAMPLE_RATE)
  const roots = state === 'boss' ? [38, 41, 36, 43] : [45, 41, 48, 43]
  // Uneven rests and a rising/falling six-note phrase give this placeholder its own identity.
  const motif = state === 'failure' ? [0, -2, -5, -9] : [0, 7, 3, 10, 5, 2, 7, -1]
  const energy = state === 'menu' ? .2 : state === 'flight' ? .5 : .85
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE, bar = Math.floor(t / 2), root = roots[Math.floor(bar / 2) % 4]
    const beat = t % .5, step = Math.floor(t / .25), local = t % .25
    const env = Math.min(1, local / .012) * Math.exp(-local * 14)
    const note = hz((ending ? state === 'victory' ? 57 : 45 : root + 12) + motif[step % 8])
    const lead = step % 8 === 7 ? 0 : Math.sin(TAU * note * local) * env * .105
    const bassEnv = Math.min(1, beat / .008) * Math.exp(-beat * 8)
    const bass = Math.sin(TAU * hz(root - 12) * beat) * bassEnv * .15
    // Pad resets phase on chord boundaries; a boundary envelope makes the 16 s seam click-free.
    const chordTime = t % 4, padEnv = Math.min(1, chordTime / .18, (4 - chordTime) / .2)
    const pad = [0, 7, 14].reduce((sum, n) => sum + Math.sin(TAU * hz(root + n) * chordTime), 0) * .019 * padEnv
    const kick = Math.sin(TAU * (52 * beat + 2.8 * (1 - Math.exp(-beat * 35)))) * Math.exp(-beat * 24) * .2 * energy
    const hat = Math.sin(i * 1.73) * Math.sin(i * .739) * Math.exp(-local * 100) * .055 * energy
    const edge = Math.min(1, t / .008, (duration - t) / (ending ? 1.2 : .008))
    data[i] = (lead * (state === 'menu' ? .45 : 1) + bass + pad + (ending ? 0 : kick + hat)) * edge
  }
  return data
}
