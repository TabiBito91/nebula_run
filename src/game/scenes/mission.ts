import { GameState } from '../state'
import type { Difficulty } from '../difficulty'

export function createMission(started = false, difficulty: Difficulty = 'standard') {
  const s = new GameState(difficulty)
  s.status = started ? 'playing' : 'title'
  if (started) s.event('mission-started', { difficulty })
  return s
}
