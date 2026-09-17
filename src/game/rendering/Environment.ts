import * as T from 'three'
import {RELAY_GRAVEYARD,type EnvironmentPreset,type EnvironmentPreview} from './environmentPresets'

const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)}
const LIMITS={stars:2000,dust:96,rocks:56,debris:32,structureParts:72}
const vertex=`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`

/** A render-only, deterministic distance field. Pooled scenery never enters simulation collections. */
export class Environment {
  readonly root=new T.Group()
  readonly preset:EnvironmentPreset
  readonly fog:T.FogExp2
  private preview:EnvironmentPreview|null=null
  private stars:T.Points
  private starBase:Float32Array
  private dust:T.LineSegments
  private dustPositions=new Float32Array(LIMITS.dust*6)
  private rocks:T.InstancedMesh
  private debris:T.InstancedMesh
  private structures:T.InstancedMesh
  private trims:T.InstancedMesh
  private nebula:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>
  private planet:T.Mesh
  private ring:T.Mesh|null=null
  private dummy=new T.Object3D()
  private distance=0
  private activeObjects=0
  private speed=18
  private boost=false
  private region='Approach'
  private density=.7
  private movingSpeed=0
  private minimumClearance=Infinity
  constructor(preset:EnvironmentPreset=RELAY_GRAVEYARD) {
    this.preset=preset;this.fog=new T.FogExp2(preset.fog.color,preset.fog.density)
    this.root.name='layered-environment'
    this.nebula=new T.Mesh(new T.PlaneGeometry(1050,650),new T.ShaderMaterial({
      depthWrite:false,depthTest:false,vertexShader:vertex,
      uniforms:{base:{value:new T.Color(preset.background)},a:{value:new T.Color(preset.nebula[0])},b:{value:new T.Color(preset.nebula[1])},travel:{value:0},drift:{value:new T.Vector2()}},
      fragmentShader:`varying vec2 vUv;uniform vec3 base,a,b;uniform float travel;uniform vec2 drift;
      void main(){vec2 p=vUv+drift+vec2(travel*.000008,0);
      // Smooth domain-warped waves avoid visible lattice cells on low-end shader backends.
      float cloud=.48+.20*sin(p.x*17.+sin(p.y*11.))+.13*sin(p.y*23.-p.x*7.)+.06*sin(p.x*51.+p.y*29.);
      float band=exp(-pow((p.y-.60-(p.x-.5)*.35)*5.,2.));
      float clearLane=smoothstep(.05,.36,distance(vUv,vec2(.5,.45)));
      vec3 color=base+mix(a,b,smoothstep(.25,.85,p.x))*pow(cloud,2.)*band*(.15+1.3*clearLane);
      gl_FragColor=vec4(color,1.); #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`.replace(' #include','\n#include'),
    }))
    this.nebula.position.z=-440;this.nebula.renderOrder=-100;this.root.add(this.nebula)
    this.starBase=new Float32Array(LIMITS.stars*3)
    const colors=new Float32Array(LIMITS.stars*3),base=new T.Color(preset.starColor)
    for(let i=0;i<LIMITS.stars;i++){
      this.starBase.set([(hash(i*3)-.5)*950,(hash(i*3+1)-.5)*540,-260-hash(i*3+2)*170],i*3)
      const c=base.clone().multiplyScalar(.18+hash(i+500)*.65);colors.set(c.toArray(),i*3)
    }
    const starsGeometry=new T.BufferGeometry();starsGeometry.setAttribute('position',new T.BufferAttribute(this.starBase.slice(),3));starsGeometry.setAttribute('color',new T.BufferAttribute(colors,3))
    starsGeometry.setDrawRange(0,Math.min(LIMITS.stars,preset.starCount))
    this.stars=new T.Points(starsGeometry,new T.PointsMaterial({vertexColors:true,size:.45,sizeAttenuation:true,depthWrite:false,fog:false}));this.root.add(this.stars)
    const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(this.dustPositions,3).setUsage(T.DynamicDrawUsage))
    this.dust=new T.LineSegments(dustGeometry,new T.LineBasicMaterial({color:'#59677b',transparent:true,opacity:.22,depthWrite:false}));this.dust.frustumCulled=false;this.root.add(this.dust)
    const make=(geometry:T.BufferGeometry,color:string,count:number)=>{
      geometry.computeBoundingBox()
      const material=new T.MeshBasicMaterial({color})
      // Local fog treatment without changing ship, enemies, projectiles, or their lighting.
      material.onBeforeCompile=shader=>{
        shader.uniforms.environmentFogColor={value:this.fog.color}
        shader.uniforms.environmentFogDensity={value:this.fog.density}
        shader.vertexShader='varying vec3 vEnvironmentNormal;\n'+shader.vertexShader
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEnvironmentNormal=normalize(mat3(instanceMatrix)*normal);')
        shader.fragmentShader='varying vec3 vEnvironmentNormal;uniform vec3 environmentFogColor;uniform float environmentFogDensity;\n'+shader.fragmentShader
        shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','float facet=.48+.52*max(0.,dot(normalize(vEnvironmentNormal),normalize(vec3(-.5,.9,.6)))); gl_FragColor.rgb*=facet; float environmentFog = 1.0-exp(-environmentFogDensity*environmentFogDensity*vFogDepth*vFogDepth); gl_FragColor.rgb=mix(gl_FragColor.rgb,environmentFogColor,environmentFog);')
      }
      const mesh=new T.InstancedMesh(geometry,material,count)
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;this.root.add(mesh);return mesh
    }
    this.rocks=make(new T.IcosahedronGeometry(1,0),preset.rock,LIMITS.rocks)
    this.debris=make(new T.BoxGeometry(1,1,1),preset.metal,LIMITS.debris)
    this.structures=make(new T.BoxGeometry(1,1,1),preset.metal,LIMITS.structureParts)
    this.trims=make(new T.BoxGeometry(1,1,1),preset.trim,18)
    const planetMaterial=new T.ShaderMaterial({uniforms:{color:{value:new T.Color(preset.planet.color)},light:{value:new T.Color(preset.lightColor)}},
      vertexShader:`varying vec3 vN;varying vec3 vP;void main(){vN=normal;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 vN;varying vec3 vP;uniform vec3 color,light;void main(){float d=max(0.,dot(normalize(vN),normalize(vec3(-1.,.5,.6))));float bands=.91+.09*sin(vP.y*31.+sin(vP.x*18.));vec3 c=color*(.09+pow(d,1.7)*bands)+light*pow(1.-abs(vN.z),5.)*.055;gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`})
    this.planet=new T.Mesh(new T.SphereGeometry(1,32,20),planetMaterial);this.planet.scale.setScalar(preset.planet.radius);this.root.add(this.planet)
    if(preset.planet.ring){this.ring=new T.Mesh(new T.RingGeometry(preset.planet.radius*1.32,preset.planet.radius*1.35,96),new T.MeshBasicMaterial({color:'#334258',side:T.DoubleSide}));this.ring.rotation.set(1.2,.25,-.28);this.root.add(this.ring)}
  }
  setPreview(value:EnvironmentPreview|null) {this.preview=value}
  private put(mesh:T.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,ry=0,rz=0){
    this.dummy.position.set(x,y,z);this.dummy.scale.set(sx,sy,sz);this.dummy.rotation.set(rx,ry,rz);this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix)
    const bounds=mesh.geometry.boundingBox!,m=this.dummy.matrix.elements
    const extent=Math.abs(m[0])*(bounds.max.x-bounds.min.x)/2+Math.abs(m[4])*(bounds.max.y-bounds.min.y)/2+Math.abs(m[8])*(bounds.max.z-bounds.min.z)/2
    this.minimumClearance=Math.min(this.minimumClearance,Math.abs(x)-extent)
  }
  update(time:number,scene:string,player:{position:{x:number;y:number};velocity:{x:number;y:number}}){
    const preview=this.preview?.scene===scene?this.preview:null
    this.minimumClearance=Infinity
    this.boost=(preview?.speedMultiplier??1)>1;this.speed=this.preset.routeSpeed*(preview?.speedMultiplier??1)
    this.movingSpeed=Math.hypot(player.velocity.x,player.velocity.y)
    this.distance=(time+(preview?.offset??0))*this.speed
    const progress=Math.min(1,this.distance/2400)
    this.region=progress<.3?'Approach':progress<.7?'Fractured array':'Outer wake'
    this.density=Math.min(1,Math.max(.1,preview?.density??this.preset.objectDensity*(.65+.35*Math.sin(progress*Math.PI))))
    this.nebula.material.uniforms.travel.value=this.distance
    this.nebula.material.uniforms.drift.value.set(-player.position.x*.0001,-player.position.y*.0001)
    this.stars.position.set(-player.position.x*.035,-player.position.y*.025,this.distance*.012)
    const [px,py,pz]=this.preset.planet.position
    this.planet.position.set(px-this.distance*.009,py-this.distance*.002,pz+this.distance*.004)
    this.ring?.position.copy(this.planet.position)
    // Distance-keyed chunks change their layout on each pass instead of recycling a visible gate pattern.
    const rockChunk=Math.floor(this.distance/70),debrisChunk=Math.floor(this.distance/45)
    const rockCount=Math.floor(LIMITS.rocks*this.density)
    for(let i=0;i<rockCount;i++){
      const row=rockChunk+Math.floor(i/7),key=row*71+i%7,sign=i%7%2?1:-1,r=2+hash(key+2)*5
      this.put(this.rocks,i,sign*(38+hash(key)*140), (hash(key+1)-.5)*95,this.distance-row*70,r,r*(.7+hash(key+3)),r,hash(key+4)*3,hash(key+5)*5)
    }
    this.rocks.count=rockCount;this.rocks.instanceMatrix.needsUpdate=true
    const debrisCount=Math.floor(LIMITS.debris*this.density)
    for(let i=0;i<debrisCount;i++){
      const row=debrisChunk+Math.floor(i/4),key=row*53+i%4,sign=i%2?1:-1
      this.put(this.debris,i,sign*(22+hash(key)*28),(hash(key+1)-.5)*38,this.distance-row*45, .4+hash(key+2)*1.2,.2,2+hash(key+3)*3,time*.10+hash(key+5)*3,hash(key+6)*4,hash(key+7)*3)
    }
    this.debris.count=debrisCount;this.debris.instanceMatrix.needsUpdate=true
    // Three differently oriented authored installations, followed by quiet deep space.
    let parts=0,trim=0,landmarks=0
    for(const landmark of this.preset.landmarks.slice(0,3)){
      const z=this.distance-landmark.distance;if(z>55||z< -430)continue
      landmarks++
      const sign=landmark.side,center=sign*Math.max(70,landmark.x),height=landmark.y
      if(landmark.kind==='array')for(let j=0;j<12;j++){
        const angle=-1.4+j*.19,x=center+Math.cos(angle)*sign*34,y=height+Math.sin(angle)*38
        if(j!==5)this.put(this.structures,parts++,x,y,z+j*.8,2.5,8,3,0,.12,sign*angle)
        if(j%3===0){this.put(this.structures,parts++,x+sign*9,y,z+j*.8,18,.7,1.3,0,0,sign*.15);this.put(this.trims,trim++,x,y,z+j*.8+1.6,.4,4,.12)}
      }
      if(landmark.kind==='dock')for(let j=0;j<4;j++){
        this.put(this.structures,parts++,center+sign*(j*9-12),height+16-j*3,z,1.8,28-j*3,4,0,0,.08*sign)
        this.put(this.structures,parts++,center+sign*4,height+26-j*9,z-3,38,1.4,4)
        this.put(this.trims,trim++,center+sign*(j*9-12),height+19-j*3,z+2.1,.3,7,.1)
      }
      if(landmark.kind==='spars')for(let j=0;j<5;j++){
        this.put(this.structures,parts++,center+sign*j*6,height+j*5,z-j*7,2,24,3,0,.5,.4*sign)
        this.put(this.structures,parts++,center+sign*j*6,height+j*5-8,z-j*7,18,.8,2,0,.5,.4*sign)
        this.put(this.trims,trim++,center+sign*j*6,height+j*5,z-j*7+1.7,.3,5,.1)
      }
      this.put(this.structures,parts++,center,height-8,z-7,7,30,10,0,.16,.12*sign)
      this.put(this.structures,parts++,center+sign*13,height-12,z-7,20,1,12,0,.16,.12*sign)
    }
    this.structures.count=parts;this.trims.count=trim;this.structures.instanceMatrix.needsUpdate=true;this.trims.instanceMatrix.needsUpdate=true
    const dustCount=Math.min(LIMITS.dust,this.preset.dustCount)
    const speedResponse=Math.min(1,Math.max(0,(this.speed/this.preset.routeSpeed-1)/1.4))
    for(let i=0;i<dustCount;i++){
      const cycle=Math.floor((this.distance+hash(i)*180)/180),key=i+cycle*179
      const z=-165+(this.distance+hash(i)*180)%180,x=(i%2?1:-1)*(19+hash(key+1)*75),y=(hash(key+2)-.5)*80
      this.dustPositions.set([x,y,z,x,y,z+1.2+speedResponse*4.3],i*6)
    }
    this.dust.geometry.setDrawRange(0,dustCount*2);this.dust.geometry.attributes.position.needsUpdate=true
    ;(this.dust.material as T.LineBasicMaterial).opacity=.18+speedResponse*.17
    this.activeObjects=rockCount+debrisCount+parts+trim+landmarks+1
  }
  inspect(){return {preset:this.preset.id,region:this.region,distance:this.distance,playerSpeed:Math.hypot(this.speed,this.movingSpeed),forwardPresentationSpeed:this.speed,lateralSpeed:this.movingSpeed,boostState:this.boost?'preview':'inactive',gameplayBoost:false,particleCount:Math.min(LIMITS.stars,this.preset.starCount)+Math.min(LIMITS.dust,this.preset.dustCount),activeEnvironmentalObjects:this.activeObjects,density:this.density,poolLimits:{...LIMITS},decorativeCollisionObjects:0,minimumNearLateralDistance:22,minimumDecorativeClearance:Number.isFinite(this.minimumClearance)?this.minimumClearance:null,counts:{rocks:this.rocks.count,debris:this.debris.count,structureParts:this.structures.count,trim:this.trims.count},dustSample:Array.from(this.dustPositions.slice(0,6)),starOffset:this.stars.position.toArray(),cameraFov:this.cameraFov}}
  /** Only the development speed fixture changes FOV; ordinary framing is preserved. */
  get cameraFov(){return 58+Math.min(2,Math.max(0,(this.speed/this.preset.routeSpeed-1)/1.4*2))}
  dispose(){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();this.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.LineSegments){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));if(o instanceof T.InstancedMesh)o.dispose()}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.root.removeFromParent()}
}
