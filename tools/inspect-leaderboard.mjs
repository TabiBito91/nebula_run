import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const out='.logs/leaderboard-review'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({args:process.platform==='win32'?['--use-angle=d3d11']:[]})
const page=await browser.newPage({viewport:{width:1280,height:720}})
const errors=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
try {
  await page.goto('http://127.0.0.1:5173/')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__?.getState().ready)
  await page.screenshot({path:`${out}/main-menu.png`})
  await page.getByRole('button',{name:'Leaderboard',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Online scores'}).waitFor()
  await page.screenshot({path:`${out}/online-board.png`})
  await page.getByRole('button',{name:'On this device'}).click()
  await page.screenshot({path:`${out}/local-board.png`})
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:/LAUNCH SORTIE/}).click()
  await page.keyboard.down('Space')
  await page.waitForFunction(()=>window.__GAME_INSPECTOR__.getState().missionElapsedTime>3)
  await page.keyboard.up('Space')
  const state=await page.evaluate(()=>window.__GAME_INSPECTOR__.getState())
  await page.screenshot({path:`${out}/flight.png`})
  await writeFile(`${out}/inspection.json`,JSON.stringify({state,errors},null,2))
  console.log(JSON.stringify({fps:state.fps,drawCalls:state.drawCalls,triangles:state.triangles,leaderboard:state.leaderboard,errors}))
} finally {await browser.close()}
