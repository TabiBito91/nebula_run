// Original STRIX-9: reproducible, texture-free glTF asset. Game axes: -Z forward, +Y up.
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result=value; this.onloadend?.() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result=`data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.() }) }
}
const root=new T.Group();root.name='STRIX-9'
const materials={}
for(const [name,color,metalness,roughness] of [
  ['hull','#9fb0bd',.38,.62],['side','#7c8a97',.35,.66],['belly','#5c6875',.3,.72],
  ['trim','#3a4652',.4,.58],['glass','#0c1720',.5,.2],['teal','#5ce8d8',0,.4],
  ['core','#e8ddff',0,.4],['red','#ff5c6a',0,.4],
]) {
  materials[name]=new T.MeshStandardMaterial({name,color,metalness,roughness})
  if(['teal','core','red'].includes(name)) { materials[name].emissive.set(color);materials[name].emissiveIntensity=name==='core'?2:1 }
}
const buckets=new Map()
function add(name,geometry,mat,position=[0,0,0],rotation=[0,0,0],parent=root) {
  geometry.deleteAttribute('uv')
  geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(1,1,1)))
  // Major assemblies remain individually named meshes; small static trims are
  // batched by material. Animation anchors and ailerons stay independently editable.
  const assembly=/^(port|starboard)-(wing|engine-housing|engine-core|weapon-mount)$/.test(name)||name==='cockpit-canopy'
  if(parent===root&&!assembly) {
    const marker=new T.Object3D();marker.name=name;marker.position.set(...position);root.add(marker)
    if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(geometry)
  } else { const m=new T.Mesh(geometry,materials[mat]);m.name=name;parent.add(m) }
}
function box(name,size,pos,mat='trim',rot=[0,0,0]) {add(name,new T.BoxGeometry(...size),mat,pos,rot)}
// Closed polygon extruded vertically; bevels catch the light without changing the silhouette.
function panel(points,y,thickness,bevel=.012) {
  const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath()
  const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1,curveSegments:1})
  g.rotateX(-Math.PI/2);g.translate(0,y,0);return g
}
// Diamond-section hull, lofted through stations. Nose at -2.25, tail at +2.25.
const stations=[[-2.25,.008,0,0],[-1.87,.18,.10,-.07],[-1,.39,.23,-.18],[-.35,.48,.24,-.22],[.65,.36,.19,-.18],[1.6,.19,.11,-.10],[2.25,.12,.055,-.055]]
for(let face=0;face<4;face++) {
  const positions=[]
  const ring=([z,w,top,bottom])=>[[0,top,z],[w,0,z],[0,bottom,z],[-w,0,z]]
  for(let i=0;i<stations.length-1;i++) {
    const a=ring(stations[i]),b=ring(stations[i+1]),j=(face+1)%4
    for(const v of [a[face],b[face],a[j],a[j],b[face],b[j]])positions.push(...v)
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals()
  add(`fuselage-facet-${face}`,g,face===0?'hull':face===3?'side':'belly')
}
box('tail-cap',[.24,.11,.018],[0,0,2.24])
// Canopy and frame follow the long narrow center body, forward of the dorsal fin.
add('canopy-frame',panel([[-.18,-.68],[.18,-.68],[.18,.34],[-.18,.34]],.235,.02),'trim')
// Sloped greenhouse canopy, not an extruded rectangular block.
const canopyVertices=[[-.17,.26,-.64],[.17,.26,-.64],[-.11,.395,-.43],[.11,.395,-.43],[-.11,.395,.11],[.11,.395,.11],[-.17,.26,.30],[.17,.26,.30]]
const canopy=new T.BufferGeometry();canopy.setAttribute('position',new T.Float32BufferAttribute(canopyVertices.flat(),3))
canopy.setIndex([0,2,1,1,2,3,2,4,3,3,4,5,4,6,5,5,6,7,0,6,2,2,6,4,1,3,7,3,5,7]);canopy.computeVertexNormals();add('cockpit-canopy',canopy,'glass')
for(const sign of [-1,1])box(`canopy-trim-${sign}`,[.018,.012,.94],[sign*.179,.259,-.17],'teal')
for(const z of [-1.32,.32,1.17])box(`spine-strip-${z}`,[.025,.012,z===1.17?.95:.34],[0,z<0?.19:.185,z],'teal')
for(const sign of [-1,1]) {
  const side=sign<0?'port':'starboard'
  // Turnaround top silhouette: root leading edge -.25; tip leading edge +.49.
  add(`${side}-wing`,panel([[sign*.40,-.25],[sign*2.158,.49],[sign*2.158,1.10],[sign*.40,.96]],-.035,.065,.012),'hull')
  add(`${side}-wing-under`,panel([[sign*.40,-.25],[sign*2.158,.49],[sign*2.158,1.10],[sign*.40,.96]],-.055,.018,0),'trim')
  const aileron=new T.Group();aileron.name=`${side}-aileron`;aileron.position.set(sign*1.60,.01,.98);root.add(aileron)
  add(`${side}-aileron-panel`,panel([[-.40,0],[.40,0],[.40,.09],[-.40,.03]],0,.018,0),'side',[0,0,0],[0,0,0],aileron)
  box(`${side}-wing-accent`,[.26,.008,.07],[sign*1.52,.048,.70],'teal')
  box(`${side}-navigation-light`,[.025,.022,.045],[sign*2.16,.012,1.045],sign<0?'red':'teal')
  // Engine centers exactly match the approved source centers after uniform scaling and Z conversion.
  const x=sign*1.55*4.5/9.5, y=-.28*4.5/9.5, z=1.55*4.5/9.5
  box(`${side}-engine-pylon`,[.13,.12,.48],[x,-.06,z],'trim')
  box(`${side}-engine-housing`,[.24,.24,.65],[x,y,z],'side',[0,0,Math.PI/4])
  const engine=new T.Object3D();engine.name=`${side}-engine-center`;engine.position.set(x,y,z);root.add(engine)
  // Fine concentric nozzle rings; broad housing remains low-poly.
  const diamond=g=>{const p=g.attributes.position;for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),r=Math.hypot(a,b),k=r/(Math.abs(a)+Math.abs(b)||1);p.setXY(i,a*k,b*k)}g.computeVertexNormals();return g}
  add(`${side}-nozzle`,diamond(new T.TorusGeometry(.143,.025,12,64)),'trim',[x,y,z+.33])
  add(`${side}-engine-ring`,diamond(new T.TorusGeometry(.114,.009,8,48)),'teal',[x,y,z+.347])
  add(`${side}-engine-core`,diamond(new T.CircleGeometry(.106,48)),'core',[x,y,z+.335])
  const gunX=sign*1.22,gunY=-.16,gunZ=-.48
  box(`${side}-weapon-mount`,[.16,.15,.72],[gunX,gunY,gunZ+.36])
  box(`${side}-weapon-pylon`,[.11,.13,.19],[gunX,-.064,.16])
  add(`${side}-weapon-barrel`,new T.CylinderGeometry(.045,.065,.18,12),'trim',[gunX,gunY,gunZ-.045],[Math.PI/2,0,0])
  add(`${side}-weapon-muzzle`,new T.CircleGeometry(.044,12),'teal',[gunX,gunY,gunZ-.137],[0,Math.PI,0])
  const anchor=new T.Object3D();anchor.name=`${side}-projectile-origin`;anchor.position.set(gunX,gunY,gunZ-.137);root.add(anchor)
}
// Fixed dorsal and ventral fins. Full vertical envelope is 2.15/9.5 * 4.5.
function fin(name,points,mat) { const g=panel(points,0,.025,0);g.rotateZ(Math.PI/2);add(name,g,mat) }
fin('dorsal-stabilizer',[[.18,.25],[.606,.57],[.65,.96],[.14,1.09]],'side')
fin('ventral-stabilizer',[[-.16,.70],[-.3684,.94],[-.13,1.15]],'belly')
box('dorsal-beacon',[.026,.018,.035],[-.012,.641,.92],'red')
for(const [mat,geometries] of buckets) {
  const merged=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g))
  const mesh=new T.Mesh(merged,materials[mat]);mesh.name=`static-${mat}`;root.add(mesh)
}
root.userData={design:'STRIX-9 STX9-A1',forward:'-Z',up:'+Y',scale:'4.5 game units / 9.5 source meters',collisionRadius:.65}
const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,trs:true})
await mkdir('public/models',{recursive:true});await writeFile('public/models/strix-9.glb',Buffer.from(glb))
const box3=new T.Box3().setFromObject(root);let triangles=0,drawCalls=0
root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;drawCalls++}})
console.log(JSON.stringify({bytes:glb.byteLength,triangles,drawCalls,bounds:box3.getSize(new T.Vector3()).toArray()}))
