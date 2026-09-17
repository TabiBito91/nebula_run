import { test, expect } from './support'

test('production boots, ignores fixture query and does not expose inspector', async ({ page }) => {
  await page.goto('/?testScene=mission-complete')
  await expect(page.getByRole('button', { name: 'LAUNCH SORTIE' })).toBeVisible()
  expect(await page.evaluate(() => '__GAME_INSPECTOR__' in window)).toBe(false)
  await page.keyboard.press('Enter')
  await expect(page.locator('#overlay')).toBeHidden()
  await expect(page.locator('#time')).not.toHaveText('00:00 / 02:30')
  expect(await page.evaluate(() => '__GAME_INSPECTOR__' in window)).toBe(false)
})
