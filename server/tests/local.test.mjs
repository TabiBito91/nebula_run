import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LocalScores } from '../../src/game/leaderboard/LocalScores.ts'
import { BOARD_VERSION } from '../../src/game/leaderboard/rules.ts'

// LocalScores uses a browser storage contract; exercise corrupt/blocked storage without gameplay mutation.
test('local records persist, deduplicate, sort and remain bounded',()=>{
  const memory=new Map()
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}})
  const store=new LocalScores()
  const entry={id:'one',version:BOARD_VERSION,callsign:store.callsign,score:100,outcome:'defeat',elapsed:10,createdAt:new Date().toISOString()}
  store.add(entry);store.add(entry);assert.equal(store.entries.length,1)
  for(let i=0;i<20;i++)store.add({...entry,id:`run-${i}`,score:i*100})
  assert.equal(store.entries.length,10);assert.equal(store.entries[0].score,1900)
  const loaded=new LocalScores();assert.equal(loaded.entries.length,10);assert.equal(loaded.callsign,store.callsign)
  loaded.clear();assert.equal(new LocalScores().entries.length,0)
  delete globalThis.localStorage
})
test('bad versions, malformed entries and unavailable storage never throw',()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{bad',setItem:()=>{throw new Error('denied')}}})
  const store=new LocalScores();assert.equal(store.persistent,false)
  store.add({id:'one',version:BOARD_VERSION,callsign:store.callsign,score:100,outcome:'defeat',elapsed:10,createdAt:new Date().toISOString()})
  assert.equal(store.entries.length,1);assert.equal(store.persistent,false)
  store.add({...store.entries[0],id:'old',version:'old'})
  assert.equal(store.entries.length,1)
  delete globalThis.localStorage
})
