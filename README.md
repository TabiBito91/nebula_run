# Nebula Run: Signalbreak

An original, browser-based 3D on-rails space shooter built with TypeScript, Three.js, Vite, and Playwright. Pilot the STRIX-9 interceptor through an abandoned orbital relay belt, defeat hostile drones, dodge debris, and break the blockade core. The original Kestrel-9 remains available as a fallback.

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

### STRIX-9 and fallback ship

STRIX-9 is the default after validation. Open `/?ship=strix` for STRIX-9, or `/?ship=legacy` for the original procedural ship. These selectors work in development and production. A missing, invalid, or timed-out GLB automatically uses the old ship; its original gun origins are also restored. Loading is asynchronous and never prevents flight with the fallback.

Open `/?testScene=ship-showcase&ship=strix` for the neutral showroom. Front, side, top, and rear use true orthographic cameras; rear-three-quarter and gameplay-distance use perspective. Buttons compare STRIX-9 with the old ship and display the unchanged collision sphere. Press P then WASD to inspect banking, ailerons, and engine brightness. Space exercises simulation firing; the showroom itself does not display projectiles. Use basic-flight for firing visuals.

Development inspector additions: `getShipReview()` returns named components, bounds, collision volume, engine centers, transformed muzzle origins, bank, and engine intensity. `setShipView(name)` and `setShipVariant('candidate' | 'legacy')` control the showroom; candidate means STRIX-9. Normal snapshots include ship selection, active fallback, asset status/error, decoded bytes, load time, and projectile positions. Asset errors are in `getState().ship.error`; expected fallback failures do not throw uncaught errors.

`npm run ship:build` regenerates `public/models/strix-9.glb` from `tools/build-strix.mjs`. No Blender, textures, external downloads, or raster references are required at runtime. Game-space dimensions are X 4.345 × Y 1.0184 × Z 4.5; forward is −Z, up +Y, right +X. Geometry transforms are applied. The original radius-0.65 sphere is unchanged: wing contact alone is deliberately not a hit, matching the existing arcade collision model.

STRIX weapons originate at local (±1.22, −0.16, −0.617), transformed by the existing banking/pitch rotation. Pulses remain parallel to the forward route, using the original speed, damage, cooldown, and collision tests. The old ship retains (±0.42, 0, −1.5). Engine centers follow the supplied source coordinates at uniform scale 4.5/9.5 with Z converted. The fixed dorsal fin and moving ailerons use the approved interpretation.

Run `npm run ship:inspect` with Vite running to capture all angles, a normal gameplay image, and old/new performance samples under `.logs/strix-review/final/`. Run `npx playwright test tests/ship*.spec.ts --project=game` for asset, loading, and gameplay checks. Full real-time keyboard sortie coverage is part of `npm run test:e2e`. On this Windows Intel host Playwright explicitly uses ANGLE D3D11 because automatic backend selection intermittently fails to create a WebGL context. No gameplay assertions are bypassed.

The earlier `Interceptor.ts` Manta concept and `models.ts` original ship source are preserved. Background, music, enemy models, controls, collision radius, and gameplay camera are unchanged.

## Current gameplay scope

The first playable sortie is a roughly 150-second arcade route: straight attackers, sweeping drone formations, a debris passage, aimed-fire drones, and a blockade-core encounter. It includes shields, score, projectile combat, visual hit feedback, particle bursts, a trailing camera, pause/end overlays, and restarting without a page refresh.

### Known limitations

This first release has no audio, gamepad/touch support, save data, online services, accessibility remapping, or configurable graphics settings. Performance depends on browser WebGL support and the local GPU.
