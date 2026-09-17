import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const out = path.resolve(process.argv[2] || '.logs/audio-review/final')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = [], samples = []
page.on('pageerror', error => errors.push(String(error)))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
const snapshot = () => page.evaluate(() => window.__GAME_INSPECTOR__.getState())
const elapsed = time => page.waitForFunction(t => window.__GAME_INSPECTOR__.getState().missionElapsedTime >= t, time)
try {
  await page.goto('http://127.0.0.1:5173/?testScene=basic-flight')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  // Controlled performance baseline: run empty simulation without a gesture/audio context.
  await page.evaluate(() => window.__GAME_INSPECTOR__.resume())
  await elapsed(3); samples.push({ label: 'audio-locked-baseline', state: await snapshot() })
  await page.keyboard.press('KeyP')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__.getState().audio.preparedBuffers >= 25)
  await page.evaluate(() => window.__GAME_INSPECTOR__.loadScene('basic-flight'))
  await page.keyboard.press('KeyP'); await elapsed(3)
  samples.push({ label: 'audio-enabled-flight', state: await snapshot() })
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await page.screenshot({ path: path.join(out, 'audio-controls.png') })
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await page.locator('canvas').click()
  await page.evaluate(() => window.__GAME_INSPECTOR__.startAudioCapture())
  for (const [scene, time, firing, steering] of [
    ['mission-start', 5, true, false], ['audio-enemy-fire', 5, true, false], ['audio-damage', 3, false, false],
    ['audio-dodge-shoot', 2, true, true], ['audio-boost', 6, false, false], ['audio-boss', 4, false, false], ['audio-victory', 0, true, false],
  ]) {
    await page.evaluate(name => window.__GAME_INSPECTOR__.loadScene(name), scene)
    await page.keyboard.press('KeyP')
    if (firing) await page.keyboard.down('Space')
    if (steering) await page.keyboard.down('KeyD')
    if (time) await elapsed(time)
    else await page.waitForFunction(() => window.__GAME_INSPECTOR__.getState().status === 'mission-complete')
    await page.keyboard.up('Space'); await page.keyboard.up('KeyD')
    samples.push({ label: scene, state: await snapshot() })
    await page.screenshot({ path: path.join(out, `${scene}.png`) })
  }
  const capture = await page.evaluate(() => window.__GAME_INSPECTOR__.stopAudioCapture())
  await writeFile(path.join(out, 'review-mix.webm'), Buffer.from(capture.base64, 'base64'))
  const decoded = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const ctx = new OfflineAudioContext(2, 1, 22050)
    const buffer = await ctx.decodeAudioData(bytes.buffer)
    const channels = buffer.numberOfChannels, size = buffer.length * channels * 2
    const wav = new ArrayBuffer(44 + size), view = new DataView(wav)
    const str = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
    str(0, 'RIFF'); view.setUint32(4, 36 + size, true); str(8, 'WAVE'); str(12, 'fmt '); view.setUint32(16, 16, true)
    view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true)
    view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true)
    str(36, 'data'); view.setUint32(40, size, true)
    let peak = 0, sum = 0, clipped = 0
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < data.length; i++) {
        peak = Math.max(peak, Math.abs(data[i])); sum += data[i] ** 2; if (Math.abs(data[i]) >= 1) clipped++
        view.setInt16(44 + (i * channels + c) * 2, Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), true)
      }
    }
    let binary = ''; for (const byte of new Uint8Array(wav)) binary += String.fromCharCode(byte)
    return { base64: btoa(binary), duration: buffer.duration, peak, rms: Math.sqrt(sum / (buffer.length * channels)), clipped }
  }, capture.base64)
  await writeFile(path.join(out, 'review-mix.wav'), Buffer.from(decoded.base64, 'base64'))
  const { base64: _, ...waveMetrics } = decoded
  await writeFile(path.join(out, 'inspection.json'), JSON.stringify({ samples, errors, waveMetrics }, null, 2))
  console.log(JSON.stringify({ samples: samples.map(({ label, state }) => ({ label, fps: state.fps, calls: state.drawCalls, voices: state.audio.activeSoundCount, peakVoices: state.audio.peakActiveSounds, bytes: state.audio.bufferBytes, failed: state.audio.failedLoads })), errors, waveMetrics }, null, 2))
  if (errors.length) process.exitCode = 1
} finally { await browser.close() }
