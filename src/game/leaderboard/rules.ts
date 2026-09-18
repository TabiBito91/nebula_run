// Bump when scoring, route or difficulty changes. Kept identical on client/server.
export const BOARD_VERSION = 'signalbreak-1'
export const LOCAL_LIMIT = 10
export const ONLINE_LIMIT = 25
export type Result = 'victory' | 'defeat'
export type ScoreEntry = { id: string; version: string; callsign: string; score: number; outcome: Result; elapsed: number; createdAt: string }
export function validResult(value: unknown): value is { score: number; outcome: Result; elapsed: number; callsign: string } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return Number.isInteger(v.score) && Number(v.score) >= 0 && Number(v.score) <= 12000 && Number(v.score) % 100 === 0
    && typeof v.elapsed === 'number' && Number.isFinite(v.elapsed) && v.elapsed >= 0 && v.elapsed <= 150.1
    && (v.outcome === 'defeat' || v.outcome === 'victory' && v.elapsed >= 120 && Number(v.score) >= 2000)
    && typeof v.callsign === 'string' && /^PILOT-[A-F0-9]{6}$/.test(v.callsign)
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
