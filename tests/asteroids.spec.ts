import { test, expect, scene, resume, state } from './support'
import { GameState } from '../src/game/state'
import { spawnHazard, spawnEnemy } from '../src/game/systems/spawning'
import { combat, projectile } from '../src/game/systems/combat'
import { vec } from '../src/game/entities/types'
import { boardVersion, validResult } from '../src/game/leaderboard/rules'

for (const mode of ['relaxed','standard','veteran'] as const) {
  test(`${mode} asteroid durability, single reward and accepted score increment`, () => {
    const s = new GameState(mode); s.status='playing'
    const h = spawnHazard(s, 0, -1, -30, 1.5, 'fractured')
    for (let i=0;i<4;i++) {
      projectile(s,'player',{...h.position},vec(0,0,-95)); combat(s,false)
      expect(h.durability).toBe(3-i)
      expect(s.score).toBe(i===3 ? 40*s.tuning.score : 0)
    }
    combat(s,false)
    expect(s.hazards).toHaveLength(0)
    expect(s.events.filter(e=>e.type==='asteroid-destroyed')).toHaveLength(1)
    expect(s.events.filter(e=>e.type==='score-awarded')).toHaveLength(1)
    expect(validResult({version:boardVersion(mode),callsign:'Rock Pilot',score:s.score,elapsed:60,outcome:'defeat'})).toBe(true)
  })
}
test('solid rock blocks shots; destroyed rock cannot block or hurt the player', () => {
  const s = new GameState(); s.status='playing'
  const solid=spawnHazard(s,0,-1,-20)
  const enemy=spawnEnemy(s,'straight',0,-1,-40)
  for(let i=0;i<10;i++) {
    projectile(s,'player',vec(0,-1,-50),vec(0,0,-95))
    s.projectiles.at(-1)!.previous=vec(0,-1,-10)
    combat(s,false)
  }
  expect(solid.durability).toBeNull(); expect(enemy.health).toBe(4); expect(s.score).toBe(0)
  s.hazards=[]; s.enemies=[]
  const h=spawnHazard(s,0,-1,0,1.5,'fractured'); h.durability=1
  projectile(s,'player',vec(0,-1,0),vec(0,0,-95)); combat(s,false)
  expect(s.player.shields).toBe(100); expect(s.hazards).toHaveLength(0)
  expect(s.projectiles).toHaveLength(0) // Effects never enter collision state.
})
test('intact breakable rocks remain dangerous; passing rocks award nothing', () => {
  const s=new GameState();s.status='playing'
  spawnHazard(s,0,-1,0,1.5,'fractured'); combat(s,false)
  expect(s.player.shields).toBe(80); expect(s.score).toBe(0)
  spawnHazard(s,5,4,9,1.5,'fractured'); combat(s,false)
  expect(s.hazards).toHaveLength(0); expect(s.score).toBe(0)
})
test('simultaneous swept shots reward once and then reach the enemy behind', () => {
  const s=new GameState();s.status='playing'
  spawnHazard(s,0,-1,-20,1.5,'fractured')
  const e=spawnEnemy(s,'straight',0,-1,-40)
  for(let i=0;i<6;i++) {
    projectile(s,'player',vec(0,-1,-60),vec(0,0,-95))
    s.projectiles.at(-1)!.previous=vec(0,-1,-5)
  }
  combat(s,false)
  expect(s.score).toBe(40);expect(e.health).toBe(2)
  expect(s.events.filter(e=>e.type==='asteroid-destroyed')).toHaveLength(1)
})
test('keyboard destroys a cracked rock, awards points, and reset restores it', async({page},info)=>{
  await scene(page,'asteroid-targets'); await resume(page)
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().missionElapsedTime>.15)
  await page.screenshot({path:info.outputPath('asteroids-intact.png')})
  await page.keyboard.down('Space')
  await expect.poll(async()=>(await state(page)).score).toBe(40)
  await page.keyboard.up('Space')
  const s=await state(page)
  expect(s.hazards).toHaveLength(1);expect(s.hazards[0].kind).toBe('solid');expect(s.player.shields).toBe(100)
  expect(s.recentEvents.filter(e=>e.type==='asteroid-destroyed')).toHaveLength(1)
  await page.screenshot({path:info.outputPath('asteroid-destroyed.png')})
  await page.evaluate(()=>window.__GAME_INSPECTOR__!.resetScene())
  expect((await state(page)).score).toBe(0)
  expect((await state(page)).hazards.find(h=>h.kind==='fractured')!.durability).toBe(4)
})
test('mixed field remains bounded and error free',async({page},info)=>{
  await scene(page,'asteroid-field');await resume(page)
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().missionElapsedTime>1)
  await page.screenshot({path:info.outputPath('mixed-field.png')})
  const s=await state(page)
  expect(s.hazards.some(h=>h.kind==='solid')).toBe(true)
  expect(s.hazards.some(h=>h.kind==='fractured')).toBe(true)
  expect(s.hazardCount).toBeLessThanOrEqual(12)
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__!.getState().missionElapsedTime>3)
})
test.describe('touch asteroids',()=>{
  test.use({viewport:{width:844,height:390},isMobile:true,hasTouch:true})
  test('auto-fire destroys an aligned rock',async({page},info)=>{
    await scene(page,'asteroid-targets')
    await page.getByRole('button',{name:/RESUME FLIGHT/}).tap()
    await expect.poll(async()=>(await state(page)).score).toBe(40)
    expect((await state(page)).player.shields).toBe(100)
    await page.screenshot({path:info.outputPath('touch-asteroid.png')})
  })
})
