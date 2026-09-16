# Nebula Run — First Playable Plan

Approved for implementation by the user. Original title: **Nebula Run: Signalbreak**.

## Goal and gameplay
Pilot an original fork-wing courier through an abandoned orbital relay belt and destroy its blockade core. Build an approachable desktop browser on-rails shooter using Vite, TypeScript, Three.js, npm and Playwright. Use original primitive geometry and procedural effects only. No AI API, backend, audio, persistence, touch/gamepad support or deployment.

One 150-second mission: 0–20 introductory straight attackers; 20–55 sweeping formations; 55–90 asteroid corridor; 90–120 mixed aimed-fire attackers; 120–150 blockade core and supporting drones. Automatic forward flight, bounded steering, one weapon, 100 shields without regeneration, brief hit invulnerability, score, progress, game over, completion, and restart. Destroy core to win; zero shields or blockade deadline to lose. Missed regular enemies do not inflict automatic damage.

WASD/arrows steer with normalized diagonals; hold Space to fire twin pulses on a shared cooldown; P/Escape pause; R restarts terminal states; Enter/Start launches. No boost. Clear input and pause on focus loss.

Charcoal space, teal engines/player shots, orange hostile fire, violet scenery. Recognizable split-nose ship, distinct enemy silhouettes, animated stars, rotating debris, hit flashes, pooled explosions, engine glow, aligned reticle, restrained trailing camera without roll. DOM HUD and readable start/pause/end overlays.

## Architecture and expected files
Create the project directly here. Root: PLAN.md, AGENTS.md, README.md, package.json/lockfile, index.html, tsconfig.json, Vite/Playwright configuration, .gitignore and .logs. src/main.ts bootstraps src/game/Game.ts, config.ts and state.ts. entities stores plain typed data; systems separate movement, collision/combat and mission spawning; scenes stores the production mission and development fixtures; input, rendering, ui and debug each have dedicated modules. tests contains reproducible browser tests.

Fixed 60 Hz simulation, clamped frame gaps, interpolated rendering, simulation-clock gameplay timers, wall-clock performance metrics. Stable IDs and seeded randomness. Bound projectile/particle/event storage. Share geometry/materials, dispose resources, reset without duplicate listeners or animation loops.

## Inspection interface
Development-only typed window.__GAME_INSPECTOR__: getState, listScenes, loadScene, resetScene, getRecentEvents, clearRecentEvents, getErrors, getMetrics, pause, resume. Scene load/reset promises resolve after first rendered frame; invalid names reject without modifying the scene. Snapshots are detached serializable data: readiness, scene, mission phase/time/progress, pause, player transform/velocity/shields/cooldown, score, target/distance, enemies, projectile/hazard counts, collisions/events/errors, camera, pending assets, FPS/frame time/draw calls/triangles. Keep 200 events and 50 errors. Record mission-started, weapon-fired, enemy-spawned/hit/destroyed, player-hit, collision, phase-changed, mission-completed, game-over and game-restarted.

Only import inspector and test fixtures behind import.meta.env.DEV. Production ignores testScene and exposes no inspector.

## Deterministic fixtures
Fixed seed, known starting state, reset clock, explicit readiness, paused on load: mission-start (real mission), basic-flight, asteroid-field, basic-enemy, enemy-wave, enemy-fire, low-health, final-encounter and mission-complete. Load via inspector or ?testScene=enemy-wave. Deterministic simulation, not GPU pixels. Document every scene in AGENTS.md and README.md.

## Tests and verification
Playwright Chromium, 1280x720, one worker, automatic Vite startup. Retain failure screenshots/traces/videos under test-results and HTML report under playwright-report. Capture console/page/network errors and attach state/events/metrics. Wait for observable readiness/transitions instead of arbitrary sleeps.

Test boot, fixtures, real-keyboard movement/diagonals/bounds/fire, projectiles/cooldown/events, damage/destruction/scoring, pause, progress, game-over/completion/restart, screenshots, no unexpected errors, production build and production inspector absence. Include a real-time full mission keyboard journey without scene jumps, state mutation or time acceleration; separate controlled damage/failure journeys. Inspect screenshots/state/events/errors/metrics for mission-start, asteroid-field, enemy-wave, low-health and final-encounter. Play full route, fix material findings, rerun checks. Target 60 FPS; report actual hardware/browser limitations. Never weaken tests or equate compilation with success.

## Milestones and commands
1. Planning files (complete before scaffolding; plan now approved).
2. Scaffold vanilla-ts in this folder, preserve planning files; install dependencies and Chromium; initialize Git and commit scaffolding.
3. Flight, rendering, UI and inspector foundation.
4. Combat, hazards, three enemy behaviors and full mission/final encounter.
5. Fixtures, automated scene and real-input journey tests.
6. Browser verification, fixes, docs, final Git checkpoint and report.

Expected commands: npm create vite@latest . -- --template vanilla-ts; npm install; npm install three; npm install -D @types/three @playwright/test; npx playwright install chromium; git init; npm run dev -- --host 127.0.0.1; npm run build; npm run preview -- --host 127.0.0.1; npm run test:e2e; npm run test:e2e:headed; npm run test:e2e:report; npm run test:production. Preserve files in scaffolding prompts. Use configured Git identity; never invent one.

README covers setup/play/tests/scenes/inspector/scope/limitations. AGENTS contains permanent workflow requirements. .logs contains meaningful architecture/verification notes only. Final report lists files, architecture, commands, results, artifacts, scenes, inspector, controls, limitations and next milestone.
