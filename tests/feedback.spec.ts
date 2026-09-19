import { test, expect, state, scene } from './support'
import { createApp } from '../server/app.mjs'
import { openStore } from '../server/store.mjs'

let server: any, store: any, endpoint: string
test.beforeAll(async () => {
  store = await openStore({file:':memory:'})
  server = createApp({store,origin:'http://127.0.0.1:5173',secret:'test-feedback'})
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
  endpoint = `http://127.0.0.1:${server.address().port}/api/feedback`
})
test.afterAll(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(r));await store.close()})
test.beforeEach(async({page})=>{
  await store.query('DELETE FROM leaderboard_limits')
  await page.route('**/api/feedback',async route=>route.fulfill({response:await route.fetch({url:endpoint})}))
})
test('title form submits privately with frozen context and no gameplay hotkeys',async({page},info)=>{
  await page.goto('/'); await page.getByRole('button',{name:'More ⋯'}).click(); await page.getByRole('button',{name:'Feedback',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Send feedback'})
  await dialog.getByLabel('Your feedback').fill('More tropical planets please!')
  await page.keyboard.press('r'); await page.keyboard.press('p')
  expect((await state(page)).status).toBe('title')
  await dialog.getByLabel('Feedback type').selectOption('suggestion')
  await page.screenshot({path:info.outputPath('feedback-desktop.png')})
  await dialog.getByRole('button',{name:'Send feedback',exact:true}).click()
  await expect(dialog.getByRole('status')).toHaveText('Thanks—your feedback was sent!')
  const rows=await store.query("SELECT * FROM game_feedback WHERE category='suggestion'")
  expect(rows).toHaveLength(1);expect(JSON.parse(rows[0].context_json).screen).toBe('title')
  await dialog.getByRole('button',{name:'Done',exact:true}).click()
  await expect(dialog).not.toBeVisible()
})
test('pause stays paused, discard is explicit, results have feedback',async({page})=>{
  await scene(page,'basic-flight')
  await page.getByRole('button',{name:'More ⋯'}).click(); await page.getByRole('button',{name:'Feedback',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Send feedback'})
  await dialog.getByLabel('Your feedback').fill('Pause report')
  const before=await state(page)
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('button',{name:'Keep editing'})).toBeVisible()
  await dialog.getByRole('button',{name:'Keep editing'}).click()
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
  await dialog.getByRole('button',{name:'Discard draft'}).click()
  expect((await state(page)).paused).toBe(true)
  expect((await state(page)).missionElapsedTime).toBe(before.missionElapsedTime)
  await page.evaluate(()=>window.__GAME_INSPECTOR__!.loadScene('mission-complete'))
  await page.getByRole('button',{name:'More ⋯'}).click(); await page.getByRole('button',{name:'Feedback',exact:true}).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('pre')).toContainText('victory')
})
test('lost response retry sends identical payload and stores only once',async({page,audit})=>{
  let first=true; const payloads:string[]=[]
  await page.route('**/api/feedback',async route=>{
    payloads.push(route.request().postData()!)
    const response=await route.fetch({url:endpoint})
    if(first){first=false;await route.abort()}else await route.fulfill({response})
  })
  await page.goto('/');await page.getByRole('button',{name:'More ⋯'}).click(); await page.getByRole('button',{name:'Feedback',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Send feedback'})
  await dialog.getByLabel('Your feedback').fill('Retry report')
  await dialog.getByRole('button',{name:'Send feedback',exact:true}).click()
  await expect(dialog.getByRole('button',{name:'Retry',exact:true})).toBeEnabled()
  await expect(dialog.getByLabel('Your feedback')).toHaveValue('Retry report')
  await dialog.getByRole('button',{name:'Retry',exact:true}).click()
  await expect(dialog.getByRole('status')).toContainText('Thanks')
  expect(payloads[0]).toBe(payloads[1])
  expect(await store.query('SELECT id FROM game_feedback WHERE id=$1',[JSON.parse(payloads[0]).id])).toHaveLength(1)
  // Only the deliberately dropped response is expected; other errors still fail.
  expect(audit.slice().sort()).toEqual(['network: http://127.0.0.1:5173/api/feedback net::ERR_FAILED','console: Failed to load resource: net::ERR_FAILED'].sort())
  audit.splice(0)
})
test('mobile form fits and submits touch context',async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true})
  const page=await context.newPage()
  try {
    await page.route('**/api/feedback',async route=>route.fulfill({response:await route.fetch({url:endpoint})}))
    await page.goto('http://127.0.0.1:5173/')
    await page.getByRole('button',{name:'More ⋯'}).tap(); await page.getByRole('button',{name:'Feedback',exact:true}).tap()
    const dialog=page.getByRole('dialog',{name:'Send feedback'})
    await dialog.getByLabel('Your feedback').fill('Phone feedback')
    await page.screenshot({path:info.outputPath('feedback-mobile.png')})
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
    await dialog.getByRole('button',{name:'Send feedback',exact:true}).tap()
    await expect(dialog.getByRole('status')).toContainText('Thanks')
    const rows=await store.query("SELECT context_json FROM game_feedback WHERE message='Phone feedback'")
    expect(JSON.parse(rows[0].context_json).controls).toBe('touch')
  } finally {await context.close()}
})
