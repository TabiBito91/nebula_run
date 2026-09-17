import { GameState } from '../state'

export function createMission(started = false) {
  const s = new GameState()
  s.status = started ? 'playing' : 'title'
  if (started) s.event('mission-started')
  return s
}
