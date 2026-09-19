export const CONFIG = {
  step: 1 / 60, duration: 150, bounds: { x: 10, y: 5.5 }, speed: 12,
  fireInterval: 0.18, projectileSpeed: 95, maxProjectiles: 160,
  invulnerability: 1.1, seed: 7319,
} as const
export const PHASES = [
  { at: 0, name: 'Departure', hint: 'Clear the relay approach', label: '01 / RELAY APPROACH' },
  { at: 20, name: 'Drone patrol', hint: 'Sweep the patrol formations', label: '02 / DRONE PATROL' },
  { at: 55, name: 'Debris passage', hint: 'Shoot pale cracked rocks for points. Dodge solid rocks.', label: '03 / DEBRIS PASSAGE' },
  { at: 90, name: 'Relay defense', hint: 'Watch for amber incoming fire', label: '04 / RELAY DEFENSE' },
  { at: 120, name: 'Signalbreak', hint: 'Destroy the core before lockdown', label: '05 / BLOCKADE CORE' },
] as const
