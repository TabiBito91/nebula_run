import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export class Strix {
  readonly root = new THREE.Group()
  status: 'pending'|'ready'|'failed' = 'pending'
  error: string|null = null
  loadTimeMs = 0
  bytes = 0
  private disposed=false
  private controller=new AbortController()
  constructor() {
    void this.load()
  }
  private async load() {
    const start=performance.now()
    const url=`${import.meta.env.BASE_URL}models/strix-9.glb`
    const timeout=window.setTimeout(()=>this.controller.abort(),10_000)
    try {
      const response=await fetch(url,{signal:this.controller.signal})
      if(!response.ok)throw new Error(`STRIX-9 asset HTTP ${response.status}`)
      const buffer=await response.arrayBuffer();this.bytes=buffer.byteLength
      const gltf=await new GLTFLoader().parseAsync(buffer,new URL('.',new URL(url,location.href)).href)
      if(this.disposed) { this.release(gltf.scene);return }
      const required=['port-projectile-origin','starboard-projectile-origin','port-engine-core','starboard-engine-core','port-aileron','starboard-aileron']
      if(required.some(name=>!gltf.scene.getObjectByName(name))) {
        this.release(gltf.scene);throw new Error('STRIX-9 asset is missing required components')
      }
      this.root.add(gltf.scene);this.status='ready'
    } catch(error) {
      if(this.disposed)return
      this.status='failed';this.error=String(error)
    } finally {clearTimeout(timeout);this.loadTimeMs=performance.now()-start}
  }
  update(pitch:number,bank:number,speed:number) {
    this.root.rotation.set(pitch,0,bank)
    const power=Math.min(1,speed/12)
    const core=this.root.getObjectByName('port-engine-core') as THREE.Mesh|undefined
    if(core)(core.material as THREE.MeshStandardMaterial).emissiveIntensity=2+power*1.4
    for(const [side,sign] of [['port',-1],['starboard',1]] as const) {
      const aileron=this.root.getObjectByName(`${side}-aileron`)
      if(aileron)aileron.rotation.x=bank*sign*.3
    }
  }
  private release(root:THREE.Object3D) {
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
    root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))}})
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
  }
  dispose() {this.disposed=true;this.controller.abort();this.release(this.root)}
}
