import type { GameInspector } from './inspector'
declare global { interface Window { __GAME_INSPECTOR__?: GameInspector } }
export {}
