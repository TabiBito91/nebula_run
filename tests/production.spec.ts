import { test, expect } from './support'

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
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await page.getByRole('slider', { name: 'Music volume' }).fill('22')
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { audioContexts: number }).audioContexts)).toBe(1)
  await page.reload()
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
