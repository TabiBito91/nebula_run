# Veteran patterns — 2026-09-18

Scope: approved reusable attack-pattern recommendation. No ship, player controls, weapon strength, shields, enemy health, music, environment or Relaxed/Standard balance changes. Existing uncommitted difficulty and explicit-name-save work preserved. No commit, push or deployment performed.

## Architecture and tuning

- `attackPatterns.ts`: serializable sequences and shared pattern timings; `systems/attacks.ts`: fixed-step execution; `scenes/encounters.ts`: level-specific assignments. Future levels reuse patterns and select their own sequences.
- Gunners fire three-shot aimed bursts with capped prediction, never homing. Selected sweeping formation leaders and core escorts fire five-shot fans aimed at the warning-time position. Core alternates bursts and seven-shot horizontal sweeps across the warning-time row.
- Warnings are 1.0–1.2 seconds. Starts are separated by at least 0.8 seconds; at most two enemies prepare/fire at once. Maximum 48 live hostile projectiles, within the existing total cap. Enemies inside 24 units cancel attacks. Collections remain bounded and randomness unchanged.
- Warning shapes are rings, spread ticks and horizontal ticks. Screenshot refinement enlarged tick thickness/length and introduced a thicker, lower-triangle shared warning ring. Existing shared resources are disposed normally.
- Fixtures: `veteran-enemy-fire`, `veteran-enemy-wave`, `veteran-final-encounter`. Inspector exposes complete detached attack state and active attack count.
- Current Veteran board is `signalbreak-3-veteran`. `signalbreak-2-veteran` remains readable with its original 1.25 multiplier, but rejects new registration. No SQL migration. Client/server must deploy together. Local API restarted and current board GET verified.

## Verification and findings

Build passed with the existing >500 kB bundle warning (702.07 kB JS, 184.04 kB gzip). Backend/storage suite: 13 passing, including old Veteran reads and rejected registration. Simulation/pattern/name regression suite: 13 passing. Standard controls: 6 passing. Difficulty UI/score partitions/core restart: 9 passing. Desktop warning/attack checks: 3 passing after visual refinement. Touch fan-dodging check: passed at 100 shields with real CDP touch drags and auto-fire, no simulation mutation.

The old coarse keyboard pilot lost at 120.25 seconds. An active keyboard pilot traversed all phases and won at roughly 130 seconds with score 7,125 and 52 shields. That attempt stalled in browser cleanup after all gameplay assertions and navigation away; it is retained as an interrupted runner attempt, not a clean suite pass. Frequent observations were trimmed to relevant gameplay fields and the final rerun uses trace recording disabled, without weakening gameplay assertions.

Early touch scripts were hit because they returned to the row targeted by a previous fan still in flight. The passing script moves to a fresh row earlier; no attack tuning or invulnerability was weakened to obtain that pass. Failure traces/screenshots remain in `.logs/veteran-review/` and `.logs/veteran-regression/`.

Short desktop samples: 54–60 FPS, 34–61 draw calls, 3,898–8,672 triangles (different scene/time samples, not controlled maxima). Passing touch emulation sample: 60 FPS, 71 draw calls, 8,696 triangles, 10 hostile shots. Captured console/page errors were empty. These are this Windows Chromium/D3D11 host's measurements, not phone hardware guarantees.

Real iPhone/Android playtesting and broader human difficulty tuning remain recommended. A coordinated formation fixture intentionally stresses more attacking sweepers than an ordinary wave. Historical Veteran scores are not migrated into the harder current board.

## Final keyboard rerun

The isolated full Veteran journey passed cleanly in 2.3 minutes wall time: mission complete at 130.10 simulation seconds, 7,750 points, 40 shields, all five phases observed, enemy destruction and mission completion verified, no captured errors. It used actual keyboard controls throughout, no state changes, time acceleration or scene switching during the sortie. Startup sample was 27 FPS; each 10-second sample thereafter was 60 FPS, 41–79 draw calls. Screenshot: `.logs/veteran-review/journey-final/journey-veteran-full-real--80a3c-ore-and-restores-the-signal-game/mission-victory.png`.

Passing touch screenshot: `.logs/veteran-review/touch-final/veteran-visual-touch-Veter-53578-auto-fire-remains-available-game/touch-veteran.png`. Refined warning and attack screenshots: `.logs/veteran-review/refined/`.

All six production smoke tests passed (difficulty/HUD lock, audio, inspector/fixture exclusion, legacy ship fallback, environment fixture exclusion, and leaderboard). Across the final relevant suites, 52 checks passed. `git diff --check` had no whitespace errors. Existing generated artifacts are ignored; verification notes are retained as source documentation.
