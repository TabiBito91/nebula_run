import type { Pattern } from '../attackPatterns'
// Level authors can select reusable sequences without changing combat logic.
export const RELAY_VETERAN = {
  gunner: ['burst'], core: ['burst', 'sweep'], formationLead: ['fan'], coreEscort: ['fan'],
} satisfies Record<string, Pattern[]>
