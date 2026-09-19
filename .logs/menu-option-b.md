# Option B menu cleanup

Implemented approved More-menu concept without changing game visuals, simulation, audio engine, score submission, or feedback storage. No commit/push/deployment.

- Main menu keeps Launch and Leaderboard. More contains Audio and Feedback; duplicate Leaderboard hidden.
- Pause/results More includes Audio, Leaderboard, Feedback. Existing in-flight Audio shortcut retained. Results keep Fly Again, Save score (real recorded sorties), and quieter Main Menu. Separate score dialog unchanged.
- Shortened difficulty summary; gameplay telemetry and redundant pause button hidden in menus. Desktop keyboard hint is on its own line; touch results hide it. Existing difficulty description remains associated with its selector but is visually hidden on title.
- Dropdown supports native buttons/Tab, Escape with focus return, click-outside dismissal, 44px touch targets. Audio panel has explicit Close audio. Feedback and leaderboard retain modal focus/input protection.

Before/after running-game screenshots inspected. Refinement fixed hidden-item CSS specificity and removed the header mission tag in menus. Added menu layout tests and updated existing navigation tests to follow More rather than obsolete direct buttons. A test initially interrupted by a development hot reload was rerun unchanged and passed in the clean 29-test regression run.

Verification: build passed; 29 browser regressions passed including keyboard combat/core win, touch/audio, feedback persistence/retry, actual unaccelerated mission score/name saving, ambiguous online retry and local persistence. Seven production checks passed. Final layout screenshots/inspection JSON are in `.logs/leaderboard-review/menu-b/` (ignored artifacts). No physical-phone validation performed. Existing bundle-size warning remains.
