# Nebula Run: Signalbreak

Graphics interruption now pauses flight and offers reload; restored graphics leave the mission paused for manual resume. A bounded diagnostic checkpoint is kept locally in `localStorage['nebula-run:last-flight']` (never uploaded). The development inspector exposes `graphicsState` and `previousFlightDiagnostic`. See `.logs/crash-recovery.md` for investigation details and limitations.

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

### Layered environment

The Relay Graveyard environment is render-only: distant stars and a procedural nebula, a shaded ringed planet, three distinct industrial landmarks, and pooled middle/near scenery. Authored landmarks occur at different route distances; distance-keyed scenery chunks generate new deterministic layouts instead of repeating gates. Decoration stays outside the flight corridor and never enters collision or combat collections.

Art direction lives in `src/game/rendering/environmentPresets.ts`: colors, environment-local fog, surface/celestial lighting colors, star/dust counts, density, forward presentation speed, planet size/position/rings, and landmark identity/type/placement. A level can supply its preset through `new Renderer(canvas, preset)` without changing renderer internals. `Environment` owns and disposes its pooled graphics resources. The ship, gameplay lighting/fog, weapons, HUD, controls, audio, and enemy/hazard balance are unchanged.

Additional development fixtures:

- `?testScene=environment-normal`: quiet representative flight.
- `?testScene=environment-boost`: **presentation-only** 2.4× travel, longer peripheral streaks, and 58° → 60° FOV. No boost control or gameplay speed change is introduced.
- `?testScene=environment-combat`: six existing enemy types/instances plus incoming shots; hold Space for combat inspection.
- `?testScene=environment-dense`: maximum scenery pools in the dock portion of the segment.

Inspector `getState().environment` reports preset, region, distance, forward presentation speed, combined presentation/player lateral speed, preview boost state, pool counts/limits, measured lateral clearance, and sample layer positions. FPS, average frame time, draw calls, and triangles remain on the main snapshot. Object counts are active pooled instances, not a GPU-visible-object count. `gameplayBoost` is always false; paused simulation freezes the environment. Preview settings reset when leaving their fixture.

Run `node tools/inspect-environment.mjs` with Vite running for seven screenshots and diagnostic JSON in `.logs/environment-review/after/`. Run `npx playwright test tests/environment.spec.ts --project=game` for environment-specific regressions. The environment has no image textures or external asset fetches; one opaque procedural background and bounded low-opacity line streaks limit overdraw.

The first playable sortie is a roughly 150-second arcade route: straight attackers, sweeping drone formations, a debris passage, aimed-fire drones, and a blockade-core encounter. It includes shields, score, projectile combat, visual hit feedback, particle bursts, a trailing camera, pause/end overlays, and restarting without a page refresh.

### Known limitations

This first release has no audio, gamepad/touch support, save data, online services, accessibility remapping, or configurable graphics settings. Performance depends on browser WebGL support and the local GPU.
