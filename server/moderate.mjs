// Operator-only CLI: no publicly accessible admin endpoint.
import { openStore } from './store.mjs'
const [action,id]=process.argv.slice(2)
if (!['hide','restore'].includes(action) || !/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Usage: node server/moderate.mjs hide|restore RUN_UUID')
if (process.env.NODE_ENV==='production' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL required')
const store=await openStore({url:process.env.DATABASE_URL,file:process.env.SQLITE_PATH || '.data/leaderboard.sqlite'})
try {
  const rows=await store.query('UPDATE leaderboard_runs SET hidden=$1 WHERE id=$2 AND score IS NOT NULL RETURNING id',[action==='hide'?1:0,id])
  console.log(rows.length ? `Score ${action==='hide'?'hidden':'restored'}`:'No matching score')
} finally {await store.close()}
