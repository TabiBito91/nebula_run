export const SETTINGS_KEY = 'nebula-run:audio:v1'
export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }
export const DEFAULT_SETTINGS: AudioSettings = { master: .8, music: .35, sfx: .7, muted: false }
export function cleanSettings(value: Partial<AudioSettings>): AudioSettings {
  const clean = (key: 'master' | 'music' | 'sfx') => typeof value[key] === 'number' && Number.isFinite(value[key])
    ? Math.min(1, Math.max(0, value[key]!)) : DEFAULT_SETTINGS[key]
  return { master: clean('master'), music: clean('music'), sfx: clean('sfx'), muted: typeof value.muted === 'boolean' ? value.muted : false }
}
export function readSettings() {
  try { return cleanSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}) } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(settings: AudioSettings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* Private browsing/storage quotas cannot stop play. */ } }
