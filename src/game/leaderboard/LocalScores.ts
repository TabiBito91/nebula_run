import { BOARD_VERSION, BOARDS, LOCAL_LIMIT, rankEntries, validEntry, validDisplayName, type ScoreEntry } from './rules.ts'

const partition = (entries: ScoreEntry[]) => BOARDS.flatMap(b => rankEntries(entries.filter(e => e.version === b.version), LOCAL_LIMIT))

export class LocalScores {
  readonly key = 'nebula-run:scores:v1'
  entries: ScoreEntry[] = []
  persistent = true
  callsign = `PILOT-${crypto.randomUUID().replaceAll('-', '').slice(0,6).toUpperCase()}`
  constructor() {
    try {
      const raw = localStorage.getItem(this.key)
      const parsed = raw && raw.length < 50000 ? JSON.parse(raw) : null
      if (Array.isArray(parsed?.entries)) this.entries = partition(parsed.entries.filter(validEntry).filter((e: ScoreEntry, i: number, a: ScoreEntry[])=>a.findIndex(x=>x.id===e.id)===i))
      const name = localStorage.getItem('nebula-run:callsign:v1')
      if (name && /^PILOT-[A-F0-9]{6}$/.test(name)) this.callsign = name
      else localStorage.setItem('nebula-run:callsign:v1', this.callsign)
    } catch { this.persistent = false }
  }
  add(entry: ScoreEntry) {
    const peers = this.entries.filter(e => e.version === entry.version)
    const best = !peers.length || entry.score > peers[0].score
    if (validEntry(entry) && !this.entries.some(e=>e.id===entry.id)) this.entries = partition([...this.entries,entry])
    this.save()
    return best
  }
  clear() { this.entries = []; this.save() }
  rename(id: string, callsign: string) {
    if (!validDisplayName(callsign) || !this.entries.some(e => e.id === id)) return false
    this.entries = this.entries.map(e => e.id === id ? { ...e, callsign } : e)
    this.save()
    return true
  }
  private save() {
    try { localStorage.setItem(this.key, JSON.stringify({ version:BOARD_VERSION, entries:this.entries })); this.persistent = true }
    catch { this.persistent = false }
  }
}
