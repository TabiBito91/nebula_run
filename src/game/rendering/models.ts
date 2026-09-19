import * as THREE from 'three'
import type { EnemyType } from '../entities/types'

export class Models {
  geometries = {
    box: new THREE.BoxGeometry(1, 1, 1), prism: new THREE.ConeGeometry(1, 2, 4),
    rock: new THREE.IcosahedronGeometry(1, 0), orb: new THREE.IcosahedronGeometry(1, 1),
    ring: new THREE.TorusGeometry(1, 0.035, 6, 48),
    warningRing: new THREE.TorusGeometry(1, 0.065, 4, 32),
    cracks: new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 0)),
  }
  materials = {
    hull: new THREE.MeshStandardMaterial({ color: '#c6e4e4', metalness: 0.65, roughness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: '#172937', metalness: 0.6, roughness: 0.45 }),
    teal: new THREE.MeshBasicMaterial({ color: '#66ffe2' }), amber: new THREE.MeshBasicMaterial({ color: '#ffad64' }),
    purple: new THREE.MeshStandardMaterial({ color: '#8673bc', metalness: 0.65, roughness: 0.5 }),
    rock: new THREE.MeshStandardMaterial({ color: '#696679', flatShading: true, roughness: 0.9 }),
    white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    fractured: new THREE.MeshStandardMaterial({ color: '#bcb6a2', flatShading: true, roughness: 1 }),
    cracks: new THREE.LineBasicMaterial({ color: '#302b28' }),
  }
  mesh(geometry: keyof Models['geometries'], material: keyof Models['materials'], scale: number[], position = [0, 0, 0]) {
    const m = new THREE.Mesh(this.geometries[geometry], this.materials[material])
    m.scale.set(scale[0], scale[1], scale[2]); m.position.set(position[0], position[1], position[2])
    m.userData.originalMaterial = m.material
    return m
  }
  ship() {
    const g = new THREE.Group()
    g.add(this.mesh('box', 'dark', [0.85, 0.48, 2.2]))
    g.add(this.mesh('orb', 'teal', [0.36, 0.24, 0.65], [0, 0.3, -0.3]))
    for (const side of [-1, 1]) {
      const nose = this.mesh('prism', 'hull', [0.34, 1.65, 0.28], [side * 0.52, 0, -1.25])
      nose.rotation.x = -Math.PI / 2; g.add(nose)
      const wing = this.mesh('prism', 'hull', [0.68, 1.2, 0.13], [side * 1.0, 0, 0.35])
      wing.rotation.set(-Math.PI / 2, 0, side * -0.5); g.add(wing)
      g.add(this.mesh('box', 'dark', [0.34, 0.35, 1.2], [side * 1.1, 0, 0.7]))
      g.add(this.mesh('orb', 'teal', [0.22, 0.2, 0.7], [side * 1.1, 0, 1.4]))
      g.add(this.mesh('box', 'teal', [0.06, 0.06, 0.75], [side * 0.55, 0.2, -1.0]))
    }
    return g
  }
  asteroid(radius: number, fractured: boolean) {
    const g = new THREE.Group()
    g.add(this.mesh('rock', fractured ? 'fractured' : 'rock', [1, 0.85, 1]))
    if (fractured) {
      const cracks = new THREE.LineSegments(this.geometries.cracks, this.materials.cracks)
      cracks.scale.set(1.005, 0.855, 1.005); g.add(cracks)
    }
    g.scale.setScalar(radius)
    return g
  }
  enemy(type: EnemyType, patterned = false) {
    const g = new THREE.Group()
    if (type === 'core') {
      g.add(this.mesh('orb', 'dark', [3.6, 3.6, 2.5])); g.add(this.mesh('orb', 'amber', [1.15, 1.15, 2.65]))
      g.add(this.mesh('ring', 'purple', [5, 5, 5]))
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4
        const plate = this.mesh('box', 'purple', [1.5, 2.6, 2], [Math.cos(angle) * 3.7, Math.sin(angle) * 3.7, 0])
        plate.rotation.z = angle; g.add(plate)
        g.add(this.mesh('orb', 'amber', [0.22, 0.22, 0.3], [Math.cos(angle) * 4.6, Math.sin(angle) * 4.6, 1.3]))
      }
    } else {
      g.add(this.mesh('orb', 'dark', [0.8, 0.55, 1.0])); g.add(this.mesh('orb', 'amber', [0.32, 0.22, 0.4], [0, 0, 0.9]))
      for (const side of [-1, 1]) {
        const wing = this.mesh(type === 'gunner' ? 'box' : 'prism', 'purple', [0.7, type === 'sweep' ? 1.7 : 0.9, 0.24], [side * 1.0, 0, 0])
        wing.rotation.z = side * (type === 'sweep' ? 1.0 : 0.4); g.add(wing)
      }
      if (type === 'gunner') g.add(this.mesh('ring', 'amber', [1.2, 1.2, 1.2]))
    }
    if (patterned) {
      const warning = new THREE.Group(); warning.name = 'attack-warning'; warning.visible = false
      warning.add(this.mesh('warningRing', 'amber', [1.8, 1.8, 1], [0, 0, 3]))
      for (let i = -2; i <= 2; i++) warning.add(this.mesh('box', 'amber', [0.2, 0.65, 0.14], [i * 0.8, 2.2, 3]))
      g.add(warning)
    }
    return g
  }
  dispose() {
    Object.values(this.geometries).forEach(g => g.dispose()); Object.values(this.materials).forEach(m => m.dispose())
  }
}
