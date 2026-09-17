import { test, expect, scene, state, resume, elapsed } from './support'
import { writeFile } from 'node:fs/promises'
import { rotatedMuzzles } from '../src/game/shipConfig'

test('ship candidate review, dimensions, lighting response and unchanged gameplay', async ({ page }, info) => {
  await scene(page,'ship-showcase')
  const inspect=()=>page.evaluate(()=>window.__GAME_INSPECTOR__!.getShipReview())
  const rest=await inspect()
  expect(rest.collision.radius).toBe(0.65)
  expect(rest.hardpoints).toEqual([[-1.22,-.16,-.617],[1.22,-.16,-.617]])
  expect(rest.candidateBounds.size[0]).toBeCloseTo(4.345,3)
  expect(rest.candidateBounds.size[1]).toBeCloseTo(1.0184,3)
  expect(rest.candidateBounds.size[2]).toBeCloseTo(4.5,3)
  expect(rest.components).toContain('port-engine-core')
  expect(rest.components).toContain('starboard-weapon-muzzle')
  const measurements: unknown[]=[]
  for(const variant of ['legacy','candidate']) {
    await page.evaluate(v=>window.__GAME_INSPECTOR__!.setShipVariant(v),variant)
    // Sample equal render-frame windows, with the same scene, lights and viewport.
    await page.evaluate(()=>new Promise<void>(resolve=>{
      let count=0; const tick=()=>{if(++count>=140)resolve();else requestAnimationFrame(tick)};tick()
    }))
    measurements.push({variant,...await page.evaluate(()=>window.__GAME_INSPECTOR__!.getMetrics())})
  }
  for(const view of ['front','rear','rear-three-quarter','side','top','gameplay']) {
    await page.getByRole('button',{name:view,exact:true}).click()
    await page.screenshot({path:info.outputPath(`${view}.png`)})
  }
  await page.getByRole('button',{name:'Collision volume',exact:true}).click()
  await page.screenshot({path:info.outputPath('collision.png')})
  await resume(page); await page.keyboard.down('KeyD')
  await elapsed(page,0.25)
  const moving=await inspect()
  expect(moving.bank).toBeLessThan(-0.1)
  expect(moving.engineIntensity).toBeGreaterThan(rest.engineIntensity)
  const movingState=await state(page)
  const expected=rotatedMuzzles(movingState.player.rotation.x,moving.bank)
  moving.hardpoints.forEach((p,i)=>p!.forEach((v,j)=>expect(v).toBeCloseTo([expected[i].x,expected[i].y,expected[i].z][j],5)))
  await page.keyboard.up('KeyD'); await page.keyboard.down('Space')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().playerProjectileCount>0)
  await page.keyboard.up('Space')
  await writeFile(info.outputPath('review.json'),JSON.stringify({rest,moving,measurements,gameState:await state(page)},null,2))
  await page.evaluate(()=>window.__GAME_INSPECTOR__!.loadScene('basic-flight'))
  expect((await inspect()).active).toBe(false)
  await expect(page.locator('#ui')).toBeVisible()
  expect((await state(page)).camera.mode).toBe('trailing-arcade')
})

test('STRIX runtime muzzles, restarts and gameplay remain aligned',async({page})=>{
  await page.goto('/?testScene=basic-flight&ship=strix')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
  expect((await state(page)).ship.active).toBe('strix')
  await resume(page);await page.keyboard.down('Space')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().playerProjectileCount>=2)
  await page.keyboard.up('Space');await page.keyboard.press('KeyP')
  const s=await state(page)
  expect(s.projectiles[0].position.x).toBeCloseTo(-1.22,4)
  expect(s.projectiles[1].position.x).toBeCloseTo(1.22,4)
  expect(s.projectiles[0].position.y).toBeCloseTo(-1.16,4)
  const baseline=s.drawCalls
  for(let i=0;i<5;i++)await page.evaluate(()=>window.__GAME_INSPECTOR__!.resetScene())
  expect((await state(page)).drawCalls).toBeLessThanOrEqual(baseline)
  expect((await state(page)).ship.active).toBe('strix')
})
