import {chromium} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const directory=process.argv[2]??'.logs/environment-review/after'
await mkdir(directory,{recursive:true})
const browser=await chromium.launch({args:process.platform==='win32'?['--use-angle=d3d11']:[]})
const page=await browser.newPage({viewport:{width:1280,height:720}})
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`))
const samples=[]
for(const scene of ['basic-flight','enemy-wave','asteroid-field','environment-normal','environment-boost','environment-combat','environment-dense']){
  await page.goto(`http://127.0.0.1:5173/?testScene=${scene}`)
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
  await page.keyboard.press('KeyP')
  if(scene==='environment-combat')await page.keyboard.down('Space')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__.getState().missionElapsedTime>=2)
  await page.screenshot({path:`${directory}/${scene}.png`})
  samples.push(await page.evaluate(()=>window.__GAME_INSPECTOR__.getState()))
  await page.keyboard.up('Space')
}
await writeFile(`${directory}/inspection.json`,JSON.stringify({samples,errors},null,2))
console.log(JSON.stringify({samples:samples.map(s=>({scene:s.activeScene,fps:s.fps,frameTime:s.averageFrameTime,calls:s.drawCalls,triangles:s.triangles,environment:s.environment})),errors}))
await browser.close()
if(errors.length)process.exitCode=1
