import { test, expect, state, scene, resume } from './support'
import { BOARDS, boardVersion, scoreMultiplier } from '../src/game/leaderboard/rules'

test('changing difficulty retains keyboard focus and does not launch', async ({page}) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
  const selector = page.getByLabel('Difficulty',{exact:true})
  await selector.focus()
  await selector.selectOption('veteran')
  await expect.poll(async () => (await state(page)).difficulty).toBe('veteran')
  await expect(selector).toBeFocused()
  await selector.selectOption('relaxed')
  await expect(page.locator('#difficulty-help')).toContainText('fewer gunners')
  await expect(selector).toBeFocused()
  expect((await state(page)).status).toBe('title')
})

for (const mode of ['relaxed','standard','veteran'] as const) {
  test(`${mode} menu selection, first kill, pause and return`, async ({page}, info) => {
    await page.goto('/')
    await page.waitForFunction(() => window.__GAME_INSPECTOR__?.getState().ready)
    await page.getByLabel('Difficulty', {exact:true}).selectOption(mode)
    await expect.poll(async () => (await state(page)).difficulty).toBe(mode)
    await page.screenshot({path:info.outputPath(`${mode}-menu.png`)})
    await page.getByRole('button', {name:/LAUNCH SORTIE/}).click()
    await page.keyboard.down('Space')
    await expect.poll(async () => (await state(page)).score).toBe(100 * scoreMultiplier(boardVersion(mode)))
    await page.keyboard.up('Space')
    expect((await state(page)).leaderboard.version).toBe(boardVersion(mode))
    await expect(page.getByLabel('Difficulty', {exact:true})).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.screenshot({path:info.outputPath(`${mode}-pause.png`)})
    await page.getByRole('button',{name:'Return to Main Menu',exact:true}).click()
    await page.getByRole('button',{name:'Return to Menu',exact:true}).click()
    await expect(page.getByLabel('Difficulty',{exact:true})).toHaveValue(mode)
    expect((await state(page)).leaderboard.localCount).toBe(0)
  })
}

for (const mode of ['relaxed', 'veteran'] as const) {
  test(`${mode} core victory and restart retain difficulty`, async ({page}, info) => {
    await scene(page, `${mode}-final-encounter`); await resume(page)
    await page.keyboard.down('Space')
    await page.waitForFunction(() => window.__GAME_INSPECTOR__!.getState().status === 'mission-complete', undefined, {timeout:20000})
    await page.keyboard.up('Space')
    expect((await state(page)).score).toBeGreaterThanOrEqual(2000 * scoreMultiplier(boardVersion(mode)))
    await page.screenshot({path:info.outputPath(`${mode}-victory.png`)})
    await page.keyboard.press('KeyR')
    expect((await state(page)).difficulty).toBe(mode)
    expect((await state(page)).score).toBe(0)
  })
}

test('all local rankings remain separate including legacy, offline', async ({page}, info) => {
  await page.addInitScript(boards => {
    localStorage.setItem('nebula-run:scores:v1', JSON.stringify({entries:boards.map((b,i) => ({id:String(i),version:b.version,callsign:`Pilot ${i}`,score:1500,outcome:'defeat',elapsed:100,createdAt:new Date().toISOString()}))}))
  }, BOARDS)
  await page.goto('/')
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
  await expect(page.getByLabel('Ranking difficulty').locator('option')).toHaveCount(3)
  await page.screenshot({path:info.outputPath('current-rankings.png')})
  for (const [i,board] of BOARDS.entries()) {
    if (i === 3) await page.getByRole('button',{name:'Archived rankings',exact:true}).click()
    await page.getByLabel('Ranking difficulty').selectOption(board.version)
    await expect(page.locator('[data-rows]')).toContainText(`Pilot ${i}`)
    await expect(page.locator('[data-rows] li')).toHaveCount(1)
  }
  await page.screenshot({path:info.outputPath('archived-rankings.png')})
  await page.getByRole('button',{name:'Back to current rankings',exact:true}).click()
  await expect(page.getByLabel('Ranking difficulty').locator('option')).toHaveCount(3)
  await expect(page.getByLabel('Ranking difficulty')).toHaveValue(boardVersion('veteran'))
})

test.describe('touch difficulty selection', () => {
  test.use({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:3})
  test('mobile menu and launch remain reachable', async ({page},info) => {
    await page.goto('/')
    await page.getByLabel('Difficulty',{exact:true}).selectOption('relaxed')
    await page.screenshot({path:info.outputPath('mobile-difficulty.png')})
    await page.getByRole('button',{name:/LAUNCH SORTIE/}).tap()
    await expect.poll(async () => (await state(page)).playerProjectileCount).toBeGreaterThan(0)
    expect((await state(page)).difficulty).toBe('relaxed')
  })
})

test.describe('online difficulty filters', () => {
  test.use({leaderboardApi:true})
  test('requests and renders only the selected board', async ({page}) => {
    await page.route('**/api/leaderboard?*', route => {
      const version = new URL(route.request().url()).searchParams.get('version')!
      const index = BOARDS.findIndex(b => b.version === version)
      return route.fulfill({json:{version,entries:[{id:`board-${index}`,version,callsign:`Online ${index}`,score:1500,outcome:'defeat',elapsed:100,createdAt:'2026-09-18T00:00:00Z'}]}})
    })
    await page.goto('/')
    await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
    for (const [i,board] of BOARDS.entries()) {
      if (i === 3) await page.getByRole('button',{name:'Archived rankings',exact:true}).click()
      await page.getByLabel('Ranking difficulty').selectOption(board.version)
      await expect(page.locator('[data-rows]')).toContainText(`Online ${i}`)
      await expect(page.locator('[data-rows] li')).toHaveCount(1)
      await expect(page.getByRole('status')).toContainText(board.label)
    }
  })
})
