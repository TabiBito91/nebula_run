import { test, expect, scene, state } from './support'
import { BOARD_VERSION } from '../src/game/leaderboard/rules'
import { openStore } from '../server/store.mjs'
import { createApp } from '../server/app.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

test.use({ leaderboardApi:true })
const sample = { id:'sample-run',version:BOARD_VERSION,callsign:'PILOT-ABC123',score:2400,outcome:'victory',elapsed:140,createdAt:'2026-09-01T00:00:00.000Z' }

test('generated artifact writes leave the development server available',async({page})=>{
  await page.goto('/')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
  await mkdir('.logs/leaderboard-review',{recursive:true})
  for(let i=0;i<10;i++)await writeFile('.logs/leaderboard-review/watch-regression.json',JSON.stringify({iteration:i}))
  await page.reload()
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
  expect((await state(page)).status).toBe('title')
})

test('online board is keyboard modal, safely rendered, with local persistence and clear confirmation',async({page},info)=>{
  await page.addInitScript(e=>localStorage.setItem('nebula-run:scores:v1',JSON.stringify({entries:[e]})),sample)
  await page.route('**/api/leaderboard?*',r=>r.fulfill({json:{version:BOARD_VERSION,entries:[sample]}}))
  await page.goto('/')
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Flight records'})
  await expect(dialog.getByText('2,400')).toBeVisible()
  await page.keyboard.press('Enter') // close button is focused, not Launch
  await expect(dialog).not.toBeVisible();expect((await state(page)).status).toBe('title')
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
  await dialog.getByRole('button',{name:'On this device'}).click()
  await page.screenshot({path:info.outputPath('leaderboard-local.png')})
  await dialog.getByRole('button',{name:'Clear local scores',exact:true}).click()
  await expect(dialog.getByRole('button',{name:'Keep scores',exact:true})).toBeFocused()
  await dialog.getByRole('button',{name:'Keep scores',exact:true}).click()
  expect((await state(page)).leaderboard.localCount).toBe(1)
  await dialog.getByRole('button',{name:'Clear local scores',exact:true}).click()
  await dialog.getByRole('button',{name:'Clear scores permanently'}).click()
  expect((await state(page)).leaderboard.localCount).toBe(0)
  await page.keyboard.press('Escape');expect((await state(page)).status).toBe('title')
})

test('invalid service response and corrupt or denied storage degrade without stopping play',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('nebula-run:scores:v1','{corrupt')
    Storage.prototype.setItem=()=>{throw new Error('Storage denied')}
  })
  await page.route('**/api/**',r=>r.fulfill({json:{unavailable:true}}))
  await page.goto('/')
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Online leaderboard unavailable')
  await page.keyboard.press('Escape');await page.getByRole('button',{name:/LAUNCH SORTIE/}).click()
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().missionElapsedTime>.3)
  expect((await state(page)).leaderboard.persistent).toBe(false)
})

test('fixtures and abandoned sorties never record or submit',async({page})=>{
  let submissions=0,registrations=0
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname
    if(path==='/api/scores')submissions++
    if(path==='/api/runs')registrations++
    return r.fulfill({json:path==='/api/leaderboard'?{version:BOARD_VERSION,entries:[]}:{id:crypto.randomUUID(),token:'a'.repeat(64),expires:Date.now()+7200000}})
  })
  await scene(page,'mission-complete')
  expect((await state(page)).leaderboard.recorded).toBe(false)
  await expect(page.getByRole('button',{name:'Save score',exact:true})).toHaveCount(0)
  expect(registrations).toBe(0)
  await page.getByRole('button',{name:'Main Menu',exact:true}).click()
  await page.keyboard.press('Enter')
  await expect.poll(()=>registrations).toBe(1)
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Return to Main Menu',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Return to Menu',exact:true}).click()
  expect((await state(page)).leaderboard.localCount).toBe(0)
  expect(submissions).toBe(0)
})

// Real keyboard launch and unaccelerated simulation; no scene change or state setters.
test('real sortie records once, retries an ambiguous submission safely, and persists locally',async({page},info)=>{
  test.setTimeout(190000)
  const store=await openStore({file:':memory:'})
  const server=createApp({store,origin:'http://127.0.0.1:5173',secret:'browser-test-only'})
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  let submitted=0;let accepted:Record<string,unknown>|null=null
  try {
  await page.route('**/api/**',async r=>{
    const path=new URL(r.request().url()).pathname
    const response=await r.fetch({url:`http://127.0.0.1:${server.address().port}${path}${new URL(r.request().url()).search}`})
    expect(response.ok()).toBe(true)
    if(path!=='/api/scores')return r.fulfill({response})
    submitted++;const data=r.request().postDataJSON()
    if(accepted)expect(data).toEqual(accepted)
    accepted=data
    // Model a server acceptance whose acknowledgement is unusable, without a console/network error.
    return submitted===1?r.fulfill({json:{unavailable:true}}):r.fulfill({response})
  })
  await page.goto('/');await page.keyboard.press('Enter')
  await page.keyboard.down('Space')
  await page.waitForFunction(()=>['mission-complete','game-over'].includes(window.__GAME_INSPECTOR__!.getState().status),undefined,{timeout:165000})
  await page.keyboard.up('Space')
  await expect(page.getByRole('button',{name:'Save score',exact:true})).toBeVisible()
  expect((await state(page)).leaderboard.localCount).toBe(1);expect(submitted).toBe(0)
  await page.screenshot({path:info.outputPath('compact-results.png')})
  await page.getByRole('button',{name:'Save score',exact:true}).click()
  const endedStatus = (await state(page)).status
  await page.getByRole('button',{name:'Cancel',exact:true}).focus()
  await page.keyboard.press('KeyR')
  expect((await state(page)).status).toBe(endedStatus)
  const name=page.getByRole('textbox',{name:'Display name',exact:true})
  await name.fill('Nova Pilot_7')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Save',exact:true}).click()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nebula-run:scores:v1')!).entries[0].callsign)).toBe('Nova Pilot_7')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Retry sharing safely')
  await expect(name).toBeDisabled()
  await page.getByRole('dialog').getByRole('button',{name:'Retry sharing'}).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('status')).toContainText('Shared online')
  expect(submitted).toBe(2);expect((await state(page)).leaderboard.localCount).toBe(1)
  expect((await store.top(BOARD_VERSION,25))).toHaveLength(1)
  expect((await store.top(BOARD_VERSION,25))[0].callsign).toBe('Nova Pilot_7')
  await page.screenshot({path:info.outputPath('leaderboard-result.png')})
  await info.attach('leaderboard-state',{body:JSON.stringify(await state(page)),contentType:'application/json'})
  await page.reload();await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
  expect((await state(page)).leaderboard.localCount).toBe(1)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nebula-run:scores:v1')!).entries[0].callsign)).toBe('Nova Pilot_7')
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
  await expect(page.getByRole('dialog').getByText(String(accepted!.callsign),{exact:false})).toBeVisible()
  await page.screenshot({path:info.outputPath('leaderboard-online.png')})
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(resolve));await store.close()}
})
