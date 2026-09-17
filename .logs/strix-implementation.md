# STRIX-9 implementation and visual validation

## Scope and interpretation

The user approved implementation using the comprehensive turnaround PNG in place of the missing PDF and approved reference-positioned underwing weapons. No reference raster, commercial screenshot, third-party model, music, or franchise asset is included in the game. Background and audio were not changed.

Source dimensions 9.50 × 9.16 × 2.15 are interpreted as length × span × full vertical envelope. Uniform scale 4.5/9.5 and a baked forward-axis conversion give game axes −Z forward, +Y up, +X right. Port remains negative X. Full rest bounds including trim: X 4.345, Y 1.0184, Z 4.500. Small wingtip/bevel allowance adds about 0.006 to the nominal 4.339 span. No negative scale or root corrective rotation is required.

The independent collision proxy remains the original sphere, radius 0.65, volume 1.15035, centered on the player's simulation position. Rendered wings do not enlarge the hittable area. Movement bounds, normalized input, shield damage, invulnerability, projectile radius/damage/speed, cooldown, enemy logic, and fixed-step timing are unchanged.

## Asset and runtime

- Reproducible source: `tools/build-strix.mjs`; output: `public/models/strix-9.glb`.
- Named wing, canopy, engine-housing, engine-core, weapon-mount meshes and aileron pivots; minor static trim batched by material with named component markers. Eight shared PBR materials, no texture resources. Existing procedural `models.ts` and earlier Manta `Interceptor.ts` are preserved.
- 5,262 triangles, 17 draw calls, 389,444 bytes. No raster textures, compression decoder, additional light, or postprocessing dependency. Explicit position/rotation/scale fields preserve editable anchors; mesh rotations/scales are applied in geometry.
- Engine centers: (±0.7342105, −0.1326316, +0.7342105), matching the scaled source centers. Separate recessed violet-white cores and cyan rings; movement changes emissive intensity 2 → 3.4.
- STRIX gun origins: (±1.22, −0.16, −0.617). Plain simulation math applies the same XYZ pitch/bank transform as the visual root. Existing forward-parallel pulse trajectories are retained. The legacy ship keeps (±0.42, 0, −1.5).
- Fetch/parse is asynchronous, bounded by a ten-second fetch timeout, and rejects assets missing required anchors/components. The procedural ship remains playable while pending and after a failure. Late loads are disposed after teardown. Restart and fixture reset reuse the loaded asset.
- Diagnostics: inspector `ship` reports selected/active variant, pending/ready/failed status, failure text, load duration, decoded byte count, and texture count. `getShipReview()` exposes bounds, hardpoints, engine centers, named components, banking, emissive intensity, and camera projection.

## Screenshot-driven refinements

First-pass captures are retained locally under `.logs/strix-review/first-pass/`. Examination revealed a block-like canopy, insufficiently connected gun pods, round exhaust faces, and an overly tight perspective top view. Corrections made:

1. Built a sloped greenhouse canopy and aligned its fore/aft location with the top orthographic reference.
2. Added visible gun pylons and extended mounts into the wing.
3. Converted nozzles/cores to diamond faces and reduced engine housing cross-section to better match the rear view.
4. Added exact front/side/top/rear orthographic cameras at a common scale, with top-view nose-down orientation matching the sheet.
5. Reduced neutral studio lighting to retain gray color blocking; retained production lighting unchanged.

Final captures: `.logs/strix-review/final/{front,side,top,rear,rear-three-quarter,gameplay,normal-gameplay}.png`. The accompanying `inspection.json` contains complete measurements and sampled states. `npm run ship:inspect` reproduces them with Vite running.

Compared against all supplied images: the main proportions, aft-swept trapezoid wings, long pointed nose, tapered blunt tail, single dorsal/ventral fins, central dark canopy, twin underwing nacelles, and palette are represented. Deliberate differences: modest bevels/nozzle detail; compact underwing barrel/pylon interpretation where exact mount dimensions were unspecified; opaque glass rather than transparency; no bloom; fixed dorsal fin with animated ailerons. The existing camera is retained, so the ship occupies roughly 12% of the 1280-pixel viewport width, versus approximately 18% in the reference gameplay image. No camera zoom or background treatment was introduced.

## Performance observations

