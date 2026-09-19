# Nebula Run: Signalbreak

Private feedback is available from the main menu, pause menu, and results. See [FEEDBACK.md](FEEDBACK.md) for storage, review queries, retention, tests, and Replit rollout instructions.

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

To leave a sortie, pause with P/Escape and choose **Return to Main Menu**. Confirm **Return to Menu** to discard its progress and score. **Keep Playing** or Escape cancels the confirmation and leaves the sortie paused; resume when ready. Victory and game-over screens offer **Main Menu** directly. Returning clears flight state and gameplay sounds without reloading; audio preferences and the selected ship are retained.

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

This release has temporary procedural audio, landscape touch controls and an optional online leaderboard, but no gamepad support, saved mission progress, accessibility remapping, or configurable graphics settings. Performance depends on browser WebGL support and the local GPU.

## Music and sound effects

Click Launch or press a gameplay key to unlock audio. Open **Audio** at the upper right to adjust master, music and sound-effects volumes or mute. Defaults are 80%, 35%, and 70%; settings persist on this device. Keyboard interaction with the panel does not steer or fire. Escape closes it.

A centralized native Web Audio manager owns seven category buses, bounded voices, cached buffers, restrained stereo placement, crossfades and music ducking. Menu, flight, combat, boss, victory and failure music follow game state. Pause preserves playback position; hidden tabs suspend audio; restarting replaces loops instead of stacking them. Audio failures are isolated from gameplay and missing recordings fall back to generated buffers.

All six music cues and 19 sound effects are **original temporary procedural audio**, not final mastered recordings. There are no third-party audio downloads. See `public/audio/ASSETS.md` for the complete asset/rights ledger, recommended final filenames, durations, formats, loop points and replacement instructions. Mute restores silent play; the pre-audio Git checkpoint is `457af80`.

Development-only audio scenes (paused on load): `audio-flight`, `audio-firing`, `audio-dodge-shoot`, `audio-boost`, `audio-enemy-fire`, `audio-impacts`, `audio-damage`, `audio-transition`, `audio-boss`, `audio-pause`, `audio-restart`, `audio-victory`, and `audio-failed-load`. Use `/?testScene=audio-firing`, press P, then hold Space. Dodge/boost scenes are audio previews only: no new abilities or changed movement. Target confirmation is not a homing mechanic; damage remains shield-only.

Inspector `getState().audio` includes initialization/unlock state, track/state/status/position, persisted gains, active voices/loops, engine/preview boost, recent events, transition, load failures, buffer memory, latency and output peak. The dev-only `startAudioCapture()` / `stopAudioCapture()` helpers record up to 60 seconds for review. Production includes neither these helpers nor fixture controls.

Run `node tools/inspect-audio.mjs` with Vite running to capture keyboard-driven review scenes, output recordings, screenshots and metrics under `.logs/audio-review/`. Run `npx playwright test tests/audio*.spec.ts --project=game` for focused checks. Full game and production commands above include audio regression coverage. See `.logs/audio-implementation.md` for measured results and remaining listening limitations.

## Phone controls

Sound starts after tapping Launch. If sound remains blocked, open Audio and tap **Enable sound** to retry; check mute and volume settings there as well. This retry preserves your saved volume choices.

On phones, rotate to landscape, tap Launch Sortie, then drag on the flight view to steer. Firing is automatic with the same weapon cooldown as desktop. Lifting your finger stops steering; tap Pause to stop the mission. Rotating to portrait or leaving the browser pauses flight; resume explicitly when ready. Menus support touch and safe-area spacing. Rendering retains the existing 1.5 pixel-ratio cap. Desktop keyboard controls remain available. Verified with Chromium mobile emulation; actual iPhone Safari and Android hardware performance still require device testing.

## Leaderboard

After a sortie, open **Save score**, enter your display name, and press **Save**. The optional **Also share on the public leaderboard** checkbox starts unchecked: leave it unchecked to save locally only. Checking it saves the same name locally and submits it online in one action. Cancel/Escape retains the draft but neither saves the edited name nor publishes it; reopening requires fresh consent. Draft text survives asynchronous status updates. Offline runs can still save a local name; blocked storage is explicitly reported as session-only.

Once an online submission is attempted, its name is locked because the server may have accepted it even if the reply was lost. **Retry sharing** resends the identical name and score. Stay on the results screen to retry; pending submissions are not persisted across reloads or leaving the run. Successful sharing selects the online tab when you next open the leaderboard. Existing published names cannot be renamed by this feature; the saved name applies to the current run, not all past records or future runs.

### Difficulty and rankings

