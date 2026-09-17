import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const directory=process.argv[2]??'.logs/strix-review/final'
await mkdir(directory,{recursive:true})
const browser=await chromium.launch({args:process.platform==='win32'?['--use-angle=d3d11']:[]})
const page=await browser.newPage({viewport:{width:1280,height:720}})
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
const frames=()=>page.evaluate(()=>new Promise(resolve=>{let n=0;const tick=()=>++n>140?resolve():requestAnimationFrame(tick);tick()}))
await page.goto('http://127.0.0.1:5173/?testScene=ship-showcase&ship=strix')
await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
const metrics=[]
for(const variant of ['legacy','candidate']) {
  await page.evaluate(v=>window.__GAME_INSPECTOR__.setShipVariant(v),variant);await frames()
  metrics.push({variant,state:await page.evaluate(()=>window.__GAME_INSPECTOR__.getState())})
}
for(const view of ['front','side','top','rear','rear-three-quarter','gameplay']) {
  await page.evaluate(v=>window.__GAME_INSPECTOR__.setShipView(v),view)
  await page.evaluate(()=>new Promise(requestAnimationFrame))
  await page.screenshot({path:`${directory}/${view}.png`})
}
const review=await page.evaluate(()=>window.__GAME_INSPECTOR__.getShipReview())
await page.evaluate(()=>window.__GAME_INSPECTOR__.loadScene('basic-flight'))
await page.evaluate(()=>window.__GAME_INSPECTOR__.resume());await frames()
await page.screenshot({path:`${directory}/empty-flight.png`})
const gameplay=await page.evaluate(()=>window.__GAME_INSPECTOR__.getState())
await page.evaluate(()=>window.__GAME_INSPECTOR__.loadScene('mission-start'))
await page.keyboard.press('KeyP');await page.keyboard.down('Space');await frames()
await page.screenshot({path:`${directory}/normal-gameplay.png`});await page.keyboard.up('Space')
const sortie=await page.evaluate(()=>window.__GAME_INSPECTOR__.getState())
await writeFile(`${directory}/inspection.json`,JSON.stringify({review,metrics,gameplay,sortie,errors},null,2))
console.log(JSON.stringify({review,metrics:metrics.map(m=>({variant:m.variant,fps:m.state.fps,frame:m.state.averageFrameTime,calls:m.state.drawCalls,triangles:m.state.triangles})),ship:gameplay.ship,gameplayMetrics:{fps:gameplay.fps,calls:gameplay.drawCalls,triangles:gameplay.triangles},errors}))
await browser.close()
