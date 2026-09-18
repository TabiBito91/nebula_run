import { createServer } from 'node:http'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { BOARD_VERSION, ONLINE_LIMIT, validResult } from '../src/game/leaderboard/rules.ts'

const hash = token => createHash('sha256').update(token).digest('hex')
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.glb':'model/gltf-binary', '.png':'image/png', '.svg':'image/svg+xml', '.ogg':'audio/ogg', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ico':'image/x-icon' }
export function createApp({ store, origin, secret, trustProxyHops = 0, now = Date.now, staticDir = 'dist' }) {
  const root = resolve(staticDir)
  const json = (res, status, data) => { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(data)) }
  const bad = (status, message) => Object.assign(new Error(message), { status })
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw bad(415, 'JSON required')
    let text = ''
    for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 4096) throw bad(413, 'Request too large') }
    try { const b = JSON.parse(text); if (!b || typeof b !== 'object' || Array.isArray(b)) throw 0; return b } catch { throw bad(400, 'Invalid JSON') }
  }
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    try {
      const path = new URL(req.url, 'http://localhost').pathname
      if (!path.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(req.method)) throw bad(405, 'Method not allowed')
        const file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path))
        if (!file.startsWith(root + sep)) throw bad(404, 'Not found')
        let contents
        try { if (!(await stat(file)).isFile()) throw 0; contents = await readFile(file) } catch { throw bad(404, 'Not found') }
        res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control':path.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache' })
        return res.end(req.method === 'HEAD' ? undefined : contents)
      }
      if (!['GET','POST'].includes(req.method)) throw bad(405, 'Method not allowed')
      if (!['/api/leaderboard','/api/runs','/api/scores'].includes(path)) throw bad(404, 'Not found')
      if (req.headers.origin && !(Array.isArray(origin) ? origin : [origin]).includes(req.headers.origin)) throw bad(403, 'Origin not allowed')
      if (req.headers['sec-fetch-site'] === 'cross-site') throw bad(403, 'Cross-site request rejected')
      const chain = [...String(req.headers['x-forwarded-for'] || '').split(',').map(x=>x.trim()).filter(Boolean), req.socket.remoteAddress]
      const ip = chain[Math.max(0, chain.length - 1 - trustProxyHops)]
      const time = now(), period = 600000, bucket = Math.floor(time / period)
      const key = createHmac('sha256', secret).update(String(ip)).digest('hex') + ':' + bucket + ':' + (req.method === 'GET' ? 'read' : path)
      if (!await store.allow(key, req.method === 'GET' ? 120 : path === '/api/runs' ? 12 : 40, (bucket + 2) * period)) throw bad(429, 'Too many requests; try later')
      if (path === '/api/leaderboard' && req.method === 'GET') return json(res, 200, { version:BOARD_VERSION, entries:await store.top(BOARD_VERSION, ONLINE_LIMIT) })
      if (path === '/api/runs' && req.method === 'POST') {
        const b = await body(req)
        if (b.version !== BOARD_VERSION || Object.keys(b).some(k=>k!=='version')) throw bad(400, 'Unsupported run version')
        await store.prune(time)
        const id = randomUUID(), token = randomBytes(32).toString('hex'), expires = time + 7200000
        await store.create({ id, hash:hash(token), version:BOARD_VERSION, started:time, expires })
        return json(res, 201, { id, token, expires })
      }
      if (path === '/api/scores' && req.method === 'POST') {
        const b = await body(req)
        if (!validResult(b) || b.version !== BOARD_VERSION || typeof b.id !== 'string' || !/^[a-f0-9-]{36}$/.test(b.id)
          || typeof b.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token)
          || Object.keys(b).some(k=>!['id','token','version','score','elapsed','outcome','callsign'].includes(k))) throw bad(400, 'Invalid score')
        const tokenHash = hash(b.token), run = await store.get(b.id, tokenHash)
        if (!run || run.version !== BOARD_VERSION) throw bad(403, 'Invalid run')
        if (run.score !== null) {
          if (run.score !== b.score || run.outcome !== b.outcome || run.elapsed !== b.elapsed || run.callsign !== b.callsign) throw bad(409, 'Run already submitted')
          return json(res, 200, { id:run.id, accepted:true })
        }
        if (Number(run.expires) < time) throw bad(410, 'Run expired; local score retained')
        // Timing and generous score envelope catch obvious fabrication, not cheating.
        // Registration is asynchronous; allow up to two four-second network budgets.
        if (b.elapsed > (time - Number(run.started)) / 1000 + 8 || b.score > Math.ceil(b.elapsed / 4.5) * 400 + (b.outcome === 'victory' ? 2000 : 0)) throw bad(400, 'Implausible score or duration')
        const saved = await store.finish(b.id, tokenHash, { ...b, createdAt:new Date(time).toISOString() })
        if (saved.score !== b.score || saved.outcome !== b.outcome || saved.elapsed !== b.elapsed || saved.callsign !== b.callsign) throw bad(409, 'Run already submitted')
        return json(res, 200, { id:b.id, accepted:true })
      }
      throw bad(404, 'Not found')
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 503, { error:error.status ? error.message : 'Leaderboard unavailable; local scores remain available' })
      else res.end()
    }
  })
}
