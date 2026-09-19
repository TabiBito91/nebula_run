# Separate local name saving and online sharing

## Inspection

The user's current results screen showed a Relaxed victory with 4,200 points and confirmed online sharing under the generated name. Browser error logs were empty. The prior implementation saved local records before editing, did not rename them, and rebuilt the input during status changes. The current investigation cannot reconstruct the exact original edit/submit sequence; these failure paths are addressed without rewriting published scores.

## Implementation

- Explicit Save name validates the current draft and renames only the current local entry, preserving score, difficulty/version, ID, outcome and date. No network submission occurs on save.
- Draft state lives with the run; result controls update in place so async registration/status changes preserve text and focus.
- Sharing requires an explicitly saved name and available run registration. Subsequent edits disable sharing until saved again.
- A submitted name locks immediately before POST; uncertain responses expose Retry sharing with identical payload. Confirmation selects the online tab for the next leaderboard opening.
- Offline/session-only/outside-top-ten/cleared-record states are distinguished. Existing publicly submitted names remain immutable; no backend or database schema changes.
- Retries are limited to the current results screen. No bearer tickets are persisted, and no arbitrary editing of published entries was added.

## Tests

Local storage tests include validated rename, preservation of other fields, reload persistence, and rejecting unknown IDs/invalid names. Isolated component browser tests cover delayed registration without draft/focus loss, invalid draft retention, local-only saving and repeat editing offline, and locked identical retry. The existing unaccelerated real-keyboard sortie test now explicitly saves the custom name, verifies local storage, submits it to an isolated real API/SQLite store, retries an ambiguous acknowledgement, and checks both reload persistence and online display.

An initial intercepted-HTML component harness triggered Chromium local-network WebSocket restrictions for Vite HMR. The harness was moved to a real Vite-served test HTML file (not included in production); no browser safety checks or error assertions were disabled.

Generated screenshots/traces/reports are under `.logs/leaderboard-review/`. No public score was submitted or altered during automated verification. No Git push or deployment is included.

## Verified results

- `npm run build`: passed; existing large-chunk warning remains.
- `npm run test:leaderboard`: all 13 backend/local-storage tests passed.
- Combined leaderboard and first three name-component tests: all 8 passed, including the 2-minute real keyboard sortie and isolated API submission/retry/reload flow.
- Final component run including blocked browser storage: all 4 passed.
- Production smoke: all 6 passed.
- Inspected the real results screenshot showing `Nova Pilot_7`, explicit local/online confirmation and locked submitted name. Browser audits reported no unexpected errors in passing runs.
- Screenshots: `name-save-verified/leaderboard-real-sortie-re-e2af6-safely-and-persists-locally-game/leaderboard-result.png` and `leaderboard-online.png`; component screenshots are under `name-save-components-final/`.

The real sortie used unchanged gameplay and ended in defeat; the isolated component test exercised a victory result. Both use the same result/name-saving adapter. Actual mobile hardware testing and Replit deployment were not performed.
