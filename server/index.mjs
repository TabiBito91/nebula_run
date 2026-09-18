import { openStore } from './store.mjs'
import { createApp } from './app.mjs'
import { randomBytes } from 'node:crypto'

const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production'
if (production && (!process.env.DATABASE_URL || !process.env.APP_ORIGIN || (process.env.RATE_LIMIT_SECRET || '').length < 32)) {
  throw new Error('Production requires DATABASE_URL, APP_ORIGIN and RATE_LIMIT_SECRET (32+ characters). No ephemeral database fallback is allowed.')
}
if (production && (new URL(process.env.APP_ORIGIN).protocol !== 'https:' || new URL(process.env.APP_ORIGIN).origin !== process.env.APP_ORIGIN)) throw new Error('APP_ORIGIN must be an exact HTTPS origin without a path or trailing slash')
const hops = Number(process.env.TRUST_PROXY_HOPS || 0)
if (!Number.isInteger(hops) || hops < 0 || hops > 5) throw new Error('Invalid TRUST_PROXY_HOPS')
const store = await openStore({ url:process.env.DATABASE_URL, file:process.env.SQLITE_PATH || '.data/leaderboard.sqlite' })
const server = createApp({ store, origin:process.env.APP_ORIGIN || ['http://127.0.0.1:5173','http://127.0.0.1:4173','http://127.0.0.1:3001'], secret:process.env.RATE_LIMIT_SECRET || randomBytes(32).toString('hex'), trustProxyHops:hops })
server.requestTimeout = 10000
server.headersTimeout = 10000
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Game/leaderboard server ready'))
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { server.close(async()=>{ await store.close(); process.exit(0) }); server.closeIdleConnections() })