Choose **Relaxed**, **Standard**, or **Veteran** before launch. The choice is fixed during flight and kept on restart/return to menu (a page reload defaults to Standard). Standard retains the original gameplay balance. Relaxed uses 20% slower hostile shots, 40% longer fire intervals, 25% less incoming damage, and at most one mission gunner at a time. Veteran uses 15% faster hostile shots, 15% shorter fire intervals, a capped 0.18-second aiming lead, and selected extra attackers. These are existing enemy types, not new assets or AI classes. All modes keep the same player speed, weapon, enemy health, collision sizes, mission duration, and asteroid safe gaps.

Points are awarded once at 0.75× / 1× / 1.25× respectively (a basic drone is 75 / 100 / 125). Both online and local leaderboards show Relaxed, Standard, and Veteran by default. **Archived rankings** opens the previous Standard and Veteran rulesets, read-only and separate from current competition. **Back to current rankings** restores the current difficulty selection. No scores are deleted or merged. No database migration is needed. Deploy client and server together; an outdated API safely falls back to local scores.

Tuning is centralized in `src/game/difficulty.ts`. Inspector snapshots include `difficulty` and `difficultyTuning`. Additional paused fixtures: `relaxed-enemy-fire`, `veteran-enemy-fire`, `relaxed-final-encounter`, and `veteran-final-encounter`. Fixtures never submit records. Difficulty tests live in `tests/difficulty*.spec.ts`; `tests/journey.spec.ts` runs unaccelerated, keyboard-driven full routes for all three modes.

Open **Leaderboard** from the main menu or result screen for the online top 25 and this device's top 10. Finished real sorties save locally. Online publishing is opt-in inside **Save score**, using the displayed 3–16 character name and result. Names use a conservative character set and can be hidden by an operator; they are not verified identities. Test fixtures and abandoned runs are excluded. Browser-reported scores are not cheat-proof records.

Use Node 24.16+. `npm run dev` now starts both Vite and the local API; SQLite development data stays in ignored `.data/`. For deployment, `npm start` serves the built game and API together and requires PostgreSQL plus server-only settings in production. See [LEADERBOARD.md](LEADERBOARD.md) for Replit setup, privacy/abuse limits, database persistence, versioning, moderation and offline behavior. `npm run test:leaderboard` runs backend tests; `npx playwright test tests/leaderboard.spec.ts --project=game` includes a real-time browser sortie and local API/database integration. No Replit deployment is created automatically.
# Veteran attack patterns

Veteran adds warned three-shot gunner bursts, five-shot fans from selected sweeping drones, and alternating burst/sweep core attacks. Rings warn of bursts; spread ticks warn of fans; horizontal ticks warn of sweeps. Fan/sweep volleys lock a row when the warning starts: changing altitude is useful. Bursts sample a short capped aim prediction per shot; projectiles never home.

Warnings last at least one second, attack starts are staggered, at most two enemies can prepare/fire simultaneously, and hostile shots are capped at 48. Close attackers cancel rather than firing at point-blank range. Player controls, damage, shields, weapons and ordinary enemy health are unchanged.

For future levels, reuse `src/game/attackPatterns.ts` and select sequences in `src/game/scenes/encounters.ts`; do not duplicate attack logic. Development review scenes: `veteran-enemy-fire`, `veteran-enemy-wave`, `veteran-final-encounter`. The inspector includes detached attack state and `activeAttacks`.

Current boards use `signalbreak-4` (Standard), `signalbreak-4-relaxed`, and `signalbreak-4-veteran` because asteroid rewards change scoring in every mode. All previous boards remain read-only under Archived rankings. Deploy client and server together; no database schema migration is required.

## Breakable asteroids

Pale rocks with dark fracture seams take four pulse hits to destroy and award 30 / 40 / 50 points on Relaxed / Standard / Veteran. Dark solid rocks cannot be destroyed. Both intact types cause the existing collision damage; destroyed rocks disappear immediately and their pooled visual fragments cannot collide. Missed rocks award nothing. Each mission debris pair contains one of each type; original positions, flight speeds, radii, safe gaps and seeded randomness are preserved. Distant environment rocks remain decorative, with no targeting or scoring.

`src/game/asteroids.ts` defines durability, base points and reserved `drop: null` metadata for future level variants. No pickups, shield repair, boost or weapon upgrades are implemented. Inspector snapshots expose hazard kind, durability, radius and position; events include asteroid-hit, asteroid-destroyed and score-awarded. Repeatable development fixtures: `asteroid-targets` (aligned breakable plus solid rock) and `asteroid-field` (mixed corridor).
