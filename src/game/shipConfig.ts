import type { Vec3 } from './entities/types'
export const STRIX_MUZZLES = [{x:-1.22,y:-.16,z:-.617},{x:1.22,y:-.16,z:-.617}] as const
export const LEGACY_MUZZLES = [{x:-.42,y:0,z:-1.5},{x:.42,y:0,z:-1.5}] as const
/** Euler XYZ, identical to the visual root, without importing the renderer into simulation. */
export function rotatedMuzzles(pitch:number,bank:number): Vec3[] {
  return STRIX_MUZZLES.map(p=>{
    const x=Math.cos(bank)*p.x-Math.sin(bank)*p.y, y=Math.sin(bank)*p.x+Math.cos(bank)*p.y
    return {x,y:Math.cos(pitch)*y-Math.sin(pitch)*p.z,z:Math.sin(pitch)*y+Math.cos(pitch)*p.z}
  })
}
