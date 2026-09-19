import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createApp } from '../app.mjs'
import { openStore } from '../store.mjs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const report = () => ({ id:randomUUID(), category:'bug', message:'The rock disappeared.', feeling:'hard', context:{schema:1,build:'test-build',levelId:'signalbreak',levelName:'Relay belt',difficulty:'veteran',rules:'signalbreak-4-veteran',screen:'pause',phase:'debris',elapsed:65,controls:'touch'} })
async function setup(t) {
  const store = await openStore({file:':memory:'}); let now = Date.now()
  const server = createApp({store,origin:'http://game.test',secret:'feedback-test',now:()=>now})
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close()})
  const call = (data, headers={}, method='POST') => fetch(`http://127.0.0.1:${server.address().port}/api/feedback`,{method,headers:{origin:'http://game.test','content-type':'application/json',...headers},body:method==='POST'?JSON.stringify(data):undefined})
  return {store,call,advance:()=>{now+=600001}}
}
test('private feedback is durable, duplicate-safe, and preserves review metadata',async t=>{
  const h=await setup(t), b=report()
  const replies=await Promise.all([h.call(b),h.call(b)])
  assert.deepEqual(replies.map(r=>r.status),[200,200])
  assert.deepEqual(await replies[0].json(),{accepted:true,id:b.id})
  let rows=await h.store.query('SELECT * FROM game_feedback')
  assert.equal(rows.length,1);assert.equal(rows[0].message,b.message);assert.equal(rows[0].status,'new')
  assert.equal(JSON.parse(rows[0].context_json).controls,'touch')
  await h.store.query("UPDATE game_feedback SET status='planned',private_notes='Investigate' WHERE id=$1",[b.id])
  assert.equal((await h.call(b)).status,200)
  assert.equal((await h.call({...b,message:'changed'})).status,409)
  rows=await h.store.query('SELECT * FROM game_feedback');assert.equal(rows[0].status,'planned');assert.equal(rows[0].private_notes,'Investigate')
  assert.equal((await h.call(null,{},'GET')).status,405)
  assert.equal((await h.store.query('SELECT * FROM leaderboard_runs')).length,0)
})
test('validation rejects extras, invalid context and oversized requests; accepts Unicode',async t=>{
  const h=await setup(t)
  for (const change of [{message:' '},{message:'a'.repeat(1001)},{category:'spam'},{feeling:'bad'},{id:'bad'},{email:'private'},{context:{schema:2}},{context:{...report().context,elapsed:-1}},{message:'x'.repeat(9000)}]) {
    h.advance(); const res=await h.call({...report(),...change});assert.ok([400,413].includes(res.status))
  }
  h.advance();assert.equal((await h.call({...report(),message:'星'.repeat(1000)})).status,200)
})
test('origins, rate limits, and retention are enforced',async t=>{
  const h=await setup(t)
  assert.equal((await h.call(report(),{origin:'https://evil.test'})).status,403)
  assert.equal((await h.call(report(),{'sec-fetch-site':'cross-site'})).status,403)
  const old=report();assert.equal((await h.call(old)).status,200)
  await h.store.query('UPDATE game_feedback SET created_at=0 WHERE id=$1',[old.id])
  for(let i=0;i<4;i++)assert.equal((await h.call(report())).status,200)
  assert.equal((await h.call(report())).status,429)
  assert.equal((await h.store.query('SELECT * FROM game_feedback WHERE id=$1',[old.id])).length,0)
  h.advance();assert.equal((await h.call(report())).status,200)
})

test('feedback and review notes survive database reopen',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'nebula-feedback-')), file=join(directory,'test.sqlite')
  let store
  try {
    store=await openStore({file});const b=report()
    await store.feedback(b,'hash',Date.now())
    await store.query("UPDATE game_feedback SET status='reviewed',private_notes='Follow up' WHERE id=$1",[b.id])
    await store.close();store=await openStore({file})
    const rows=await store.query('SELECT * FROM game_feedback')
    assert.equal(rows.length,1);assert.equal(rows[0].message,b.message);assert.equal(rows[0].private_notes,'Follow up')
  } finally {await store?.close();await rm(directory,{recursive:true,force:true})}
})
