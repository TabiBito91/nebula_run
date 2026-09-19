# Private feedback rollout — 2026-09-19

Implemented the approved first rollout without committing, pushing, or deploying. Prior uncommitted difficulty, leaderboard, Veteran and asteroid work was preserved.

UI: reusable native dialog from title/pause/results; 1,000-character message, category, optional difficulty feeling, disclosed versioned context, live status, explicit draft discard, no gameplay hotkeys, paused mission stays paused. Failed drafts remain in memory and retries freeze the same ID/body. An 8-second timeout bounds pending sends. Mobile short-screen refinement adds compact spacing and sticky actions; success uses Done rather than Cancel.

Storage: private `game_feedback` table with review status/notes; no read API. Existing PostgreSQL connection and local SQLite fallback reused. Additive startup schema, validated portable JSON text, bounded body, origin checks and rate limits. Opportunistic 180-day expiry; no raw network identifier in feedback. See FEEDBACK.md for private review queries and future-level integration.

Verification: inspected the running title screenshot and browser errors before edits. Build passed; 18 backend/storage checks, 6 control regressions, 4 final feedback browser checks, and 7 production checks passed. Backend tests cover duplicate races, conflicting ID reuse, Unicode, malformed/oversized payloads, privacy, origins, throttling, expiry and storage reopen. Browser tests use real form input against an isolated API/database. A deliberately dropped acknowledged response was retried and created one record; only its exact expected network/console errors were excluded from the unexpected-error audit. Production form successfully stored feedback without inspector support.

Desktop and landscape touch-emulated screenshots inspected; final captures and inspection state under `test-results/feedback-final/`. No gameplay balancing, ship, audio or leaderboard records modified by the feature. Local API restarted with the new endpoint; GET correctly rejects access. Local database and development server remain available.

Limitations: no live Replit/PostgreSQL verification or physical-phone software-keyboard check performed. Database review uses SQL/tools, not a dashboard. Anti-spam is basic network throttling, not bot-proof. Retention cleanup runs on submissions, not a scheduled deadline. Build still reports the existing >500 kB chunk warning; final JS approximately 713.77 kB / 187.44 kB gzip (about +5.9/+1.8 kB versus the previous asteroid build).
