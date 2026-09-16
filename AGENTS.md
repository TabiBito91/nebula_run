# Project instructions

- Scope: all work in Nebula Run: Signalbreak. Follow PLAN.md; user has approved implementation.
- Install: `npm install`, then `npx playwright install chromium`.
- Develop: `npm run dev -- --host 127.0.0.1`. Build: `npm run build`. Preview: `npm run preview`.
- Test: `npm run test:e2e`; headed: `npm run test:e2e:headed`; report: `npm run test:e2e:report`; production smoke: `npm run test:production`.
- Keep plain simulation state separate from Three.js rendering; use fixed-step time, seeded randomness, bounded collections and stable IDs.
- Architecture: src/game contains entities, systems, scenes, input, rendering, ui and debug; main.ts bootstraps the game.
- Controls: WASD/arrows steer, Space fires, P/Escape pauses, Enter starts, R restarts after an end state.
- Development-only window.__GAME_INSPECTOR__ exposes getState/listScenes/loadScene/resetScene/getRecentEvents/clearRecentEvents/getErrors/getMetrics/pause/resume. Return detached serializable snapshots.
- Scenes (paused and ready on load): mission-start (real route), basic-flight (empty), asteroid-field (fixed debris), basic-enemy (aligned straight attacker), enemy-wave (sweepers), enemy-fire (aimed drone), low-health (avoidable lethal shot), final-encounter (core), mission-complete (results).
- Load fixtures with `?testScene=enemy-wave` or inspector.loadScene(name). Await readiness; explicitly resume for gameplay.
- Before changing existing gameplay, inspect relevant state, screenshots and console/page errors. Initial implementation has no existing game to inspect.
- Add regression tests for bug fixes. Journey tests must use real keyboard controls, not internal state mutations or accelerated mission time.
- Never weaken tests to make them pass. Compilation alone does not establish success.
- Browser verification: inspect readiness, state, events, screenshots, errors and performance; then play with real controls.
- Artifacts: test-results/ (screenshots, traces, videos, JSON), playwright-report/ (HTML), .logs/ (meaningful architecture/verification notes).
- No copied franchise content, external assets, AI APIs or required API keys.
- Preserve user changes. Use configured Git identity. Do not create nested project folders.
