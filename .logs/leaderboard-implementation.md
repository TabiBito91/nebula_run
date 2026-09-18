# Online-first leaderboard implementation

The previous return-to-menu changes were committed first as `a33d742` (`Add confirmed return to main menu`). New work is isolated on `codex/online-leaderboard`; nothing was pushed, merged or deployed.

## Architecture and scope

`src/game/leaderboard/` owns versioned shared validation/ranking, bounded local storage, online requests, guest identity and modal/result UI. `Game` registers eligibility only on a normal Start/Restart, clears it on scene replacement/abandon, and observes terminal results once. Fixtures never register eligibility. No changes to ship, rendering, audio synthesis, combat systems, progression or scoring values.

Generated PILOT-XXXXXX callsigns avoid free-form offensive names; they are explicitly not verified identities. Local recording is automatic; public sharing requires clicking the result-screen button. Network work is asynchronous, bounded by four-second request timeouts, and cannot change the flight result. Started-offline runs remain local. No silent synchronization of old records.

`server/` uses Node HTTP, a PostgreSQL pool for deployment, and isolated SQLite for local development/tests. Persistent tickets, conditional score writes, server-side expiry, version/range/timing checks and database-backed rate limits protect against duplicate submissions and obvious abuse. Bearer ticket hashes, not raw tickets, are stored. The public API never returns those hashes. Operator-only reversible hide/restore uses a private CLI. This is not authoritative anti-cheat; plausible fabricated scores remain possible.

Vite proxies /api in development. `npm run dev` supervises Vite and the API; `npm start` explicitly enforces production database/origin/secret configuration. The server also serves the built static assets. Runtime databases and reports are excluded from Vite watching: Windows produced EBUSY when a newly copied report was watched, stopping the dev server. Re-running the inspection after this exclusion succeeded while writing new report/screenshot files.

## Verification

- Baseline menu screenshot, inspector state and errors inspected before editing.
- `npm install pg`: succeeded with zero reported audit vulnerabilities. No external database service or credentials were accessed.
- `npm run test:leaderboard`: 10 passed, covering ticket lifecycle, duplicate/conflicting/concurrent submissions, forged/invalid/expired/version-mismatched payloads, rank ties, rate limiting and forwarded-IP spoof resistance, database failure, SQLite restart persistence, production startup refusal, and local corruption/denied storage.
- 14 Playwright tests passed (2.8 min): controls, menu lifecycle, online/local UI, fallback, fixture/abandon exclusions and a real unaccelerated keyboard sortie through the actual HTTP backend plus isolated SQLite database. The first submission acknowledgement was replaced after actual acceptance; retry reused the same payload and produced exactly one database row. Reload retained exactly one local entry.
- Four production smoke tests passed (8.6 sec): startup/audio, inspector exclusion, original ship fallback and ignored development settings.
- Final expanded production suite: five passed, including the built client opening the online board against an isolated actual Node HTTP server/SQLite database with no inspector. The new service test explicitly opts out of the unrelated-tests offline API mock. An old preview process also returned HTML for /api, so the isolated server avoids dependence on its stale proxy configuration.
- Five final focused music/UI tests passed (13.7 sec). One earlier UI test expected Enter to launch immediately after closing a dialog; normal focus restoration correctly re-opened the focused Leaderboard button. The test was corrected to activate Launch explicitly; no game assertions were relaxed.
- Browser screenshots exposed overlapping status wording and an overly tall result card. The list status now identifies local top 10, and result controls/spacing were compacted.
- After layout refinement, the actual-backend real-sortie test passed again (2.1 minutes); final result screenshot is fully framed at 1280×720. An explicit artifact-write/reload regression test also passed, confirming Vite remains available while generated reports are written.
- Representative capture with `node tools/inspect-leaderboard.mjs`: 60 FPS, 46 draw calls, 7,864 triangles during firing at three mission seconds, no captured browser errors. This is a host-specific sample, not a universal performance claim. No rendering resources/textures were added.
- Production client before layout refinement: 688.20 kB JS / gzip 179.41 kB, approximately +9.44 / +2.78 kB over the menu checkpoint. Existing large-chunk warning remains. PostgreSQL client dependencies execute only on the server.

Artifacts: `.logs/leaderboard-review/` contains menu, online/local boards, real result screenshots, inspector/performance JSON and preserved test reports. Tests use isolated browser storage; the real integration test uses an in-memory test database, not the user's development records.

## Remaining deployment verification

No local PostgreSQL executable/service or Docker was found, and no test database URL was provided. PostgreSQL driver/schema/query code is implemented but not integration-tested against a real PostgreSQL service here. Replit deployment, correct trusted proxy-hop count, HTTPS origin, production DB persistence, backups/cost limits and a public privacy/retention policy remain required before public release. See LEADERBOARD.md and .env.example. No claim of cheat-proof scores, verified identity, or public availability is made.

## Changed areas

Leaderboard frontend/shared rules; Game/Hud/Keyboard/inspector integration; server API/store/startup/moderation and tests; development supervisor and capture tool; Vite proxy/watch configuration; package manifest/lockfile; focused browser tests and explicit leaderboard isolation in unrelated test fixtures; README, LEADERBOARD.md, environment example, Git ignores and this log.
