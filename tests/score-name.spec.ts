import {test,expect} from './support'
import {BOARD_VERSION} from '../src/game/leaderboard/rules'

test.use({leaderboardApi:true})

test('closing a pending submission does not duplicate or cancel its consented request', async ({page}) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release=resolve })
  let submissions=0
  await page.route('**/api/**', async r => {
    const path = new URL(r.request().url()).pathname
    if (path === '/api/leaderboard') return r.fulfill({json:{version:BOARD_VERSION,entries:[]}})
    if (path === '/api/runs') return r.fulfill({json:{id:'pending-run',token:'a'.repeat(64),expires:Date.now()+7200000}})
    submissions++; await gate; return r.fulfill({json:{accepted:true,id:'pending-run'}})
  })
  await page.goto('/tests/score-name-harness.html')
  await page.getByRole('button',{name:'Save score',exact:true}).click()
  await page.getByLabel('Display name',{exact:true}).fill('Pending Pilot')
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('will not cancel')
  await expect(page.getByRole('button',{name:'Saving…',exact:true})).toBeDisabled()
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
  await expect.poll(()=>submissions).toBe(1)
  release()
  await expect(page.getByRole('status')).toContainText('Shared online')
  await page.getByRole('button',{name:'Score details',exact:true}).click()
  await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('Pending Pilot')
  await expect(page.getByRole('button',{name:'Saved',exact:true})).toBeDisabled()
  await expect(page.getByRole('dialog').getByRole('button',{name:'Close',exact:true})).toBeFocused()
  expect(submissions).toBe(1)
})

test('cancel retains a draft without saving or consent, and restores focus', async ({page}) => {
  let submissions = 0
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname
    if (path === '/api/leaderboard') return r.fulfill({json:{version:BOARD_VERSION,entries:[]}})
    if (path === '/api/runs') return r.fulfill({json:{id:'test-run',token:'a'.repeat(64),expires:Date.now()+7200000}})
    submissions++; return r.fulfill({json:{accepted:true,id:'test-run'}})
  })
  await page.goto('/tests/score-name-harness.html')
  const stored = () => page.evaluate(()=>JSON.parse(localStorage.getItem('nebula-run:scores:v1')!).entries[0].callsign)
  const original = await stored()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  const open = page.getByRole('button',{name:'Save score',exact:true})
  await open.click()
  await page.getByLabel('Display name',{exact:true}).fill('Draft Pilot')
  await page.getByRole('checkbox').check()
  await page.keyboard.press('Escape')
  await expect(open).toBeFocused()
  expect(await stored()).toBe(original); expect(submissions).toBe(0)
  await open.click()
  await expect(page.getByLabel('Display name',{exact:true})).toHaveValue('Draft Pilot')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('button',{name:'Save',exact:true}).click()
  expect(await stored()).toBe('Draft Pilot'); expect(submissions).toBe(0)
})

test.describe('mobile save dialog', () => {
  test.use({viewport:{width:844,height:390},hasTouch:true,isMobile:true})
  test('touch save is scrollable without horizontal overflow', async ({page},info) => {
    await page.route('**/api/**', r => r.fulfill({json:{offline:true}}))
    await page.goto('/tests/score-name-harness.html')
    await page.getByRole('button',{name:'Save score',exact:true}).tap()
    const dialog = page.getByRole('dialog',{name:'Save score'})
    await page.getByLabel('Display name',{exact:true}).fill('Touch Pilot')
    expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
    await page.screenshot({path:info.outputPath('mobile-save-dialog.png')})
    await page.getByRole('button',{name:'Save',exact:true}).tap()
    await expect(dialog).not.toBeVisible()
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nebula-run:scores:v1')!).entries[0].callsign)).toBe('Touch Pilot')
  })
})

// Isolated presentation component, NOT a gameplay journey. The existing real
// sortie test separately verifies the entire game -> database -> reload path.

