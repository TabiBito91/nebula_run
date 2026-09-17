import * as THREE from 'three'
import type { Game } from '../Game'
import { Strix } from '../rendering/Strix'

const VIEWS = { front:[0,0,-8], rear: [0,0,8], 'rear-three-quarter': [5,3,6], side: [8,0,0], top: [0,8,0.001], gameplay: [0,3.5,19] } as const
export class ShipShowcase {
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38,1,0.1,100)
  private orthographic = new THREE.OrthographicCamera(-6.6,6.6,3.7,-3.7,.1,100)
  private candidate: Strix
  private legacy: THREE.Group
  private collision: THREE.Mesh
  private panel = document.createElement('section')
  private ui = document.querySelector<HTMLElement>('#ui')!
  private view: keyof typeof VIEWS = 'rear-three-quarter'
  private variant: 'candidate' | 'legacy' = 'candidate'
  private active = false
  private game: Game
  constructor(game: Game) {
    this.candidate=game.renderer.strix
    this.game = game; this.legacy = game.renderer.models.ship(); this.legacy.name = 'legacy-ship'
    this.scene.background = new THREE.Color('#e7e9ee')
    this.scene.add(new THREE.HemisphereLight('#ffffff','#707070',1.2))
    const key = new THREE.DirectionalLight('#ffffff',1.6); key.position.set(-3,5,5); this.scene.add(key)
    const fill = new THREE.DirectionalLight('#ffffff',.7); fill.position.set(4,2,-4); this.scene.add(fill)
    this.scene.add(this.legacy)
    this.collision = new THREE.Mesh(new THREE.SphereGeometry(0.65,16,12),new THREE.MeshBasicMaterial({color:'#ffbf69',wireframe:true,transparent:true,opacity:0.6,depthTest:false}))
    this.collision.name = 'unchanged-player-collision-sphere'; this.collision.visible=false; this.scene.add(this.collision)
    this.panel.style.cssText='position:fixed;inset:0;pointer-events:none;color:#27363d;font:12px monospace;padding:24px;z-index:10'
    this.panel.innerHTML = `<div style="letter-spacing:3px;color:#167e77">NEBULA RUN / DESIGN REVIEW</div><h1 style="font:26px sans-serif;margin:8px 0">STRIX—9</h1><nav style="pointer-events:auto;display:flex;gap:8px;flex-wrap:wrap">${Object.keys(VIEWS).map(v=>`<button data-view="${v}">${v}</button>`).join('')}<button data-variant="candidate">STRIX-9</button><button data-variant="legacy">Old ship</button><button data-collision>Collision volume</button></nav><p id="ship-review-label"></p><footer style="position:absolute;bottom:24px">Neutral lighting · P: resume/pause · WASD: bank + engine response · Space: fire (simulation)</footer>`
    this.panel.querySelectorAll('button').forEach(button=>{button.style.cssText='padding:9px 12px;background:#303d46;border:1px solid #5a747f;color:#deeeed;cursor:pointer';button.addEventListener('click',()=>{
      if(button.dataset.view) this.setView(button.dataset.view)
      if(button.dataset.variant) this.setVariant(button.dataset.variant)
      if(button.hasAttribute('data-collision'))this.collision.visible=!this.collision.visible
      button.blur()
    })})
    this.panel.hidden=true; document.body.append(this.panel)
    game.renderer.reviewRender = (s) => {
      this.active = s.scene === 'ship-showcase'; this.panel.hidden = !this.active; this.ui.hidden = this.active
      if(!this.active){
        if(this.candidate.root.parent===this.scene)game.renderer.scene.add(this.candidate.root)
        return false
      }
      game.renderer.shipVariant=this.variant==='candidate'?'strix':'legacy'
      if(this.candidate.root.parent!==this.scene)this.scene.add(this.candidate.root)
      this.candidate.root.position.set(0,0,0)
      this.candidate.root.visible = this.variant === 'candidate'; this.legacy.visible = this.variant === 'legacy'
      this.candidate.update(s.player.rotation.x,s.player.rotation.z,Math.hypot(s.player.velocity.x,s.player.velocity.y))
      this.legacy.rotation.set(s.player.rotation.x,0,s.player.rotation.z)
      this.camera.aspect=innerWidth/innerHeight; this.camera.fov=this.view==='gameplay'?58:38
      const [x,y,z] = VIEWS[this.view]
      this.camera.position.set(x,y,z); this.camera.up.set(0,1,0)
      if(this.view==='gameplay')this.camera.lookAt(0,1,-45);else this.camera.lookAt(0,0,-0.25)
      this.camera.updateProjectionMatrix()
      this.panel.querySelector('#ship-review-label')!.textContent=`${this.variant.toUpperCase()} / ${this.view.toUpperCase()} / ${s.paused?'PAUSED':'LIVE INPUT'}`
      const ortho=['front','side','top','rear'].includes(this.view)
      this.orthographic.left=-3.7*innerWidth/innerHeight;this.orthographic.right=3.7*innerWidth/innerHeight
      this.orthographic.position.set(x,y,z);this.orthographic.up.set(0,this.view==='top'?0:1,this.view==='top'?1:0)
      this.orthographic.lookAt(0,0,0);this.orthographic.updateProjectionMatrix()
      game.renderer.webgl.render(this.scene,ortho?this.orthographic:this.camera);return true
    }
  }
  setView(view: string) { if(!(view in VIEWS))throw new Error(`Unknown ship view: ${view}`);this.view=view as keyof typeof VIEWS }
  setVariant(variant: string) { if(variant!=='candidate'&&variant!=='legacy')throw new Error(`Unknown ship variant: ${variant}`);this.variant=variant }
  inspect() {
    const dimensions = (root: THREE.Object3D) => {
      const box=new THREE.Box3().setFromObject(root)
      return { min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray() }
    }
    this.candidate.root.updateMatrixWorld(true)
    return { active:this.active,view:this.view,variant:this.variant,candidateBounds:dimensions(this.candidate.root),legacyBounds:dimensions(this.legacy),
      collision:{radius:this.game.state.player.radius,center:[0,0,0],volume:4/3*Math.PI*this.game.state.player.radius**3},
      hardpoints:['port','starboard'].map(side=>this.candidate.root.getObjectByName(`${side}-projectile-origin`)?.getWorldPosition(new THREE.Vector3()).toArray()??null),
      engines:['port','starboard'].map(side=>this.candidate.root.getObjectByName(`${side}-engine-center`)?.position.toArray()??null),
      components:(()=>{const names:string[]=[];this.candidate.root.traverse(o=>{if(o.name)names.push(o.name)});return names})(),
      bank:this.candidate.root.rotation.z,engineIntensity:((this.candidate.root.getObjectByName('port-engine-core') as THREE.Mesh|undefined)?.material as THREE.MeshStandardMaterial|undefined)?.emissiveIntensity??0,
      camera:{position:this.camera.position.toArray(),mode:'ship-showcase',view:this.view,projection:['front','rear','top','side'].includes(this.view)?'orthographic':'perspective'},
    }
  }
  dispose() {
    this.game.renderer.reviewRender=undefined;this.panel.remove();this.ui.hidden=false
    this.game.renderer.scene.add(this.candidate.root)
    this.collision.geometry.dispose();(this.collision.material as THREE.Material).dispose()
  }
}
