import type { Game } from '../Game'
import { createFixture, SCENES } from '../scenes/fixtures'
import { ShipShowcase } from './ShipShowcase'
import { installAudioFixtures, createAudioRecorder } from './AudioFixtures'

export function installInspector(game: Game) {
  installAudioFixtures(game.audio)
  const audioRecorder = createAudioRecorder(game.audio)
  const showcase = new ShipShowcase(game)
  const originalDispose = game.dispose.bind(game)
  game.dispose = () => { audioRecorder.dispose(); showcase.dispose(); originalDispose() }
  const snapshot = () => {
    const s = game.state, target = game.target()
    return structuredClone({
      ready: s.ready, activeScene: s.scene, status: s.status, missionPhase: s.phase.name,
      graphicsState: game.graphicsState, previousFlightDiagnostic: game.diagnostics.previous,
      audio: game.audio.manager.inspect(),
      leaderboard: game.leaderboard.inspect(),
      missionElapsedTime: s.elapsed, missionProgress: s.progress, paused: s.paused, failureReason: s.reason,
      player: { position: s.player.position, rotation: s.player.rotation, velocity: s.player.velocity, shields: s.player.shields, invulnerable: s.player.invulnerable },
      weaponCooldown: s.player.weaponCooldown, score: s.score, currentTarget: target?.id ?? null,
      targetDistance: target ? Math.hypot(target.position.x - s.player.position.x, target.position.y - s.player.position.y, target.position.z) : null,
      enemies: s.enemies.map(e => ({ id: e.id, type: e.type, position: e.position, health: e.health, maxHealth: e.maxHealth, telegraph: e.telegraph })),
      playerProjectileCount: s.projectiles.filter(p => p.owner === 'player').length,
      enemyProjectileCount: s.projectiles.filter(p => p.owner === 'enemy').length,
      hazardCount: s.hazards.length, recentCollisions: s.collisions,
      environment:game.renderer.environment.inspect(),
      camera: s.scene === 'ship-showcase' ? showcase.inspect().camera : { position: game.renderer.camera.position.toArray(), mode: 'trailing-arcade' },
      ship: { selected:game.renderer.shipVariant,active:game.renderer.activeShip,status:game.renderer.strix.status,error:game.renderer.strix.error,loadTimeMs:game.renderer.strix.loadTimeMs,bytes:game.renderer.strix.bytes,textures:0 },
      projectiles: s.projectiles.map(p=>({id:p.id,owner:p.owner,position:p.position,previous:p.previous})),
      pendingAssets: game.renderer.strix.status==='pending'?1:0, recentEvents: s.events, capturedErrors: game.errors, ...game.renderer.metrics,
    })
  }
  const loadScene = async (name: string) => {
    const s = createFixture(name)
    game.renderer.environment.setPreview(name.startsWith('environment-')?{scene:name,speedMultiplier:name==='environment-boost'?2.4:1,density:name==='environment-dense'?1:undefined,offset:name==='environment-dense'?38:0}:null)
    game.replace(s)
    await new Promise<void>(resolve => {
      const check = () => { if (s.ready) resolve(); else requestAnimationFrame(check) }
      requestAnimationFrame(check)
    })
  }
  const inspector = {
    startAudioCapture: () => audioRecorder.start(), stopAudioCapture: () => audioRecorder.stop(),
    testMissingAudio: () => game.audio.manager.load('music:flight', 'audio/__missing-test__.wav'),
    getShipReview: () => showcase.inspect(),
    setShipView: (view: string) => showcase.setView(view),
    setShipVariant: (variant: string) => showcase.setVariant(variant),
    getState: snapshot, listScenes: () => [...SCENES], loadScene,
    resetScene: () => loadScene(game.state.scene),
    getRecentEvents: () => structuredClone(game.state.events), clearRecentEvents: () => { game.state.events = [] },
    getErrors: () => structuredClone(game.errors), getMetrics: () => ({ ...game.renderer.metrics }),
    pause: () => game.pause(), resume: () => game.resume(),
  }
  window.__GAME_INSPECTOR__ = inspector
  return inspector
}
export type GameInspector = ReturnType<typeof installInspector>
export type Snapshot = ReturnType<GameInspector['getState']>
