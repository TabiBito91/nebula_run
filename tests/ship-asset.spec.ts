import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {STRIX_MUZZLES} from '../src/game/shipConfig'

test('bundled GLB has applied transforms, named assemblies and bounded resources',async()=>{
  const data=await readFile('public/models/strix-9.glb')
  expect(data.readUInt32LE(0)).toBe(0x46546c67)
  expect(data.readUInt32LE(4)).toBe(2)
  const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString())
  expect(data.length).toBeLessThan(1_000_000)
  expect(gltf.textures??[]).toHaveLength(0)
  expect(gltf.materials.length).toBeLessThanOrEqual(8)
  let triangles=0,draws=0
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
    triangles+=gltf.accessors[primitive.indices??primitive.attributes.POSITION].count/3;draws++
  }
  expect(triangles).toBeGreaterThanOrEqual(5000);expect(triangles).toBeLessThanOrEqual(15000)
  expect(draws).toBeLessThanOrEqual(20)
  for(const node of gltf.nodes){
    expect(node.scale??[1,1,1]).toEqual([1,1,1])
    expect(node.rotation??[0,0,0,1]).toEqual([0,0,0,1])
    expect(node.matrix).toBeUndefined()
  }
  for(const [i,side] of ['port','starboard'].entries()){
    for(const part of ['wing','engine-housing','engine-core','weapon-mount'])
      expect(gltf.nodes.find((n:{name:string})=>n.name===`${side}-${part}`).mesh).toBeDefined()
    const p=STRIX_MUZZLES[i]
    expect(gltf.nodes.find((n:{name:string})=>n.name===`${side}-projectile-origin`).translation).toEqual([p.x,p.y,p.z])
  }
})
