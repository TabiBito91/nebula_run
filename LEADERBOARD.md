# Casual leaderboard / deployment guide

This is a casual, browser-reported board, **not a cheat-proof competitive service**. No deployment, database provisioning, push or merge is performed by adding this code.

## Player experience

Main menu and result screens offer Leaderboard. Online top 25 is the first view; a failed/unconfigured service switches to the local top 10. Local records survive reload when browser storage is available. Storage failures retain an in-memory list for the session. Corrupt and wrong-version entries are ignored. Clear local scores requires confirmation and does not affect online entries.

Only sorties launched through the normal Start/Restart lifecycle qualify. Development fixtures, including mission-start, never record or submit. Returning to the main menu abandons the run. A finished real sortie is recorded locally once. **Save score** opens a name dialog with an unchecked public-sharing checkbox. **Save** updates the local name and, only with consent, publishes that same name plus score, victory/defeat, elapsed simulation time and server-recorded submission date. Cancel preserves the draft without applying it or posting. Unconfirmed submissions lock their payload for idempotent retries. A display name is 3–16 characters using only letters, numbers, spaces, hyphens and underscores; leading/trailing or repeated spaces and a small reserved/abuse blocklist are rejected. There are no accounts or emails. Names are public guest labels, not verified identities, and can be hidden by an operator. Clearing browser storage can change the default callsign.

If registration failed at launch, the run is local only. There is no background upload queue and no automatic migration of old local scores. A valid run ticket permits safe submission retries while its result screen remains available. Leaving the result screen loses that ticket. Tickets expire two hours after registration; pauses count toward this server-side expiry. Score submission never alters the game result or blocks firing/movement.

Ranking: score descending, victories before defeats on ties, oldest server timestamp then run ID. Both ship variants participate because existing scoring is unchanged. Version mappings in `src/game/leaderboard/rules.ts` isolate balance/route changes. Bump the affected mode's version when its rules change. Local and online lists retain separate legacy Standard and Veteran boards, read-only for submissions.

## Run locally (Node 24.16 or newer)

`npm ci`, then `npm run dev` starts the API at 3001 and Vite at 5173. Vite proxies `/api` to the local API. Local development uses `.data/leaderboard.sqlite` (ignored by Git), never a production database unless you explicitly supply `DATABASE_URL`. If an old Vite process is already running, stop that task's server first; alternatively run `npm run dev:api` alongside it. `npm run build` creates the production client; `npm start` serves both `dist` and the API and enforces production configuration even if NODE_ENV was omitted. For a local built-client check with SQLite, use `node server/index.mjs` directly at port 3001. `npm run preview` alone previews Vite output and expects the local API on 3001 for online features.

Local browser storage keys: `nebula-run:scores:v1` and `nebula-run:callsign:v1`. They are origin-specific, so localhost and the deployed site have separate records. All database credentials stay server-side, never in VITE_* variables or browser code.

## Replit deployment (requires your separate approval/setup)

