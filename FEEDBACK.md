# Private player feedback

Available through **More → Feedback** on the main menu, pause menu, and results. Optional category and difficulty feeling; required message (1–1,000 characters). No account, name, email, screenshots, or logs. The dialog captures context when opened, keeps failed drafts in memory, and freezes attempted payloads for duplicate-safe retries. Escape/Cancel asks before discarding; pending sends cannot be dismissed. Success requires server acknowledgement. Reloading loses unsent drafts; there is no background upload queue.

## Architecture and future levels

- `src/game/feedback/Feedback.ts`: reusable dialog and `feedbackContext` adapter. Supply a level's stable ID and name when adding missions; do not clone the form. Context schema 1 contains build, level ID/name, difficulty, rules version, source screen, phase, elapsed time, and touch/keyboard mode. Touch means touch-play enabled, not necessarily the last physical input.
- `VITE_BUILD_ID` may be supplied during build (prefer a release or Git identifier). Otherwise the build gets a timestamp ID. It contains no secrets.
- `POST /api/feedback`: allowlisted validation, 8 KiB request cap, UUID submission IDs, body hash comparison, and five attempts per network bucket per ten minutes. Retries count toward the cap. Existing origin/proxy safeguards apply. This discourages spam but is not bot-proof; shared networks share limits.
- `server/store.mjs`: additive `CREATE TABLE IF NOT EXISTS game_feedback`, separate from rankings. Context is validated JSON serialized in portable TEXT (`context_json`), compatible with PostgreSQL and local SQLite. Parameterized queries; no public read/update endpoint. Feedback must remain plain text in any future dashboard.
- Retention: submissions older than 180 days are deleted on the next valid submission. This is opportunistic cleanup, not an exact deadline; schedule the same deletion query if strict expiry is needed. Rate-limit hashes are temporary and are not linked to feedback rows. Infrastructure providers may have their own request logs.

## Replit publishing and review

Publish frontend and backend together. Existing PostgreSQL configuration is reused; no new secret or database is required. Startup creates only the new table/index and leaves scores intact. Test first against a non-production database. Local tests use SQLite; live Replit PostgreSQL verification is still required after deployment.

Review `game_feedback` through private database tools. Fields: `id`, `category`, `message`, `feeling`, `context_json`, `created_at` (Unix milliseconds), `status`, `private_notes`. Only authorized collaborators should have database access. Do not expose credentials or this table through a public API.

Example read-only PostgreSQL query:

```sql
SELECT id, to_timestamp(created_at / 1000.0) AS received,
       category, message, feeling, context_json::jsonb AS context,
       status, private_notes
FROM game_feedback
ORDER BY created_at DESC
LIMIT 100;
```

Filter by `context_json::jsonb ->> 'levelId'`, `'build'`, `'difficulty'`, or `'controls'`. Valid statuses: `new`, `reviewed`, `planned`, `resolved`. Reviewers may deliberately update a chosen row's status/private_notes in database tools. No dashboard, notifications, or public voting in this rollout.

## Checks

`npm run test:leaderboard` includes backend feedback tests. `npx playwright test tests/feedback.spec.ts --project=game` tests forms against an isolated server/database, lost-response retries, pause/input isolation, results, and mobile layout. Artifacts are in `test-results/`. Real phone keyboard behavior and live PostgreSQL publishing should be checked before release.
