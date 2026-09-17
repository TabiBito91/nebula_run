import {test,expect} from '@playwright/test'

// Dedicated fault-injection tests: expected asset failures are not ordinary console regressions.
for(const mode of ['invalid','missing','delayed'] as const) {
  test(`ship asset ${mode} preserves playable startup`,async({page})=>{
    const uncaught:string[]=[];page.on('pageerror',e=>uncaught.push(e.message))
    let release: (()=>void)|undefined
    const gate=new Promise<void>(resolve=>{release=resolve})
    await page.route('**/models/strix-9.glb',async route=>{
      if(mode==='delayed'){await gate;await route.continue()}
      else await route.fulfill({status:mode==='missing'?404:200,contentType:'model/gltf-binary',body:'deliberately invalid model'})
    })
    await page.goto('/?ship=strix')
    await page.waitForFunction(()=>Boolean(window.__GAME_INSPECTOR__))
    await page.keyboard.press('Enter')
    await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().missionElapsedTime>.2)
    if(mode==='delayed') {
      const pending=await page.evaluate(()=>window.__GAME_INSPECTOR__!.getState())
      expect(pending.ship.active).toBe('legacy');expect(pending.pendingAssets).toBe(1)
      release!()
      await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().ship.active==='strix')
    } else {
      await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().ship.status==='failed')
      const s=await page.evaluate(()=>window.__GAME_INSPECTOR__!.getState())
      expect(s.ready).toBe(true);expect(s.ship.active).toBe('legacy');expect(s.ship.error).toBeTruthy()
      await page.keyboard.down('Space')
      await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().playerProjectileCount>0)
      await page.keyboard.up('Space')
    }
    expect(uncaught).toEqual([])
  })
}