1. Import the intended GitHub branch after approving its push. Use a backend-capable deployment such as Autoscale, not Static-only hosting.
2. Configure Node 24.16+ and a separate development/production PostgreSQL database. Keep development fixtures/test data away from the production connection.
3. Build command: `npm ci && npm run build`. Run command: `npm start`. Expose the port supplied by Replit through `PORT` (defaults to 3001); server binds to 0.0.0.0.
4. Set server-side Secrets: `NODE_ENV=production`, `DATABASE_URL`, exact public `APP_ORIGIN` (e.g. https://your-name.replit.app, no trailing slash), and a cryptographically random `RATE_LIMIT_SECRET` of at least 32 characters. `.env.example` is a checklist; the server does not automatically load .env files. Use Replit Secrets or Node's `--env-file` locally. Never use the example placeholder secret.
5. Verify proxy topology before setting `TRUST_PROXY_HOPS`. Default 0 ignores forwarded headers; behind a shared proxy this conservatively shares limits among players. An incorrect higher value can let clients spoof addresses and evade limits. Do not blindly trust the leftmost X-Forwarded-For value. Configure an edge request limit too before advertising broadly.
6. Review cost limits, database backups, TLS connection requirements and actual privacy/retention policy. Use the provider's required TLS configuration; do not disable certificate verification to fix connection errors.
7. Smoke-test HTTPS, assets, database persistence after restart, a real completed sortie, sharing/retry, leaderboard reads from another browser, and outage fallback before announcing the link. No real PostgreSQL service is assumed to exist on this machine.

Production startup refuses missing database/origin/secret settings rather than silently using an ephemeral file. The minimal schema is created idempotently at startup with `CREATE TABLE/INDEX IF NOT EXISTS`; existing rows are not deleted by deployments. Future schema changes need explicit migrations and backups.

## API and safeguards

- GET `/api/leaderboard?version=...`: top 25 for one board, no ticket secrets. Defaults to Standard (`signalbreak-4`); other current boards are `signalbreak-4-relaxed` and `signalbreak-4-veteran`. All previous boards remain readable in the archive but reject new registration. Current score increments are 15/20/25 (the common divisor of enemy and asteroid rewards); historical validation retains its original increments. The server envelope includes up to 11 asteroid rewards during the debris phase. Deploy client and server together; no SQL schema change is required.
- POST `/api/runs`: `{version}` → random run ID + 256-bit bearer ticket + expiry. Only its SHA-256 hash is stored server-side.
- POST `/api/scores`: run ID/ticket/version, validated public display name (or generated callsign), score, elapsed, outcome. Parameterized SQL and atomic conditional update allow exactly one score per run. Identical retries return success; conflicting retries return 409.
- 4 KiB JSON body limit, same-origin checks, finite/ranged values, current-version check, mode-specific score increments and generous timing/score plausibility envelope. Tickets bind a run to its difficulty/version; submissions cannot move a ticket to another board. Eight seconds of registration timing slack accommodates nonblocking network setup. Victory requires 120+ mission seconds and at least the core's base 2,000 points multiplied by its mode's score factor (0.75 / 1 / 1.25).
- Database-backed per-address limits: 12 registrations, 40 submissions and 120 reads per ten-minute bucket. Raw IP addresses are not stored in the database; a keyed digest identifies rate buckets. Provider access logs may still contain addresses. Expired unsubmitted runs and rate buckets are pruned when new runs register.
- Accepted scores persist until operator action. Submitted rows contain no raw address; bearer hashes remain stored for idempotency. A public production privacy notice and a long-term retention policy should be chosen before wider release.

A determined player can fabricate a plausible run, wait out timing checks, or create another identity. Rate limits are not DDoS protection, and guest labels do not prevent impersonation. Do not use this for prizes or trusted rankings. Stronger competition needs server-authoritative simulation or deterministic replay validation plus identity/abuse controls.

## Moderation

Use the private server shell with the correct database environment: `node server/moderate.mjs hide RUN_UUID` (or `restore`). The UUID is in the board API response. Hiding is reversible, preserves duplicate protection, and exposes no public admin route. The basic display-name filter is not comprehensive; operators can hide inappropriate or fabricated entries. Back up the production database before maintenance.

## Verification

`npm run test:leaderboard` tests HTTP validation, duplicates/races, ordering, rate limits, expiry, database failure and local persistence. `npx playwright test tests/leaderboard.spec.ts --project=game` tests the UI, fallback, keyboard modality, exclusion and a real-time sortie against an isolated local HTTP server/SQLite database. Only the first submission acknowledgement is replaced to exercise safe retry. Unrelated gameplay tests explicitly mock the leaderboard as unavailable, preventing accidental public submissions and isolating their original scope. That mock is not used by the real-sortie integration test.

The dev inspector exposes only eligibility/count/storage/version/shared status at `getState().leaderboard`; it never exposes bearer tickets. Production has no inspector. See `.logs/leaderboard-implementation.md` for actual results and limitations.
