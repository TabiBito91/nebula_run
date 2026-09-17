import { test, expect } from './support'

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
