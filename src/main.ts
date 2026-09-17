import './style.css'
import { Game } from './game/Game'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = '<canvas id="game" aria-label="Nebula Run 3D flight view"></canvas><div id="ui"></div>'
try {
  const game = new Game(document.querySelector('#game')!, document.querySelector('#ui')!)
  // Stop the animation loop and release WebGL resources before a navigation or
  // Playwright context closes. Long live-sortie tests otherwise leave the
  // renderer active during browser teardown.
  window.addEventListener('pagehide', () => game.dispose(), { once: true })
  if (import.meta.env.DEV) {
    const { installInspector } = await import('./game/debug/inspector')
    const inspector = installInspector(game)
    const scene = new URLSearchParams(location.search).get('testScene')
    if (scene) {
      try { await inspector.loadScene(scene) }
      catch (error) { game.capture(String(error), 'test-scene'); console.error(error) }
    }
  }
  import.meta.hot?.dispose(() => { game.dispose(); delete window.__GAME_INSPECTOR__ })
} catch (error) {
  console.error(error)
  app.innerHTML = '<div style="padding:48px"><h1>Flight systems unavailable</h1><p>WebGL could not start. Enable browser hardware acceleration and reload.</p></div>'
}
