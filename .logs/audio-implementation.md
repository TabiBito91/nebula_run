# Audio implementation

Branch: feature/game-audio, based on approved 457af80 (including dynamic background and crash recovery). Scope approved after Phase 1 inspection. No environment/ship/combat redesign.

## Music and controls checkpoint

Native Web Audio manager owns a single gesture-unlocked AudioContext, music and SFX parent gains, seven category buses, compressor and output meter. Buffer caching and bounded source ownership keep looping audio unique. Music prepares one procedural track per task; no network assets are required. Asset definitions and replacement URLs are centralized. External-load failures fall back to generated buffers.

Music states derive from status, actual threats and core presence. Combat remains for at least eight mission seconds and four quiet seconds. Crossfades take two audio seconds. Pause preserves music offset and retires transient/engine voices; resume creates one new music source at the saved offset. Hidden documents suspend the context. Scene generations cancel old playback and reset transition history.

Controls add a small Audio panel with master/music/SFX volumes and mute. Defaults: .8/.35/.7. Settings use a versioned localStorage key with validation and storage-failure tolerance. Audio panel keyboard input does not steer/fire/pause gameplay; focusing it clears held controls.

Initial build and two music tests passed: no context before interaction, settings survive reload, sliders do not steer, mute works, pause offset remains frozen and repeated scene resets do not duplicate music. All audio assets are temporary; see public/audio/ASSETS.md.

## Effects, mixing and review

AudioSession consumes each simulation event once without changing simulation or combat timing. The 19 effects cover player/enemy fire, hit/shield feedback, small/core explosions, engine, targeting confirmation, critical shields, core introduction, launch/UI/pause/resume/end cues, and dev-only dodge/boost previews. No dodge, boost, homing weapon, hull-health pool or pickup mechanic was introduced. Shield-only damage is preserved.

Sources share cached buffers; transient nodes are cleaned on completion. Limits: 28 voices including retiring voices, four reserved slots for high-priority feedback, per-sound/category limits and cooldowns, one engine loop, at most two crossfading music voices. Critical cues remain centered; other panning is clamped to ±0.55. Music ducks gently for damage, warnings and major events. The manager starts only after the renderer succeeds and isolates audio exceptions so silent gameplay remains available.

The final refinement softens repeated weapon timbre/noise, reduces routine hit gain to 0.12, scales the engine from its centralized gain, and fixes percentage labels overflowing the settings panel. Scene-generation reset also clears previous combat hysteresis. Defaults remain master 0.8 / music 0.35 / SFX 0.7. There are no new runtime packages or audio network downloads.

## Measured performance and artifacts

Windows Chromium, ANGLE D3D11, 1280×720; host-specific samples, not a hardware-independent guarantee. Review command: `node tools/inspect-audio.mjs`. Artifact directories `.logs/audio-review/first-pass/` and `.logs/audio-review/final/` contain `inspection.json`, screenshots and `review-mix.wav` / `review-mix.webm`.

- Matched empty-flight baseline and enabled audio both sampled 60 FPS, 26 draw calls, 7,624 triangles. Audio adds no rendering objects or textures.
- Representative audio scenes sampled 60 FPS, 26–66 draw calls, 7,624–10,924 triangles; differences reflect fixture gameplay entities, not audio geometry.
- All 25 prepared mono buffers: 7,292,372 bytes (6.95 MiB). Observed maximum at sampling points: eight voices, below the hard limit of 28.
- Browser-reported base latency 10 ms and output latency 40 ms; these are not an acoustic end-to-end latency measurement. Weapon test measures dispatch from the actual Space key event and requires less than 150 ms.
- Final 26.52-second captured output: peak 0.2578, RMS 0.0180, zero clipped samples. First-pass peak 0.2757. These measurements establish headroom for the sampled mix, not perceptual mastering quality or every possible volume combination.
- Representative capture: no console/page errors and no failed loads. Failure fixtures deliberately exercise fallback and are asserted separately.
- Production JS 677.12 kB / gzip 176.12 kB versus pre-audio 655.70 / 169.44 kB: approximately +21.42 / +6.68 kB. Existing Vite large-chunk warning remains.

Manual keyboard play and screenshots verify visual synchronization paths and panel behavior. Automated checks verify state/event timing, looping source continuity and failures. The available tools cannot audition audio, so no claim is made that headphones, speakers, perceptual loop seams or warning intelligibility have been heard and approved. The captured mix is provided for that listening review. Final 90–180-second music and a headphone/speaker/mono mix pass remain recommended before production release.

## Files and ownership

- `src/game/audio/{AudioManager,AudioSession,manifest,procedural,settings}.ts`: centralized audio, event adapter, authored temporary assets and settings.
- `src/game/ui/{AudioControls.ts,audio.css}`: scoped settings panel; `src/game/input/Keyboard.ts`: prevent panel inputs from steering.
- `src/game/Game.ts`: lifecycle integration only.
- `src/game/debug/{inspector.ts,AudioFixtures.ts}` and `src/game/scenes/fixtures.ts`: development inspection/capture and 13 repeatable scenes.
- `tests/audio*.spec.ts`, `tests/production.spec.ts`: browser regression tests.
- `tools/inspect-audio.mjs`: repeatable capture and metrics.
- `public/audio/ASSETS.md`, `README.md`, this log and `.gitignore`: rights/replacement/usage/verification documentation and artifact exclusions.

Ship models, rendering/environment, combat systems and balance are unchanged. All temporary assets and their common original-source rights status are individually enumerated in `public/audio/ASSETS.md`. Missing final files are intentional placeholders, not unlicensed external recordings. Keep both audio commits local until user review; do not push or merge.

## Final verification record

- `npm run build`: passed on final source.
- Full `npm run test:e2e`: 51 passed, one journey failure. The automated pilot exhausted shields at 93.42 seconds after taking debris damage; samples showed 60 FPS after startup and no captured errors. Preserved original artifacts under `.logs/audio-review/full-suite-first/`. This is not a clean full-suite pass.
- Unmodified `tests/journey.spec.ts` rerun: Playwright reported the keyboard sortie passed in 2.3 minutes, including all five phases and victory. The runner subsequently stalled in cleanup without producing its final report; it was interrupted after several minutes. No assertions or game parameters were changed. Investigate the intermittent pilot outcome/runner teardown separately if it recurs; this audio phase does not claim to fix them.
- Final focused effects/failure tests: 19 passed (1.6 minutes), including the added scene-reset hysteresis regression. Final music/control tests: two passed (6.6 seconds). JSON results are preserved in `.logs/audio-review/final-effects-results.json` and `final-music-results.json`.
- `npm run test:production`: four passed (7.5 seconds), including real gesture unlock, persisted audio settings, absent inspector and ignored fixtures. Production bundle scan contains no audio fixture/capture inspector names. Results: `.logs/audio-review/production-results.json`.
- Representative output recording and screenshots completed twice. In-app keyboard launch/fire/steering and audio-panel inspection completed; the retained browser tab is restored to the main menu for review.
