# Leaderboard UI cleanup — 2026-09-18

Approved recommendation implemented locally; existing uncommitted work preserved. No commit, push, deployment, score deletion, data migration or combat changes.

## Behavior

- Ranking selector defaults to Relaxed, Standard and Veteran. Archived rankings is a small adjacent link, not another default option. Previous Standard/Veteran records remain accessible under friendly Previous rules labels and a read-only notice, both locally and online. Returning restores the last selected current board; reopening starts at the current sortie difficulty.
- Results retain one Save score button and a compact status instead of the inline name/save/share form. A native modal offers Display name, an unchecked public-sharing checkbox, Cancel and Save. Saves locally first; only explicit consent triggers the existing online submission path.
- Cancel/Escape preserves an unsaved draft without applying or publishing it. Reopening resets unsubmitted consent. Once a POST is attempted, the original name/payload stays locked for identical retries. Closing a pending submission is explicitly labeled Close and does not imply cancellation of an already-authorized request.
- Async updates do not replace focused inputs. Modal keyboard guards prevent R from restarting the sortie; native focus trapping and focus return are preserved. Offline/blocked storage/top-ten exclusion messages remain truthful. One dialog is reused and disposed with the leaderboard.

## Files

Runtime: `src/game/leaderboard/Leaderboard.ts`, `leaderboard.css`, `rules.ts`, and `src/game/input/Keyboard.ts`. Tests: score-name component/harness, difficulty archive checks, real leaderboard journey and production smoke. README and LEADERBOARD instructions updated.

## Verification

- Inspected initial game state, screenshot and errors before edits.
- Build passed; existing large-JS-chunk warning remains (704.91 kB JS / 184.69 kB gzip).
- 13 backend/storage tests passed; 16 focused difficulty/UI/name tests passed.
- Five leaderboard tests passed, including a real, unaccelerated keyboard sortie into results, modal keyboard isolation, local rename, consented submission, ambiguous acknowledgment/retry, exactly one database row, online display and persistence after reload.
- Six production smoke tests passed, including current/archive navigation with no inspector.
- Desktop and landscape touch-emulation screenshots inspected; no horizontal overflow, Save reachable. Refined archive-link placement beside the selector and clarified in-flight submission wording. No unexpected captured console/page errors. `git diff --check` passed (only normal CRLF notices).
- Early tests needed status/button locators scoped to the new modal because the results screen also has a status. Assertions were retained, not weakened.

Artifacts (ignored generated files): `.logs/leaderboard-review/compact-refined/` (current/archive, mobile dialog, focused checks); `compact-journey/` (compact results, online record, real sortie); `compact-production/` (production checks). Actual phone hardware and deployed Replit/PostgreSQL were not used; online integration used an isolated test database, not public score submissions.
