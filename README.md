# Nebula Run: Signalbreak

An original, browser-based 3D on-rails space shooter built with TypeScript, Three.js, Vite, and Playwright. Pilot the Kestrel-9 courier through an abandoned orbital relay belt, defeat hostile drones, dodge debris, and break the blockade core.

## Run locally

```powershell
npm install
npx playwright install chromium
npm run dev
```

Open the local address printed by Vite, normally `http://127.0.0.1:5173/`.

## Controls

- `WASD` or arrow keys: steer
- `Space`: fire twin pulse emitters
- `P` or `Escape`: pause/resume
- `Enter`: launch from the title screen
- `R`: restart after a completed or failed sortie

## Tests

```powershell
npm run build
npm run test:e2e
npm run test:production
npm run test:e2e:headed
npm run test:e2e:report
```

The Playwright suite starts Vite automatically, runs Chromium at 1280×720, and stores failure diagnostics under `test-results/`. The HTML report is written to `playwright-report/`.

## Development scenes and inspector

During local development, load a deterministic scene through a URL such as:

```text
http://127.0.0.1:5173/?testScene=enemy-wave
```

Available scenes: `mission-start`, `basic-flight`, `asteroid-field`, `basic-enemy`, `enemy-wave`, `enemy-fire`, `low-health`, `final-encounter`, and `mission-complete`.

`window.__GAME_INSPECTOR__` is available only in the Vite development build. It provides `getState()`, `listScenes()`, `loadScene()`, `resetScene()`, `getRecentEvents()`, `clearRecentEvents()`, `getErrors()`, `getMetrics()`, `pause()`, and `resume()`.

The inspector returns detached, serializable simulation state: flight status, mission progress, player transform/shields, target and entities, projectiles/hazards, event and collision history, captured errors, camera state, and renderer metrics. Test scenes initially pause after reaching readiness; call `resume()` before simulation checks.

Production ignores `testScene` URL parameters and does not expose the inspector.

## Current gameplay scope

The first playable sortie is a roughly 150-second arcade route: straight attackers, sweeping drone formations, a debris passage, aimed-fire drones, and a blockade-core encounter. It includes shields, score, projectile combat, visual hit feedback, particle bursts, a trailing camera, pause/end overlays, and restarting without a page refresh.

### Known limitations

This first release has no audio, gamepad/touch support, save data, online services, accessibility remapping, or configurable graphics settings. Performance depends on browser WebGL support and the local GPU.
