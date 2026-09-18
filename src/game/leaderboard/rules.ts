// Bump when scoring, route or difficulty changes. Kept identical on client/server.
export const BOARD_VERSION = 'signalbreak-1'
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
  return Number.isInteger(v.score) && Number(v.score) >= 0 && Number(v.score) <= 12000 && Number(v.score) % 100 === 0
    && typeof v.elapsed === 'number' && Number.isFinite(v.elapsed) && v.elapsed >= 0 && v.elapsed <= 150.1
    && (v.outcome === 'defeat' || v.outcome === 'victory' && v.elapsed >= 120 && Number(v.score) >= 2000)
    && validDisplayName(v.callsign)
}
export function validEntry(v: unknown): v is ScoreEntry {
  if (!validResult(v)) return false
  const e = v as ScoreEntry
  return typeof e.id === 'string' && e.id.length <= 80 && e.version === BOARD_VERSION
    && typeof e.createdAt === 'string' && Number.isFinite(Date.parse(e.createdAt))
}
export function rankEntries(entries: ScoreEntry[], limit: number) {
  return [...entries].sort((a, b) => b.score - a.score || Number(b.outcome === 'victory') - Number(a.outcome === 'victory')
    || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(0, limit)
}
