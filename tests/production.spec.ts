import { test, expect } from './support'

test('production difficulty choice changes HUD and remains locked in flight', async ({page}) => {
  await page.goto('/')
  await page.getByLabel('Difficulty',{exact:true}).selectOption('veteran')
  await page.getByRole('button',{name:/LAUNCH SORTIE/}).click()
  await expect(page.locator('#hint')).toContainText('Veteran')
  await expect(page.getByLabel('Difficulty',{exact:true})).toHaveCount(0)
  await expect(page.locator('#time')).not.toHaveText('00:00 / 02:30')
  expect(await page.evaluate(() => '__GAME_INSPECTOR__' in window)).toBe(false)
})

test('production audio unlocks once and settings persist without inspector', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext
    ;(window as unknown as { audioContexts: number }).audioContexts = 0
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) { super(options); (window as unknown as { audioContexts: number }).audioContexts++ }
    }
  })
  await page.goto('/?testScene=audio-boost')
  await expect(page.getByRole('button', { name: 'LAUNCH SORTIE' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { audioContexts: number }).audioContexts)).toBe(0)
  await page.getByRole('button', { name: 'More ⋯' }).click()
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await page.getByRole('slider', { name: 'Music volume' }).fill('22')
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { audioContexts: number }).audioContexts)).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'More ⋯' }).click()
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Music volume' })).toHaveValue('22')
  await expect(page.getByRole('button', { name: 'Unmute audio', exact: true })).toBeVisible()
  expect(await page.evaluate(() => '__GAME_INSPECTOR__' in window)).toBe(false)
})

test('production boots, ignores fixture query and does not expose inspector', async ({ page }) => {
  const asset=page.waitForResponse(response=>response.url().endsWith('/models/strix-9.glb')&&response.ok())
  await page.goto('/?testScene=mission-complete')
  await asset
  await expect(page.locator('.shield-module small')).toHaveText('INTERCEPTOR / STRIX-9')
  await expect(page.getByRole('button', { name: 'LAUNCH SORTIE' })).toBeVisible()
  expect(await page.evaluate(() => '__GAME_INSPECTOR__' in window)).toBe(false)
  await page.keyboard.press('Enter')
  await expect(page.locator('#overlay')).toBeHidden()
  await expect(page.locator('#time')).not.toHaveText('00:00 / 02:30')
  expect(await page.evaluate(() => '__GAME_INSPECTOR__' in window)).toBe(false)
})

test('production legacy selector keeps original ship playable',async({page})=>{
  await page.goto('/?ship=legacy')
  await page.keyboard.press('Enter')
  await expect(page.locator('.shield-module small')).toHaveText('COURIER / KESTREL-9')
  await expect(page.locator('#time')).not.toHaveText('00:00 / 02:30')
  expect(await page.evaluate(()=>'__GAME_INSPECTOR__' in window)).toBe(false)
})

test('production ignores development environment speed fixture',async({page})=>{
  await page.goto('/?testScene=environment-boost')
  await expect(page.getByRole('button',{name:'LAUNCH SORTIE'})).toBeVisible()
  expect(await page.evaluate(()=>'__GAME_INSPECTOR__' in window)).toBe(false)
  await page.keyboard.press('Enter')
  await expect(page.locator('#time')).not.toHaveText('00:00 / 02:30')
  await expect(page.locator('.shield-module small')).toHaveText('INTERCEPTOR / STRIX-9')
})
test.describe('production leaderboard service', () => {
test.use({ leaderboardApi: true })

test('production feedback persists privately without inspector', async ({page}) => {
  const { openStore } = await import('../server/store.mjs')
  const { createApp } = await import('../server/app.mjs')
  const store = await openStore({file:':memory:'}), origins:string[] = []
  const server = createApp({store,origin:origins,secret:'production-feedback-test'})
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
  const url = `http://127.0.0.1:${server.address().port}`; origins.push(url)
  try {
    await page.goto(url)
    await page.getByRole('button',{name:'More ⋯'}).click()
    await page.getByRole('button',{name:'Feedback',exact:true}).click()
    const dialog=page.getByRole('dialog',{name:'Send feedback'})
    await dialog.getByLabel('Your feedback').fill('Production form test')
    await dialog.getByRole('button',{name:'Send feedback',exact:true}).click()
    await expect(dialog.getByRole('status')).toContainText('Thanks')
    const rows=await store.query('SELECT * FROM game_feedback')
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0].context_json).build).not.toBe('development')
    expect(await page.evaluate(()=>'__GAME_INSPECTOR__' in window)).toBe(false)
  } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(r));await store.close()}
})
test('production leaderboard opens and closes without launching or exposing inspector', async ({ page }) => {
  const { openStore } = await import('../server/store.mjs')
  const { createApp } = await import('../server/app.mjs')
  const store = await openStore({ file: ':memory:' })
  const server = createApp({ store, origin: 'http://127.0.0.1', secret: 'production-smoke-only' })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Flight records' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Online scores')
  await expect(page.getByLabel('Ranking difficulty').locator('option')).toHaveCount(3)
  await page.getByRole('button',{name:'Archived rankings',exact:true}).click()
  await expect(page.getByLabel('Ranking difficulty').locator('option')).toHaveCount(5)
  await expect(page.getByText(/Previous rules · read-only/)).toBeVisible()
  await page.getByRole('button',{name:'Back to current rankings',exact:true}).click()
  await expect(page.getByLabel('Ranking difficulty').locator('option')).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /LAUNCH SORTIE/ })).toBeVisible()
  expect(await page.evaluate(() => window.__GAME_INSPECTOR__)).toBeUndefined()
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(resolve)); await store.close() }
})
})
