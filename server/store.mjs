import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const schema = `
CREATE TABLE IF NOT EXISTS leaderboard_runs (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, version TEXT NOT NULL,
 started BIGINT NOT NULL, expires BIGINT NOT NULL, score INTEGER,
 outcome TEXT, elapsed DOUBLE PRECISION, callsign TEXT, created_at TEXT,
 hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS leaderboard_rank ON leaderboard_runs(version, score DESC, outcome DESC, created_at, id);
CREATE INDEX IF NOT EXISTS leaderboard_expiry ON leaderboard_runs(expires);
CREATE TABLE IF NOT EXISTS leaderboard_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires BIGINT NOT NULL);
`

export async function openStore({ url, file = '.data/leaderboard.sqlite' } = {}) {
  let query, close
  if (url) {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 5000 })
    pool.on('error', () => console.error('Leaderboard database connection interrupted'))
    query = async (sql, values = []) => (await pool.query(sql, values)).rows
    close = () => pool.end()
  } else {
    if (file !== ':memory:') await mkdir(dirname(file), { recursive: true })
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(file)
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
    query = async (sql, values = []) => {
      const args = []
      const positional = sql.replace(/\$(\d+)/g, (_, n) => { args.push(values[Number(n) - 1]); return '?' })
      return db.prepare(positional).all(...args)
    }
    close = async () => db.close()
  }
  for (const sql of schema.split(';').filter(s => s.trim())) await query(sql)
  return {
    query, close,
    async allow(key, limit, expires) {
      const rows = await query('INSERT INTO leaderboard_limits(key,hits,expires) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=leaderboard_limits.hits+1 RETURNING hits', [key, expires])
      return rows[0].hits <= limit
    },
    async create(run) { await query('INSERT INTO leaderboard_runs(id,token_hash,version,started,expires) VALUES($1,$2,$3,$4,$5)', [run.id, run.hash, run.version, run.started, run.expires]) },
    async get(id, hash) { return (await query('SELECT * FROM leaderboard_runs WHERE id=$1 AND token_hash=$2', [id, hash]))[0] },
    async finish(id, hash, e) {
      await query('UPDATE leaderboard_runs SET score=$1,outcome=$2,elapsed=$3,callsign=$4,created_at=$5 WHERE id=$6 AND token_hash=$7 AND score IS NULL', [e.score,e.outcome,e.elapsed,e.callsign,e.createdAt,id,hash])
      return this.get(id, hash)
    },
    async top(version, limit) {
      const rows = await query("SELECT id,version,score,outcome,elapsed,callsign,created_at FROM leaderboard_runs WHERE version=$1 AND score IS NOT NULL AND hidden=0 ORDER BY score DESC, CASE WHEN outcome='victory' THEN 0 ELSE 1 END, created_at ASC, id ASC LIMIT $2", [version, limit])
      return rows.map(({ created_at, ...r }) => ({ ...r, createdAt: created_at }))
    },
    async prune(now) { await query('DELETE FROM leaderboard_limits WHERE expires<$1', [now]); await query('DELETE FROM leaderboard_runs WHERE expires<$1 AND score IS NULL', [now]) },
  }
}
