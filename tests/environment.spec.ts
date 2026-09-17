import {test,expect,scene,state,resume,elapsed} from './support'

for(const name of ['environment-normal','environment-boost','environment-combat','environment-dense']){
  test(`${name}: ready, bounded, readable and decorative only`,async({page},info)=>{
    await scene(page,name)
    const initial=await state(page),env=initial.environment
    expect(initial.paused).toBe(true)
    expect(env.preset).toBe('relay-graveyard')
    expect(env.gameplayBoost).toBe(false)
    expect(env.boostState).toBe(name==='environment-boost'?'preview':'inactive')
    expect(env.cameraFov).toBe(name==='environment-boost'?60:58)
    expect(env.decorativeCollisionObjects).toBe(0)
    expect(initial.hazardCount).toBe(0)
    expect(env.minimumDecorativeClearance).toBeGreaterThan(13)
    expect(initial.player.shields).toBe(100)
    expect(env.particleCount).toBeLessThanOrEqual(2096)
    expect(env.activeEnvironmentalObjects).toBeLessThanOrEqual(180)
    expect(initial.enemies.length).toBe(name==='environment-combat'?6:0)
    await resume(page)
    if(name==='environment-combat')await page.keyboard.down('Space')
    await elapsed(page,2)
    await page.screenshot({path:info.outputPath(`${name}.png`)})
    const active=await state(page)
    expect(active.environment.distance).toBeGreaterThan(env.distance+30)
    expect(active.environment.minimumDecorativeClearance).toBeGreaterThan(13)
    expect(active.drawCalls).toBeLessThan(130)
    expect(active.triangles).toBeLessThan(16000)
    if(name==='environment-combat')expect(active.recentEvents.some(e=>e.type==='enemy-destroyed')).toBe(true)
    else expect(active.player.shields).toBe(100)
    await page.keyboard.up('Space')
    await info.attach('environment-metrics',{body:JSON.stringify(active),contentType:'application/json'})
  })
}

test('environment freezes on pause, resets deterministically, and preview does not leak',async({page})=>{
  await scene(page,'environment-boost')
  const initial=(await state(page)).environment
  await resume(page);await elapsed(page,.5);await page.keyboard.press('KeyP')
  const frozen=(await state(page)).environment
  await page.evaluate(()=>new Promise<void>(resolve=>{let n=0;const tick=()=>++n===20?resolve():requestAnimationFrame(tick);tick()}))
  expect((await state(page)).environment).toEqual(frozen)
  await page.evaluate(()=>window.__GAME_INSPECTOR__!.resetScene())
  expect((await state(page)).environment).toEqual(initial)
  for(let i=0;i<4;i++){
    await page.evaluate(()=>window.__GAME_INSPECTOR__!.loadScene('environment-dense'))
    expect((await state(page)).environment.activeEnvironmentalObjects).toBeLessThan(180)
    await page.evaluate(()=>window.__GAME_INSPECTOR__!.loadScene('environment-boost'))
    expect((await state(page)).drawCalls).toBeLessThan(35)
  }
  await page.evaluate(()=>window.__GAME_INSPECTOR__!.loadScene('basic-flight'))
  expect((await state(page)).environment.boostState).toBe('inactive')
  expect((await state(page)).environment.cameraFov).toBe(58)
  await resume(page);await page.keyboard.down('KeyD');await elapsed(page,.2);await page.keyboard.up('KeyD')
  const moving=await state(page)
  expect(moving.player.velocity.x).toBe(12)
  expect(moving.environment.lateralSpeed).toBe(12)
})

test('environment distance and silhouettes advance without altering real flight',async({page})=>{
  await scene(page,'environment-normal');await resume(page)
  const first=await state(page)
  await elapsed(page,10)
  const later=await state(page)
  expect(later.environment.distance).toBeGreaterThan(179)
  expect(later.environment.dustSample).not.toEqual(first.environment.dustSample)
  expect(later.environment.starOffset[2]-first.environment.starOffset[2]).toBeLessThan(3)
  expect(later.player.position).toEqual(first.player.position)
  expect(later.player.shields).toBe(100)
  expect(later.recentCollisions).toHaveLength(0)
})
