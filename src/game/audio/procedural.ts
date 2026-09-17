import type { MusicState } from './manifest'

export const SAMPLE_RATE = 22050
const TAU = Math.PI * 2
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12)
/** Original temporary score: eight bars at 120 BPM, no recordings or external samples. */
export function synthesize(id: string): Float32Array<ArrayBuffer> {
  if (!id.startsWith('music:')) return effect(id)
  const iterator = musicSamples(id)
  let result = iterator.next()
  while (!result.done) result = iterator.next()
  return result.value
}
/** Yield small chunks so music preparation never holds up the first weapon shot. */
export async function prepareMusic(id: string): Promise<Float32Array<ArrayBuffer>> {
  const iterator = musicSamples(id)
  let result = iterator.next()
  while (!result.done) { await new Promise(resolve => setTimeout(resolve, 0)); result = iterator.next() }
  return result.value
}
function* musicSamples(id: string): Generator<void, Float32Array<ArrayBuffer>> {
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
    if (i % 4096 === 4095) yield
  }
  return data
}

/** Deterministic noise and oscillator recipes; each effect is rendered once and reused. */
function effect(id: string): Float32Array<ArrayBuffer> {
  const duration = id === 'engine' ? 2 : id === 'coreExplosion' ? 1.5 : id === 'explosion' ? .65 : ['critical', 'bossWarning', 'victory', 'failure'].includes(id) ? .9 : id === 'shield' ? .45 : id === 'dodge' || id.startsWith('boost') ? .4 : .16
  const data = new Float32Array(Math.floor(duration * SAMPLE_RATE))
  let seed = 27183, low = 0
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE, p = t / duration
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = seed / 2147483648 - 1; low += (noise - low) * .045
    const env = Math.min(1, t / .004) * (1 - p) ** 2
    let value: number
    switch (id) {
      case 'playerShot': value = Math.sin(TAU * (950 * t - 2000 * t * t)) * .5 + noise * .025; break
      case 'enemyShot': value = Math.sin(TAU * (330 * t + 620 * t * t)) * .5 + Math.sin(TAU * 115 * t) * .2; break
      case 'hit': value = noise * .6 + Math.sin(TAU * 1850 * t) * .15; break
      case 'shield': value = Math.sin(TAU * (170 * t + 220 * t * t)) * .65 + low * 1.5; break
      case 'explosion': value = low * 2.4 + Math.sin(TAU * (68 * t - 25 * t * t)) * .35; break
      case 'coreExplosion': value = low * 2.5 + Math.sin(TAU * (53 * t - 8 * t * t)) * .5; break
      case 'engine':
        // Integer-cycle tones produce a seamless two-second periodic buffer.
        data[i] = Math.sin(TAU * 55 * t) * .38 + Math.sin(TAU * 83 * t) * .15 + Math.sin(TAU * 111 * t) * .08
        continue
      case 'dodge': value = low * 2 * Math.sin(Math.PI * p) + Math.sin(TAU * (300 * t - 240 * t * t)) * .12; break
      case 'boostStart': value = Math.sin(TAU * (95 * t + 280 * t * t)) * .4 + low; break
      case 'boostEnd': value = Math.sin(TAU * (280 * t - 220 * t * t)) * .35 + low; break
      case 'critical': value = Math.sin(TAU * 660 * t) * (Math.sin(TAU * 4 * t) > 0 ? .6 : 0); break
      case 'bossWarning': value = Math.sin(TAU * 165 * t) * .4 + Math.sin(TAU * 233 * t) * .25; break
      case 'victory': value = Math.sin(TAU * hz(69 + [0, 7, 12][Math.min(2, Math.floor(p * 3))]) * t) * .5; break
      case 'failure': value = Math.sin(TAU * (240 * t - 90 * t * t)) * .4; break
      default: value = Math.sin(TAU * (id === 'lock' ? 1050 : id === 'pause' ? 420 : id === 'resume' ? 630 : 800) * t) * .4
    }
    data[i] = Math.max(-.9, Math.min(.9, value * env))
  }
  return data
}
