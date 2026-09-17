import * as THREE from 'three'

/** Approval candidate. Imported only by the development showroom. Forward is -Z. */
export class Interceptor {
  readonly root = new THREE.Group()
  readonly airframe = new THREE.Group()
  readonly mounts = new THREE.Group()
  readonly coreMaterial = new THREE.MeshStandardMaterial({ color: '#eee8ff', emissive: '#a190ff', emissiveIntensity: 2, roughness: 0.35 })
  private geometries: THREE.BufferGeometry[] = []
  private materials: THREE.Material[] = []
  private plumes: THREE.Mesh[] = []
  private hull = new THREE.MeshStandardMaterial({ color: '#93a9b2', metalness: 0.45, roughness: 0.5, flatShading: true })
  private dark = new THREE.MeshStandardMaterial({ color: '#182932', metalness: 0.45, roughness: 0.6 })
  private canopy = new THREE.MeshStandardMaterial({ color: '#173740', emissive: '#0c353b', emissiveIntensity: 0.35, metalness: 0.65, roughness: 0.18, flatShading: true })
  private accent = new THREE.MeshStandardMaterial({ color: '#62eadc', emissive: '#1bd9be', emissiveIntensity: 1.3 })
  private plume = new THREE.MeshBasicMaterial({ color: '#afa0ff', transparent: true, opacity: 0.22, depthWrite: false })
  constructor() {
    this.root.name = 'Manta-7-candidate'; this.airframe.name = 'banking-airframe'; this.mounts.name = 'stabilized-weapon-hardpoints'
    this.root.add(this.airframe, this.mounts)
    this.materials = [this.hull, this.dark, this.canopy, this.accent, this.coreMaterial, this.plume]
    this.panel('central-fuselage', [[0,-2.4],[0.36,-1.35],[0.48,0.65],[0.32,1.1],[-0.32,1.1],[-0.48,0.65],[-0.36,-1.35]], 0.36, this.hull)
    this.panel('cockpit-canopy', [[0,-1.35],[0.23,-0.7],[0.24,0.05],[-0.24,0.05],[-0.23,-0.7]], 0.25, this.canopy, 0.28)
    this.box('dorsal-spine', [0.13,0.12,0.72], [0,0.29,0.55], this.dark)
    for (const sign of [-1,1]) {
      const side = sign < 0 ? 'port' : 'starboard'
      // Clipped swept wing, with an inner trailing notch and low outer fins.
      this.panel(`${side}-swept-wing`, [[sign*0.32,-0.95],[sign*1.52,0.25],[sign*1.48,1.04],[sign*0.93,0.8],[sign*0.7,0.34],[sign*0.32,0.55]], 0.12, this.hull, -0.02)
      this.panel(`${side}-wing-inlay`, [[sign*0.6,-0.4],[sign*1.35,0.36],[sign*1.3,0.62],[sign*0.7,0.1]], 0.025, this.dark, 0.065)
      this.panel(`${side}-navigation-strip`, [[sign*0.76,-0.33],[sign*1.41,0.32],[sign*1.41,0.41],[sign*0.76,-0.23]], 0.015, this.accent, 0.09)
      this.box(`${side}-tip-fin`, [0.075,0.34,0.5], [sign*1.39,0.15,0.64], this.dark)
      this.box(`${side}-fin-light`, [0.08,0.045,0.24], [sign*1.39,0.325,0.68], this.accent)
      this.box(`${side}-engine-housing`, [0.46,0.32,0.9], [sign*0.65,-0.02,0.65], this.dark)
      this.box(`${side}-engine-bezel`, [0.4,0.27,0.09], [sign*0.65,-0.02,1.13], this.accent)
      this.box(`${side}-engine-core`, [0.29,0.16,0.1], [sign*0.65,-0.02,1.19], this.coreMaterial)
      this.plumes.push(this.box(`${side}-engine-plume`, [0.26,0.12,0.4], [sign*0.65,-0.02,1.43], this.plume))
      this.box(`${side}-weapon-rail`, [0.13,0.12,0.65], [sign*0.42,0,-1.15], this.dark, this.mounts)
      this.box(`${side}-weapon-muzzle`, [0.11,0.1,0.05], [sign*0.42,0,-1.475], this.accent, this.mounts)
      const origin = new THREE.Object3D(); origin.name = `${side}-projectile-origin`; origin.position.set(sign*0.42,0,-1.5); this.mounts.add(origin)
    }
  }
  private panel(name: string, points: number[][], thickness: number, material: THREE.Material, y = 0) {
    const shape = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,z)))
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1 })
    geometry.rotateX(Math.PI/2); geometry.translate(0, thickness/2 + y, 0)
    this.geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry,material); mesh.name=name; this.airframe.add(mesh); return mesh
  }
  private box(name: string, size: number[], position: number[], material: THREE.Material, parent = this.airframe) {
    const geometry = new THREE.BoxGeometry(...size as [number,number,number]); this.geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry,material); mesh.name=name; mesh.position.set(...position as [number,number,number]); parent.add(mesh); return mesh
  }
  update(bank: number, pitch: number, movement: number) {
    this.airframe.rotation.set(pitch,0,bank)
    const power = Math.min(1, movement / 12)
    this.coreMaterial.emissiveIntensity = 2 + power*2
    this.plume.opacity = 0.22 + power*0.18
    this.plumes.forEach(mesh => { mesh.scale.z = 1 + power*0.5 })
  }
  dispose() { this.geometries.forEach(g=>g.dispose()); this.materials.forEach(m=>m.dispose()) }
}
