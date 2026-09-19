// Bump when scoring, route or difficulty changes. Kept identical on client/server.
import { DIFFICULTIES, type Difficulty } from '../difficulty.ts'
export const BOARD_VERSION = 'signalbreak-4'
export const LEGACY_VERSION = 'signalbreak-1'
export const LEGACY_VETERAN = 'signalbreak-2-veteran'
export function boardVersion(difficulty: Difficulty) { return difficulty === 'standard' ? BOARD_VERSION : `${BOARD_VERSION}-${difficulty}` }
export const BOARDS = [
  { version: boardVersion('relaxed'), label: 'Relaxed' },
  { version: BOARD_VERSION, label: 'Standard' },
  { version: boardVersion('veteran'), label: 'Veteran' },
  { version: 'signalbreak-2', label: 'Standard — Before asteroid rewards' },
  { version: 'signalbreak-2-relaxed', label: 'Relaxed — Before asteroid rewards' },
  { version: 'signalbreak-3-veteran', label: 'Veteran — Before asteroid rewards' },
  { version: LEGACY_VERSION, label: 'Standard — Original rules' },
  { version: LEGACY_VETERAN, label: 'Veteran — Original rules' },
]
export function currentVersion(version: unknown) { return BOARDS.slice(0, 3).some(b => b.version === version) }
export function scoreMultiplier(version: unknown) {
  return typeof version === 'string' && version.endsWith('-relaxed') ? DIFFICULTIES.relaxed.score : typeof version === 'string' && version.endsWith('-veteran') ? DIFFICULTIES.veteran.score : 1
}
export const LOCAL_LIMIT = 10
export const ONLINE_LIMIT = 25
export type Result = 'victory' | 'defeat'
export type ScoreEntry = { id: string; version: string; callsign: string; score: number; outcome: Result; elapsed: number; createdAt: string }
const blockedNames = new Set(['admin', 'administrator', 'moderator', 'support', 'system', 'developer', 'replit', 'fuck', 'shit', 'cunt', 'bitch', 'asshole', 'bastard'])

/** Public guest label: deliberately short, plain-text only, and never an identity claim. */
export function validDisplayName(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 3 || value.length > 16 || value !== value.trim() || value.includes('  ')) return false
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]*[A-Za-z0-9_-]$/.test(value)) return false
  return !blockedNames.has(value.toLowerCase().replace(/[^a-z0-9]/g, ''))
}
export function validResult(value: unknown): value is { score: number; outcome: Result; elapsed: number; callsign: string } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const multiplier = scoreMultiplier(v.version)
  return Number.isInteger(v.score) && Number(v.score) >= 0 && Number(v.score) <= (multiplier === DIFFICULTIES.veteran.score ? 18000 : 12000) * multiplier && Number(v.score) % ((currentVersion(v.version) ? 20 : 100) * multiplier) === 0
    && typeof v.elapsed === 'number' && Number.isFinite(v.elapsed) && v.elapsed >= 0 && v.elapsed <= 150.1
    && (v.outcome === 'defeat' || v.outcome === 'victory' && v.elapsed >= 120 && Number(v.score) >= 2000 * multiplier)
    && validDisplayName(v.callsign)
}
export function validEntry(v: unknown): v is ScoreEntry {
  if (!validResult(v)) return false
  const e = v as ScoreEntry
  return typeof e.id === 'string' && e.id.length <= 80 && BOARDS.some(b => b.version === e.version)
    && typeof e.createdAt === 'string' && Number.isFinite(Date.parse(e.createdAt))
}
export function rankEntries(entries: ScoreEntry[], limit: number) {
  return [...entries].sort((a, b) => b.score - a.score || Number(b.outcome === 'victory') - Number(a.outcome === 'victory')
    || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(0, limit)
}
