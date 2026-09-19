# Difficulty implementation — 2026-09-18

## Scope and design

Three fixed-per-run presets in `src/game/difficulty.ts`: Relaxed, Standard, Veteran. Standard retains original movement, firing, enemy health, spawn schedule, damage, scoring and geometry. Relaxed uses 0.8x hostile projectile speed, 1.4x firing intervals, 0.75x incoming damage (rounded at damage application), and a mission cap of one gunner; excess gunners become straight attackers. Veteran uses 1.15x hostile projectile speed, 0.85x firing intervals, and 0.18 seconds of bounded, non-homing prediction. Alternate waves in patrol/defense/core phases add one existing attacker; concurrent mission gunners are capped at three. No extras in departure/debris. The 0.7-second telegraph window is unchanged.

Player controls, weapon, collision sizes, ship, environment, audio, health pools, enemy HP and 150-second deadline are unchanged. Points are multiplied exactly once, per destruction: 75/150/1500 for Relaxed; 100/200/2000 Standard; 125/250/2500 Veteran (basic/gunner/core).

The menu selector is accessible by label and retains native focus when changing options. Pause/results show the mode and explain that its multiplier is already included. Choice survives restart and return to menu, not page reload. Shared state exposes immutable-at-TypeScript-level difficulty and detached inspector tuning; no production inspector or test setters were added.

## Leaderboard compatibility

Existing database `version` column partitions current boards (`signalbreak-2`, `signalbreak-2-relaxed`, `signalbreak-2-veteran`) and legacy (`signalbreak-1`). No schema migration, row deletion or database reset. Legacy is read-only. Mode/version is bound to registration tickets and checked at submission. Validation accounts for score increments, core minimum, and generous mode-specific score envelopes. Scores remain client-reported casual competition, not cheat-proof.

Local storage key is unchanged; valid legacy scores survive. Ten records retained per board, with personal best computed within the same partition. Online/local filters use the same board list. Old APIs cause local fallback, so client and server must deploy together. PostgreSQL deployment not performed here; API tests exercise SQLite through the shared store interface.

## Inspection and verification

Before edits: browser state ready at menu, STRIX loaded, no captured/browser errors; 26 draw calls and 7,592 triangles. Inspected title screenshot.

First focused batch: 23 passing Playwright tests covering movement, combat, pause, menus, touch, difficulty tuning/schedules, mode selection/first kills, final encounters, restarting, and local score filters. Desktop and 844x390 touch screenshots inspected. A refinement preserved selector focus and clarified Relaxed's description as fewer *gunners*, not fewer total enemies.

Final UI rerun: all nine difficulty UI tests and four short leaderboard regressions passed. Production build passed (697.01 kB JS / 182.34 kB gzip, existing chunk-size warning); all six production smoke tests passed, including difficulty selection/HUD lock, audio, ship fallback, fixture exclusion and real API board reads. `git diff --check` reported no whitespace errors.

Backend/storage suite: 13 passing tests, including ticket difficulty binding, board isolation, legacy reads, score increments/core minimums, per-board top ten and personal best, plus existing validation/rate-limit/idempotency tests.

Standard full keyboard journey passed: victory at about 136 seconds, score 3,800, 60 shields. Veteran full keyboard journey passed: victory at 135.43 seconds, score 5,375, 24 shields. Relaxed full keyboard journey passed: victory at 136 seconds, score 2,850, 70 shields. Same keyboard steering policy, no accelerated time, scene switching, or state setters during a route. Veteran samples after startup were 60 FPS, 43–76 draw calls (sampled, not guaranteed maxima); Relaxed also sampled 60 FPS after startup, up to 69 draw calls. Veteran's initial startup sample was 33 FPS. These are this host's Chromium results, not a mobile hardware guarantee.

One combined run stalled on the next browser startup after a roughly hour-long wall-clock interruption; its trace showed a 3,990-second asset wait and aborted ship load, not a combat exception. The affected test process tree was stopped; remaining full journeys were rerun in fresh browser processes. Artifacts from that interrupted attempt were retained, not treated as a pass.

A second host interruption occurred during the full leaderboard regression: score acceptance/idempotent retry and persistence assertions had completed, but the final reload encountered `ERR_NETWORK_IO_SUSPENDED` for development modules and exceeded the test timeout after a 25-minute wall-clock run. This attempt remains a failure in `final-checks-report.json`; an isolated fresh-browser retry is recorded separately. No assertions or timeouts were weakened.

The isolated full leaderboard retry passed in 2.0 minutes: real keyboard sortie, result saved once locally, custom public name, ambiguous acknowledgement retried idempotently, exactly one database row, reload persistence and online display. Report: `online-retry-report.json`; artifacts under `online-retry/`. Local Vite/API were restarted and the running API was confirmed to serve the new Veteran board. No public score submissions were made by these tests.

Screenshots, inspection JSON, route observations and reports: `.logs/difficulty-review/` (ignored generated artifacts). Human verification notes remain tracked here.

## Remaining limitations

Balance is an initial tuning pass, not a broad playtest study. Actual iPhone/Android playtesting and production PostgreSQL/Replit smoke tests remain necessary. No new enemy archetypes, adaptive difficulty, mid-run difficulty changes, difficulty persistence, or server-authoritative anti-cheat are included. Existing build-size warning remains. No push or deployment is part of this change.
