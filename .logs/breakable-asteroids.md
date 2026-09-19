# Breakable asteroids — 2026-09-19

Approved first phase implemented: destructible hazards and modest points, not pickups/power-ups. Existing uncommitted work preserved; no commit/push/deployment.

## Implementation

- `src/game/asteroids.ts`: reusable kind definitions, durability, base points and reserved null drop metadata. Fractured: four hits, 40 base points; solid: indestructible, zero reward. Rewards are 30/40/50 across Relaxed/Standard/Veteran.
- Mission debris pairs contain one fractured and one solid rock, alternating sides. Existing positions, radii, speeds, central safe gap and RNG consumption remain unchanged. Decorative environment rocks never enter combat/targeting/scoring.
- Swept player-shot collision handles durability, hit flash, once-only destruction/reward and cleanup. Intact rocks retain existing collision damage. Destroyed rocks cannot collide later in the same step or block later shots. Solid rocks still absorb player shots. Missing a rock awards nothing.
- Shared pale rough material and dark fracture edges distinguish shootable rocks from solid rocks and distant scenery. Breakable rocks participate in the existing reticle lock. The existing 120-particle pool emits ten non-colliding, rock-colored fragments per destruction. No new textures, audio assets or pickups.
- Inspector exposes hazard IDs, kind, position, radius and durability. Events: asteroid-hit, asteroid-destroyed and existing score-awarded. Fixtures: asteroid-targets and mixed asteroid-field.
- All current leaderboard modes use revision 4. Five previous boards remain in the archive with their original score validation/multipliers. New score quantum uses the common divisor of enemy/asteroid points; server envelope includes up to 11 debris-phase rewards. No SQL migration, no deletions. Local API restarted and revision-4 GET verified. Deploy client/server together when publishing.

## Verification

Baseline state, screenshot and errors inspected before edits. Build passed (707.87 kB JS / 185.61 kB gzip; existing chunk-size warning). 14 backend/storage checks passed including online acceptance of asteroid-inclusive scores in all three modes. Four deterministic difficulty simulation checks passed, preserving debris locations. Final 24 asteroid/control/difficulty UI checks passed. Six production smoke checks passed, including current/archive navigation and inspector exclusion.

The full unaccelerated Standard keyboard journey passed: actual mission start, all five phases, asteroid destroyed during debris passage, core victory at 135.78 seconds, score 3,840, shields 44. No state mutations or fixture switching substituted for route progression. Touch emulation auto-fire destroyed the aligned fixture asteroid at 100 shields. Repeated/simultaneous-hit tests verify one reward and subsequent shots reaching an enemy behind the destroyed rock. Reset restores durability and zero score.

Desktop/mixed-field and touch screenshots inspected. Reticle lock was added after initial screenshot review for clearer shootability. The dense fixture adds eight line draws for eight fractured rocks; triangle count is unchanged by seam lines. At three seconds the mixed field measured 60 FPS, 40 draw calls and 7,784 triangles; earlier near-startup samples were 47–51 FPS. Final route snapshot: 60 FPS, 55 draws. No captured console/page errors. These are this Windows Chromium host's measurements, not actual-phone performance claims.

Artifacts: `.logs/leaderboard-review/asteroids/` (initial visuals), `asteroid-final/` (regressions/screenshots/inspection JSON), `asteroid-journey/` (full-route victory), `asteroid-production/` (production). Generated artifacts remain ignored. Human phone testing and broader reward/difficulty feedback are recommended before public deployment.