Equal 140-render-frame neutral-showroom samples at 1280×720: legacy 60 FPS / 16.67 ms / 12 calls / 332 triangles; STRIX 60 FPS / 16.67 ms / 17 calls / 5,262 triangles. Normal empty-flight scene with STRIX: 60 FPS, 50 calls, 6,698 triangles; legacy scene baseline 45 calls, 1,768 triangles. Thus the incremental visible cost is five calls and 4,930 triangles, plus a 381 KiB GLB and GLTFLoader bundle code.

Final inspected local asset load/decode was approximately 507 ms (earlier runs about 250–447 ms). This includes local browser overhead and is not a network/CDN prediction. No textures are allocated by this asset. These short samples do not establish hardware-independent 60 FPS or sustained thermally limited performance.

This host's Intel automatic ANGLE backend intermittently failed WebGL initialization with `BindToCurrentSequence failed`, including outside the sandbox. Explicit `--use-angle=d3d11` worked; the Windows Playwright configuration and inspection command use it. The game does not force a browser backend. The production build still warns about a >500 kB JavaScript chunk (approximately 642 kB uncompressed / 165 kB gzip).

## Files

Added asset/generator/controller/config: `public/models/strix-9.glb`, `tools/build-strix.mjs`, `tools/inspect-strix.mjs`, `src/game/rendering/Strix.ts`, `src/game/shipConfig.ts`.

Integrated: `src/game/rendering/Renderer.ts`, `src/game/Game.ts`, `src/game/systems/combat.ts`, `src/game/ui/Hud.ts`, `src/game/debug/inspector.ts`, `src/game/debug/ShipShowcase.ts`, and existing `src/game/scenes/fixtures.ts` showcase registration.

Verification/documentation: `tests/ship.spec.ts`, `tests/ship-loading.spec.ts`, `tests/ship-asset.spec.ts`, `tests/support.ts`, `tests/controls.spec.ts`, `tests/production.spec.ts`, `tests/journey.spec.ts`, `playwright.config.ts`, `package.json`, `README.md`, `AGENTS.md`, `.gitignore`, and this note. Prior Manta files and original ship implementation remain intact.

## Full-route validation and promotion

The real-time keyboard-only journey passed with STRIX selected: all five phases, enemy destruction, player damage, core victory at simulation time 136.03 seconds, score 3,700, 40 shields remaining. Sampled FPS was 60 after startup, with 66–98 draw calls at the sampled combat points; victory snapshot had 81 calls and 8,422 triangles. No scene changes, state mutations, or accelerated simulation were used during progression. Evidence retained in `.logs/strix-review/journey-results.json` and `mission-victory.png`.

The long journey's duplicate trace screencast caused a recording backlog on this host. Its trace now retains API events, DOM snapshots, and sources without duplicate screenshots; failure video and explicit outcome screenshots remain enabled. All gameplay assertions are unchanged. A clean rerun passed in approximately 2.4 minutes. Earlier interrupted runs and WebGL-initialization failures are not counted as passing validation. The asset check also caught GLTFExporter emitting translation matrices instead of explicit TRS fields: export now requests `trs:true`, leaving geometry and gameplay unchanged. On this host auto-started Vite teardown stalled after the short test run; final runs reuse explicitly started dev/preview servers.

Only after visual refinement, ordinary gameplay/loading checks, and the complete route passed was the default changed to STRIX. Explicit `?ship=legacy` and automatic failure fallback remain implemented. Local changes have not been committed or pushed by this implementation phase.

## Final verification results

- `npm run ship:build`: regenerated the GLB successfully.
- `npm run build`: TypeScript and production bundle passed; bundle-size warning documented above.
- `npx playwright test tests/journey.spec.ts --project=game`: 1 passed (the complete unaccelerated keyboard sortie).
- `npx playwright test --project=game --grep-invert 'full real-time'`: 23 passed in 1.1 minutes after default promotion. Covers all fixtures, collision/damage/scoring, steering, pause/restart, inspector, asset structure, failed/delayed loads, ship dimensions, controls, and repeated scene resets. The separately completed journey was excluded only to avoid duplicating that 136-second run.
- `npm run test:production`: build passed, then 2 tests passed; default STRIX loaded in production with no inspector, and explicit legacy remained playable.
- `npm run ship:inspect`: final six views plus empty flight and actual mission firing captured; no unexpected console/page errors.
- `git diff --check`: no whitespace errors (Windows line-ending warnings only).

Machine-readable summaries are retained outside Playwright's overwritten output directory: `.logs/strix-review/{journey-results,game-results,production-results}.json`. Screenshot artifacts are local/ignored; the reproducible generator, GLB, tests, and documentation are source files. Vite is running on localhost:5173 and production preview on localhost:4173.