test('draft survives async registration; explicit save is local, invalid edits are preserved', async ({page},info) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release=resolve })
  let submissions = 0
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/leaderboard') { await gate; return route.fulfill({json:{version:BOARD_VERSION,entries:[]}}) }
    if (path === '/api/runs') return route.fulfill({json:{id:'test-run',token:'a'.repeat(64),expires:Date.now()+7200000}})
    submissions++; return route.fulfill({json:{accepted:true,id:'test-run'}})
  })
  await page.goto('/tests/score-name-harness.html')
  await page.getByRole('button',{name:'Save score',exact:true}).click()
  const name=page.getByLabel('Display name', {exact:true})
  await name.fill('Nova Pilot_7')
  release()
  await expect(page.getByRole('dialog').getByRole('status')).not.toContainText('Checking online')
  await expect(name).toHaveValue('Nova Pilot_7')
  await expect(name).toBeFocused()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await name.fill('<bad>')
  await page.getByRole('button',{name:'Save',exact:true}).click()
  await expect(name).toHaveValue('<bad>')
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Use a name')
  await name.fill('Nova Pilot_7')
  await page.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Name and score saved locally')
  expect(submissions).toBe(0)
  await page.screenshot({path:info.outputPath('saved-name.png')})
  await page.goto('/')
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
  await page.getByRole('button',{name:'On this device',exact:true}).click()
  await expect(page.locator('[data-rows]')).toContainText('Nova Pilot_7')
})

test('offline names save independently and can be changed before any submission', async ({page}) => {
  await page.route('**/api/**', r=>r.fulfill({json:{offline:true}}))
  await page.goto('/tests/score-name-harness.html')
  await page.getByRole('button',{name:'Save score',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('local only')
  const name=page.getByLabel('Display name', {exact:true})
  for (const value of ['Offline Pilot','Changed Pilot']) {
    await name.fill(value)
    await page.getByRole('button',{name:'Save',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('Name and score saved locally')
    await page.getByRole('button',{name:'Save score',exact:true}).click()
    await expect(name).toBeEnabled()
    await expect(page.getByRole('checkbox')).toBeDisabled()
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nebula-run:scores:v1')!).entries[0].callsign)).toBe(value)
  }
})

test('unconfirmed sharing locks the saved name and retries identical data', async ({page}) => {
  const sent: Record<string,unknown>[] = []
  await page.route('**/api/**', r=>{
    const path=new URL(r.request().url()).pathname
    if(path==='/api/leaderboard')return r.fulfill({json:{version:BOARD_VERSION,entries:[]}})
    if(path==='/api/runs')return r.fulfill({json:{id:'test-run',token:'a'.repeat(64),expires:Date.now()+7200000}})
    sent.push(r.request().postDataJSON())
    return r.fulfill({json:sent.length===1?{unavailable:true}:{accepted:true,id:'test-run'}})
  })
  await page.goto('/tests/score-name-harness.html')
  await page.getByRole('button',{name:'Save score',exact:true}).click()
  const name=page.getByLabel('Display name', {exact:true})
  await name.fill('Saved Pilot')
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Retry sharing safely')
  await expect(name).toBeDisabled()
  await expect(page.getByText(/Name locked because/)).toBeVisible()
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
  await page.getByRole('button',{name:'Retry sharing',exact:true}).click()
  await expect(name).toHaveValue('Saved Pilot')
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(page.getByRole('checkbox')).toBeDisabled()
  await page.getByRole('dialog').getByRole('button',{name:'Retry sharing',exact:true}).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('status')).toContainText('Shared online')
  expect(sent).toHaveLength(2)
  expect(sent[0]).toEqual(sent[1])
  expect(sent[0].callsign).toBe('Saved Pilot')
})

test('blocked storage reports session-only name saving honestly', async ({page}) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage denied') } })
  await page.route('**/api/**', r=>r.fulfill({json:{offline:true}}))
  await page.goto('/tests/score-name-harness.html')
  await page.getByRole('button',{name:'Save score',exact:true}).click()
  await page.getByLabel('Display name', {exact:true}).fill('Session Pilot')
  await page.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Name and score saved for this session only')
  await page.getByRole('button',{name:'Save score',exact:true}).click()
  await expect(page.getByLabel('Display name', {exact:true})).toHaveValue('Session Pilot')
  expect(await page.evaluate(()=>localStorage.getItem('nebula-run:scores:v1'))).toBeNull()
})
