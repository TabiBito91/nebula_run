import {test,expect,state} from './support'
test.use({viewport:{width:844,height:390},hasTouch:true,isMobile:true})

test('first Launch tap starts music and effects on touch devices',async({page})=>{
  await page.goto('/')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
  expect((await state(page)).audio.initialized).toBe(false)
  await page.getByRole('button',{name:/LAUNCH SORTIE/}).tap()
  await expect.poll(async()=> (await state(page)).audio.contextState).toBe('running')
  await expect.poll(async()=> (await state(page)).audio.activeLoops).toContain('music:flight')
  await expect.poll(async()=> (await state(page)).audio.measuredPeak).toBeGreaterThan(0)
  await expect.poll(async()=> (await state(page)).audio.recentEvents.some(e=>e.type==='sound-started' && e.sound==='playerShot')).toBe(true)
})

test('Enable sound recovers after a stalled resume without reloading',async({page},info)=>{
  await page.addInitScript(()=>{
    const original=AudioContext.prototype.resume
    let allowed=false
    // Simulate a browser keeping autoplay resume pending until explicit permission.
    AudioContext.prototype.resume=function(){
      if (allowed) return original.call(this)
      void this.suspend()
      return new Promise<void>(()=>{})
    }
    window.addEventListener('click',e=>{
      if ((e.target as Element).closest('[data-enable]')) allowed=true
    },true)
  })
  await page.goto('/')
  await page.getByRole('button',{name:'More ⋯'}).tap()
  await page.getByRole('button',{name:'Audio',exact:true}).tap()
  const enable=page.getByRole('button',{name:'Enable sound',exact:true})
  await expect(enable).toBeVisible()
  await expect.poll(async()=> (await state(page)).audio.recentEvents.some(e=>e.type==='audio-enable-required')).toBe(true)
  await page.screenshot({path:info.outputPath('enable-sound.png')})
  await enable.tap()
  await expect.poll(async()=> (await state(page)).audio.contextState).toBe('running')
  await expect(enable).toBeHidden()
  await expect.poll(async()=> (await state(page)).audio.recentEvents.some(e=>e.sound==='confirm' && e.type==='sound-started')).toBe(true)
  await expect.poll(async()=> (await state(page)).audio.measuredPeak).toBeGreaterThan(0)
  expect((await state(page)).status).toBe('title')
})
