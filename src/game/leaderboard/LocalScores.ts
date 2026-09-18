import { BOARD_VERSION, LOCAL_LIMIT, rankEntries, validEntry, type ScoreEntry } from './rules.ts'

export class LocalScores {
  readonly key = 'nebula-run:scores:v1'
  entries: ScoreEntry[] = []
  persistent = true
  callsign = `PILOT-${crypto.randomUUID().replaceAll('-', '').slice(0,6).toUpperCase()}`
  constructor() {
    try {
      const raw = localStorage.getItem(this.key)
      const parsed = raw && raw.length < 50000 ? JSON.parse(raw) : null
      if (Array.isArray(parsed?.entries)) this.entries = rankEntries(parsed.entries.filter(validEntry).filter((e: ScoreEntry, i: number, a: ScoreEntry[])=>a.findIndex(x=>x.id===e.id)===i), LOCAL_LIMIT)
      const name = localStorage.getItem('nebula-run:callsign:v1')
      if (name && /^PILOT-[A-F0-9]{6}$/.test(name)) this.callsign = name
      else localStorage.setItem('nebula-run:callsign:v1', this.callsign)
    } catch { this.persistent = false }
  }
  add(entry: ScoreEntry) {
    const best = !this.entries.length || entry.score > this.entries[0].score
    if (validEntry(entry) && !this.entries.some(e=>e.id===entry.id)) this.entries = rankEntries([...this.entries,entry], LOCAL_LIMIT)
    this.save()
    return best
  }
  clear() { this.entries = []; this.save() }
  private save() {
    try { localStorage.setItem(this.key, JSON.stringify({ version:BOARD_VERSION, entries:this.entries })); this.persistent = true }
    catch { this.persistent = false }
  }
}
