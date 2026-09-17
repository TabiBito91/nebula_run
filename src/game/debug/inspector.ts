import type { Game } from '../Game'
import { createFixture, SCENES } from '../scenes/fixtures'

export function installInspector(game: Game) {
  const snapshot = () => {
    const s = game.state, target = game.target()
    return structuredClone({
      ready: s.ready, activeScene: s.scene, status: s.status, missionPhase: s.phase.name,
      missionElapsedTime: s.elapsed, missionProgress: s.progress, paused: s.paused, failureReason: s.reason,
      player: { position: s.player.position, rotation: s.player.rotation, velocity: s.player.velocity, shields: s.player.shields, invulnerable: s.player.invulnerable },
      weaponCooldown: s.player.weaponCooldown, score: s.score, currentTarget: target?.id ?? null,
      targetDistance: target ? Math.hypot(target.position.x - s.player.position.x, target.position.y - s.player.position.y, target.position.z) : null,
      enemies: s.enemies.map(e => ({ id: e.id, type: e.type, position: e.position, health: e.health, maxHealth: e.maxHealth, telegraph: e.telegraph })),
      playerProjectileCount: s.projectiles.filter(p => p.owner === 'player').length,
      enemyProjectileCount: s.projectiles.filter(p => p.owner === 'enemy').length,
      hazardCount: s.hazards.length, recentCollisions: s.collisions,
      camera: { position: game.renderer.camera.position.toArray(), mode: 'trailing-arcade' },
      pendingAssets: 0, recentEvents: s.events, capturedErrors: game.errors, ...game.renderer.metrics,
    })
  }
  const loadScene = async (name: string) => {
    const s = createFixture(name)
    game.replace(s)
    await new Promise<void>(resolve => {
      const check = () => { if (s.ready) resolve(); else requestAnimationFrame(check) }
      requestAnimationFrame(check)
    })
  }
  const inspector = {
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
