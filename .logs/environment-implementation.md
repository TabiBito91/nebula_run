# Dynamic environment — implementation and review

Scope: environment/background only, branch `feature/dynamic-background`. No player model, engine materials, music/audio, controls, combat balancing, HUD, collision radius, or projectile-origin changes. No copied artwork or textures. Do not push or merge before user review.

## Initial inspection and plan

The previous renderer moved one star population at one rate, held a large planet stationary, and repeated five identical gate pairs every 250 world units. The lack of middle-distance scale cues and the clearly repeating structures weakened the impression of progress.

Plan presented before implementation: layer slow celestial features, middle-distance silhouettes, and fast peripheral debris; author one Relay Graveyard segment; make art direction configurable; pool resources; keep the combat lane clear; use development-only boosted presentation rather than adding gameplay boost; inspect/refine screenshots, run regressions, and commit only this scope.

At 1280×720, before samples were 60 FPS in all three cases: basic-flight 50 draw calls / 6,698 triangles; enemy-wave 70 / 7,578; asteroid-field 60 / 6,898. No browser console/page errors. Baseline images and full state are under `.logs/environment-review/before/`.

## Architecture and safety

- `Environment.ts`: owns a graphics-only root, deterministic distance-driven placement, four instanced scenery batches, bounded stars/streaks, one procedural opaque nebula shader, and a shaded planet/ring. Resources are disposed explicitly; reset does not allocate another environment.
- `environmentPresets.ts`: configurable palette, local fog, light color, object/particle density, presentation speed, celestial placement/size/rings, and three authored landmark types/placements. Default world speed is 18 units/second; distant stars move at 1.2% of route speed and the planet even more slowly.
- The representative route passes a fractured receiver, an abandoned docking spine, and outer signal spars. Those landmarks are not wrapped. New distance-keyed rock and panel chunks do not repeat the same layout as they cycle through fixed pools.
- Limits: 2,000 star slots (1,700 drawn), 96 streak slots (72 drawn), 56 rocks, 32 debris panels, 72 structure parts, and 18 trim slots. No environment image textures, compression decoders, or network assets.
- Decorative near centers stay at |X| ≥ 22. Inspector clearance is calculated from transformed geometry bounds, not merely a declared margin. This is compared against the playable ±10 window plus ship wings in tests. The environment never calls spawning/combat or adds hazards. Near objects are dark manufactured panels, distant rocks are muted blue silhouettes; bright violet/orange enemies and cyan/orange projectiles remain visually distinct.
- Existing global gameplay lighting and fog are preserved. Environment materials implement their own fog/shading. Engine effects are intentionally untouched to honor the explicit ship-preservation boundary. Normal gameplay FOV remains 58°; only the development speed fixture uses up to 60°, without roll or shake.
- `environment-boost` is explicitly not a player ability: 2.4× visual travel and smoothly speed-scaled streak length/opacity. Controls, simulation rate, mission clock, projectile velocity, and player movement speed are unchanged. Inspector reports `gameplayBoost:false` and labels this state `preview`.

## Visual refinement

First-pass screenshots showed fragmented relay ribs, flat decorative silhouettes, and a visible grid pattern in the value-noise nebula. Refinements connected the relay arc around an intentional break, added restrained face shading, made the ring less circular, strengthened edge nebula color while keeping the aiming lane dark, and replaced lattice noise with smooth domain-warped waves. Landmark geometry then diverged into array/dock/spar types for recognizable progression. First-pass and refined images remain locally available for comparison.

Inspection scripts exercise normal flight, ordinary enemies/hazards, high-speed preview, heavy combat with real Space input, and maximum-density scenery. Gameplay regression journeys continue to use real keyboard controls without accelerated time or state mutation.

## Review artifacts

- Before: `.logs/environment-review/before/`.
- Final captures and state/metrics/errors: `.logs/environment-review/after/`.
- Reproduce: `node tools/inspect-environment.mjs` while Vite runs.
- Focused checks: `npx playwright test tests/environment.spec.ts --project=game`.
- Full regression: `npm run test:e2e`; production: `npm run test:production`.

These artifacts are ignored in Git; source, tests, and this review note are committed. Performance measurements are specific to this Windows/Chromium Intel D3D11 environment, not a hardware-independent guarantee. The existing >500 kB production-bundle warning remains.

## Final verification

- Production build passed. Full development suite: 30 passed, zero skipped/flaky/unexpected, including the real-time keyboard mission journey. Production suite: 3 passed, including ignoring the environment boost fixture in production.
- Final browser capture: all seven scenes measured 60 FPS / 16.67 ms average frame time, with no captured console, page, or request errors.
- Matched basic-flight comparison: 50 to 26 draw calls; 6,698 to 7,612 triangles. Enemy-wave: 70 to 46 calls; 7,578 to 8,492 triangles. Asteroid-field: 60 to 36 calls; 6,898 to 7,812 triangles.
- Additional samples: speed preview 26 calls / 7,644 triangles; combat while firing 75 / 10,556; dense scenery 26 / 8,344. Samples are not GPU benchmarks or sustained worst-case guarantees.
- Final screenshots inspected for normal flight, hazards, combat, dense scenery and speed preview. Decorative objects remain dark and peripheral; real hazards are brighter and enemies retain their distinctive illuminated silhouettes. No decorative collision entities exist.
- Environment uses zero image textures and introduces no asset fetch; existing ship loading remains unchanged. Pool counts and pause/reset behavior are covered by environment regressions.
- An extra focused rerun had one timeout: its snapshot recorded the existing STRIX request aborting after roughly 180 seconds and falling back to the legacy ship. The subsequent unchanged six-test run passed. Root cause of that intermittent loading stall is not established; no ship-loader changes or test weakening were made. Keep this host/dev-server reliability observation separate from the error-free seven-scene capture and successful full suite.

Files in this change: `.gitignore`, `README.md`, this note, `src/game/rendering/Environment.ts`, `src/game/rendering/environmentPresets.ts`, `src/game/rendering/Renderer.ts`, `src/game/debug/inspector.ts`, `src/game/scenes/fixtures.ts`, `tests/environment.spec.ts`, `tests/production.spec.ts`, and `tools/inspect-environment.mjs`.

Next: user visual review before any push/merge; test on lower-powered GPUs before increasing scenery density. Additional levels can supply another preset to the Renderer constructor. A real gameplay boost remains out of scope; only its presentation is previewed here.
