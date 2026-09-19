import * as THREE from 'three'
import type { Entity, GameEvent, Metrics } from '../entities/types'
import { GameState } from '../state'
import { Models } from './models'
import { Strix } from './Strix'
import { Environment } from './Environment'
import type { EnvironmentPreset } from './environmentPresets'

export class Renderer {
  /** Optional development review renderer, installed only by the inspector. */
  reviewRender?: (state: GameState) => boolean
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 500)
  readonly webgl: THREE.WebGLRenderer
  readonly models = new Models()
  readonly ship = this.models.ship()
  readonly strix = new Strix()
  shipVariant: 'strix'|'legacy' = new URLSearchParams(location.search).get('ship') === 'legacy' ? 'legacy' : 'strix'
  get activeShip() { return this.shipVariant === 'strix' && this.strix.status === 'ready' ? 'strix' : 'legacy' }
  private meshes = new Map<string, THREE.Object3D>()
  readonly environment: Environment
  private effects: { mesh: THREE.Mesh; life: number; vx: number; vy: number; vz: number }[] = []
  private lastEvent?: GameEvent
  private generation = -1
  private frameTimes: number[] = []
  metrics: Metrics = { fps: 0, averageFrameTime: 0, drawCalls: 0, triangles: 0 }
  reticle = { x: 50, y: 50 }
  constructor(canvas: HTMLCanvasElement, environmentPreset?: EnvironmentPreset) {
    this.environment = new Environment(environmentPreset)
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.webgl.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.webgl.setClearColor('#060b15')
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping; this.webgl.toneMappingExposure = 1.3
    // Keep gameplay fog and ship lighting unchanged; environment materials own their art direction.
    this.scene.fog = new THREE.FogExp2('#0a0d20', 0.0035)
    this.scene.add(new THREE.HemisphereLight('#9ab9ff', '#212335', 2.4))
    const light = new THREE.DirectionalLight('#adeee1', 3); light.position.set(-15, 20, 10); this.scene.add(light)
    const rim = new THREE.DirectionalLight('#be7bff', 3); rim.position.set(15, -2, -35); this.scene.add(rim)
    this.scene.add(this.ship)
    this.scene.add(this.strix.root)
    this.scene.add(this.environment.root)
    for (let i = 0; i < 120; i++) {
      const mesh = this.models.mesh('orb', i % 3 ? 'amber' : 'teal', [0.12, 0.12, 0.12])
      mesh.visible = false; this.scene.add(mesh); this.effects.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0 })
    }
    this.resize(); window.addEventListener('resize', this.resize)
  }
  private resize = () => {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.webgl.setSize(innerWidth, innerHeight)
  }
  private position(mesh: THREE.Object3D, entity: Entity, alpha: number) {
    mesh.position.set(THREE.MathUtils.lerp(entity.previous.x, entity.position.x, alpha), THREE.MathUtils.lerp(entity.previous.y, entity.position.y, alpha), THREE.MathUtils.lerp(entity.previous.z, entity.position.z, alpha))
  }
  private burst(event: GameEvent) {
    if (!['enemy-destroyed', 'asteroid-destroyed'].includes(event.type) || !event.position) return
    const pos = event.position as { x: number; y: number; z: number }
    let count = 0
    for (const p of this.effects) {
      if (p.life > 0) continue
      const angle = count * 2.399
      p.mesh.material = event.type === 'asteroid-destroyed' ? this.models.materials.fractured : p.mesh.userData.originalMaterial
      p.life = 0.8; p.mesh.position.set(pos.x, pos.y, pos.z); p.mesh.visible = true
      p.vx = Math.cos(angle) * 6; p.vy = Math.sin(angle) * 6; p.vz = Math.sin(count * 3.7) * 5
      if (++count === (event.type === 'asteroid-destroyed' ? 10 : 18)) break
    }
  }
  render(s: GameState, alpha: number, wallDt: number, simulatedDt: number) {
    if (this.generation !== s.generation) {
      this.generation = s.generation; this.lastEvent = undefined
      this.meshes.forEach(mesh => this.scene.remove(mesh)); this.meshes.clear()
      this.effects.forEach(p => { p.life = 0; p.mesh.visible = false }); this.camera.position.set(0, 3.5, 19)
    }
    const start = this.lastEvent ? s.events.indexOf(this.lastEvent) + 1 : 0
    s.events.slice(start).forEach(event => this.burst(event)); this.lastEvent = s.events.at(-1)
    this.position(this.ship, s.player, alpha); this.ship.rotation.set(s.player.rotation.x, 0, s.player.rotation.z)
    this.ship.visible = s.player.invulnerable <= 0 || Math.floor(s.elapsed * 14) % 2 === 0
    this.position(this.strix.root,s.player,alpha)
    this.strix.update(s.player.rotation.x,s.player.rotation.z,Math.hypot(s.player.velocity.x,s.player.velocity.y))
    this.strix.root.visible = this.ship.visible && this.activeShip === 'strix'
    this.ship.visible = this.ship.visible && this.activeShip === 'legacy'
    this.camera.position.x += (s.player.position.x * 0.13 - this.camera.position.x) * Math.min(1, wallDt * 4)
    this.camera.position.y += (3.5 + s.player.position.y * 0.08 - this.camera.position.y) * Math.min(1, wallDt * 4)
    this.camera.lookAt(0, 0, -45)
    this.environment.update(s.elapsed,s.scene,s.player)
    if(this.camera.fov!==this.environment.cameraFov){this.camera.fov=this.environment.cameraFov;this.camera.updateProjectionMatrix()}
    const active = new Set<string>()
    for (const entity of [...s.enemies, ...s.hazards, ...s.projectiles]) {
      active.add(entity.id)
      let mesh = this.meshes.get(entity.id)
      if (!mesh) {
        if ('type' in entity) mesh = this.models.enemy(entity.type, !!entity.attack)
        else if ('owner' in entity) mesh = this.models.mesh('box', entity.owner === 'player' ? 'teal' : 'amber', entity.owner === 'player' ? [0.09, 0.09, 2.1] : [0.3, 0.3, 1.1])
        else mesh = this.models.asteroid(entity.radius, entity.kind === 'fractured')
        this.meshes.set(entity.id, mesh); this.scene.add(mesh)
      }
      this.position(mesh, entity, alpha)
      if ('angle' in entity) {
        mesh.rotation.set(entity.angle, entity.angle * 0.7, 0)
        mesh.traverse(child => { if (child instanceof THREE.Mesh) child.material = entity.flash > 0 ? this.models.materials.white : child.userData.originalMaterial })
      }
      if ('type' in entity) {
        mesh.rotation.z = entity.type === 'core' ? entity.age * 0.13 : Math.sin(entity.age * 2) * 0.12
        mesh.scale.setScalar(entity.telegraph ? 1 + Math.sin(s.elapsed * 24) * 0.06 : 1)
        const warning = mesh.getObjectByName('attack-warning')
        if (warning && entity.attack) {
          const pattern = entity.attack.sequence[entity.attack.index % entity.attack.sequence.length]
          warning.visible = entity.telegraph
          warning.rotation.z = -mesh.rotation.z
          warning.scale.setScalar(entity.type === 'core' ? 2.4 : 1)
          warning.children[0].visible = pattern === 'burst'
          warning.children.slice(1).forEach((tick, i) => {
            tick.visible = pattern !== 'burst'
            tick.rotation.z = pattern === 'fan' ? (i - 2) * -0.25 : Math.PI / 2
          })
        }
        mesh.traverse(child => { if (child instanceof THREE.Mesh) child.material = entity.flash > 0 ? this.models.materials.white : child.userData.originalMaterial })
      }
    }
    for (const [id, mesh] of this.meshes) if (!active.has(id)) { this.scene.remove(mesh); this.meshes.delete(id) }
    for (const p of this.effects) {
      p.life = Math.max(0, p.life - simulatedDt); p.mesh.visible = p.life > 0
      if (p.life > 0) {
        p.mesh.position.x += p.vx * simulatedDt; p.mesh.position.y += p.vy * simulatedDt; p.mesh.position.z += p.vz * simulatedDt
        p.mesh.scale.setScalar(0.2 * p.life)
      }
    }
    if (!this.reviewRender?.(s)) this.webgl.render(this.scene, this.camera)
    const aim = new THREE.Vector3(s.player.position.x, s.player.position.y, -45).project(this.camera)
    this.reticle = { x: (aim.x * 0.5 + 0.5) * 100, y: (-aim.y * 0.5 + 0.5) * 100 }
    if (wallDt > 0 && wallDt < 0.25) this.frameTimes.push(wallDt * 1000)
    if (this.frameTimes.length > 120) this.frameTimes.shift()
    const average = this.frameTimes.reduce((a, b) => a + b, 0) / (this.frameTimes.length || 1)
    this.metrics = { fps: average ? Math.round(1000 / average) : 0, averageFrameTime: Number(average.toFixed(2)), drawCalls: this.webgl.info.render.calls, triangles: this.webgl.info.render.triangles }
  }
  dispose() {
    this.environment.dispose()
    this.strix.dispose()
    this.strix.root.removeFromParent()
    window.removeEventListener('resize', this.resize)
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry)
        const values = Array.isArray(object.material) ? object.material : [object.material]
        values.forEach(material => materials.add(material))
      }
    })
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); this.models.dispose(); this.webgl.dispose()
  }
}
