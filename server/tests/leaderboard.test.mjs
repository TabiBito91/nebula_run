import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createApp } from '../app.mjs'
import { openStore } from '../store.mjs'
import { BOARD_VERSION, rankEntries, validResult } from '../../src/game/leaderboard/rules.ts'

async function setup(t) {
  const store=await openStore({file:':memory:'}); let now=1800000000000
  const server=createApp({store,origin:'http://game.test',secret:'test-secret',now:()=>now})
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close()})
  const call=async(path,data,headers={})=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method:data?'POST':'GET',headers:{Origin:'http://game.test',...(data?{'Content-Type':'application/json'}:{}),...headers},body:data?JSON.stringify(data):undefined})
    return {status:res.status,body:await res.json()}
  }
  const run=async()=> (await call('runs',{version:BOARD_VERSION})).body
  const result=(r,extra={})=>({id:r.id,token:r.token,version:BOARD_VERSION,score:100,elapsed:10,outcome:'defeat',callsign:'PILOT-ABC123',...extra})
  return {store,call,run,result,advance:(ms)=>{now+=ms}}
}
test('ticket, score, idempotency and ranking; secrets never returned in board',async t=>{
  const h=await setup(t),r=await h.run();h.advance(10000)
  const data=h.result(r)
  assert.equal((await h.call('scores',data)).status,200)
  assert.equal((await h.call('scores',data)).status,200)
  assert.equal((await h.call('scores',{...data,score:200})).status,409)
  const board=(await h.call('leaderboard')).body
  assert.equal(board.entries.length,1);assert.equal(board.entries[0].score,100)
  assert.ok(!JSON.stringify(board).includes(r.token));assert.ok(!JSON.stringify(board).includes('token_hash'))
  await h.store.query('UPDATE leaderboard_runs SET hidden=1 WHERE id=$1',[r.id])
  assert.equal((await h.call('leaderboard')).body.entries.length,0)
})
test('reject invalid, forged, expired, wrong-version, early and impossible results',async t=>{
  const h=await setup(t),r=await h.run(),data=h.result(r)
  assert.equal((await h.call('scores',data)).status,400)
  h.advance(10000)
  for(const change of [{score:-1},{score:123},{score:999999},{elapsed:-1},{outcome:'victory'},{version:'old'},{callsign:'<script>'},{callsign:'ab'},{callsign:' Admin '},{callsign:'admin'},{callsign:'two  spaces'},{testScene:'mission-start'}])assert.equal((await h.call('scores',{...data,...change})).status,400)
  assert.equal((await h.call('scores',{...data,token:'a'.repeat(64)})).status,403)
  h.advance(7200001);assert.equal((await h.call('scores',data)).status,410)
})
test('one run cannot be double-scored by concurrent requests',async t=>{
  const h=await setup(t),r=await h.run();h.advance(10000)
  const responses=await Promise.all([h.call('scores',h.result(r)),h.call('scores',h.result(r,{score:200}))])
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409])
  assert.equal((await h.call('leaderboard')).body.entries.length,1)
})
test('origin checks, rate limiting, forwarded IP spoofing and expiry cleanup',async t=>{
  const h=await setup(t)
  assert.equal((await h.call('runs',{version:BOARD_VERSION},{Origin:'https://evil.test'})).status,403)
  for(let i=0;i<12;i++)assert.equal((await h.call('runs',{version:BOARD_VERSION},{'X-Forwarded-For':`1.2.3.${i}`})).status,201)
  assert.equal((await h.call('runs',{version:BOARD_VERSION},{'X-Forwarded-For':'9.9.9.9'})).status,429)
  h.advance(8000000);assert.equal((await h.call('runs',{version:BOARD_VERSION})).status,201)
  assert.equal((await h.store.query('SELECT * FROM leaderboard_runs')).length,1)
})
test('database failure returns safe unavailable response',async t=>{
  const h=await setup(t);h.store.top=async()=>{throw new Error('secret database details')}
  const response=await h.call('leaderboard');assert.equal(response.status,503)
  assert.ok(!JSON.stringify(response).includes('secret database'))
})
test('ranking uses score, victory, oldest timestamp; top count bounded',()=>{
  const entries=Array.from({length:30},(_,i)=>({id:String(i),score:100,outcome:i===20?'victory':'defeat',createdAt:new Date(i*1000).toISOString()}))
  const ranked=rankEntries(entries,25);assert.equal(ranked.length,25);assert.equal(ranked[0].id,'20');assert.equal(ranked[1].id,'0')
  assert.equal(validResult({score:2000,outcome:'victory',elapsed:121,callsign:'PILOT-123ABC'}),true)
  assert.equal(validResult({score:100,outcome:'defeat',elapsed:10,callsign:'Nova Pilot_7'}),true)
})
test('local development database survives restart',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'nebula-board-')),file=join(dir,'scores.sqlite')
  try {
    let store=await openStore({file});await store.create({id:'persist',hash:'hash',version:BOARD_VERSION,started:0,expires:1})
    await store.finish('persist','hash',{score:100,outcome:'defeat',elapsed:10,callsign:'PILOT-123ABC',createdAt:new Date().toISOString()});await store.close()
    store=await openStore({file});assert.equal((await store.top(BOARD_VERSION,25)).length,1);await store.close()
  } finally { await rm(dir,{recursive:true,force:true}) }
})

test('production command refuses missing durable database configuration',()=>{
  const result=spawnSync(process.execPath,['server/index.mjs','--production'],{encoding:'utf8',env:{...process.env,DATABASE_URL:'',APP_ORIGIN:'',RATE_LIMIT_SECRET:''}})
  assert.notEqual(result.status,0);assert.match(result.stderr,/No ephemeral database fallback/)
})
