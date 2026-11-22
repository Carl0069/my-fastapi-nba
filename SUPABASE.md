# Supabase data for NBA Hub

This project can persist shared application data in Supabase, while keeping the service-role secret on the server only. Do not add the secret or any direct database URL to any HTML or JavaScript file.

The team catalog, current roster, current-season stats, salaries, and contract years used by NBA Hub, Trade Machine, and Build a $15 Team are read from Supabase. These player surfaces do not fetch career stats or contracts at request time. Other live services such as schedules and scores may still use external feeds.

## Current roster and November 20, 2026 stats

The 2026-27 regular-season stats snapshot through November 20, 2026 is stored in `nba_players` by [`supabase/migrations/20261121_nba_player_snapshot_20261120.sql`](./supabase/migrations/20261121_nba_player_snapshot_20261120.sql). NBA Hub and Trade Machine read those roster/stat rows from Supabase; they do not fetch current player stats or rosters at request time. When a contract salary is not reported, it remains unavailable unless the saved catalog has a salary.

The same migration is appended to [`SUPABASE_COMPLETE_SETUP.sql`](./SUPABASE_COMPLETE_SETUP.sql). For an existing project, run this migration if the `nba_players` rows do not yet contain the November 20 snapshot.

## Static contract years

The static contract-year snapshot is in [`supabase/migrations/20261122_nba_player_contract_years.sql`](./supabase/migrations/20261122_nba_player_contract_years.sql) and is appended to [`SUPABASE_COMPLETE_SETUP.sql`](./SUPABASE_COMPLETE_SETUP.sql). It updates `nba_players.metadata.player.contract_years_remaining` and records its source and snapshot time. ESPN reported years for 333 of the 528 players in the snapshot; the other 195 remain `null` rather than being estimated.

For an existing database, run the contract-years migration in the Supabase SQL Editor. The migration checks that all 528 active roster rows match before updating anything. The Trade Machine reads these saved values through the Supabase-backed API; missing years display as unavailable. Years remaining are a source-reported contract term and do not by themselves establish NBA extension eligibility.

## 2026–27 Trade Machine cap details

The Trade Machine loads the bundled [`api/data/nba_cap_details_2026_27.json`](./api/data/nba_cap_details_2026_27.json) snapshot for all 30 teams, dated November 22, 2026. It includes itemized trade exceptions and cap holds from Fanspo team cap sheets, plus remaining mid-level and bi-annual exception balances checked against JJNBA's tracker updated November 21, 2026. The API exposes these as `cap_exceptions` and `cap_holds`, with source links and per-team verified/none statuses.

These are third-party estimates, not official NBA accounting. Some source balances are rounded or disagree; the affected entry notes the discrepancy instead of silently treating the values as identical. Check the linked sources before relying on an amount for a real transaction. This bundled snapshot does not change Supabase schema or require a SQL migration.

## Setup

1. Create a Supabase project and open its SQL Editor.
2. Open [`SUPABASE_COMPLETE_SETUP.sql`](./SUPABASE_COMPLETE_SETUP.sql), copy the whole file, paste it into the SQL Editor, and run it once. It creates the schema and seeds teams, players, current-season stats, contract years, and all 419 draft picks.
3. In the Vercel project or server environment that hosts the FastAPI app, add these environment variables:
   - `SUPABASE_URL`: the project URL from Supabase Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret from Supabase Project Settings → API.
   - `SUPABASE_PUBLISHABLE_KEY`: the project's publishable/anon key from Supabase Project Settings → API Keys. This key is intentionally public and is used only by the browser to sign in; never use a service-role key here.
   - `ADMIN_EMAILS` (optional): comma-separated Supabase account emails that should receive administrator access. A user with `app_metadata.role = "admin"` is also recognized as an administrator.
4. In Supabase Authentication settings, enable the email sign-in provider and configure the site/redirect URLs for the deployed app.
5. Redeploy the API after running the SQL and setting all three values.

The individual files under `supabase/migrations/` are retained for Supabase CLI users. If you use the single setup file above, do not also run those migrations separately.

## Included database schema

The app-level Supabase schema includes:

- `public.api_cache`: generic storage for cached standings, schedules, and box scores.
- `public.nba_teams`: team information and depth-chart metadata.
- `public.nba_players`: baseline player information, current-season statistics, and starter/bench order.
- `public.nba_player_profiles`: optional legacy career-stat snapshot used only by the legacy career API; current player cards do not read it.
- `public.nba_draft_picks`: each future pick as a separate ordered row per current owner.
- `public.nba_games`: stored game metadata and results.
- `public.nba_box_scores`: per-player box-score payloads keyed by game/player.
- `public.nba_standings`: season team standings snapshots.
- `public.community_challenges`: the shared community challenge list used by Cap Space Manager.
- `public.official_challenges`: admin-published challenges shown separately from community challenges.
- `public.trade_machine_trades`: cloud-synced Trade Machine submissions, with owner-scoped saved-trade access.
- `public.trade_machine_comments`: comments on public trade proposals.
- `public.trade_machine_ratings`: one updatable 1–5 rating per signed-in user and proposal.

The `/api/v1/teams` and `/api/v1/teams/{team_id}` endpoints read the persisted catalog from `nba_teams` and `nba_players`. If Supabase is unavailable or the catalog has not been seeded, those endpoints return an error instead of silently falling back to data in Python. The API caches a successful catalog read in process memory for up to 60 seconds.

The API reads Supabase `api_cache` before refreshing external feeds for services that remain live, including schedules, scores, standings, box scores, play-by-play, transactions, odds, news, injuries, and jersey numbers. Roster, current-season stats, salary, and contract-year surfaces are static SQL-backed snapshots and are not refreshed on API requests.

`nba_player_profiles` is read by the API using the server-side Supabase service role. The table enables RLS and revokes direct access from `anon` and `authenticated`; do not put the service-role key in the browser.

The cache expiry varies by data type: live scores and play-by-play refresh quickly, while schedules, rosters, and historical career data can be reused longer. The normalized `nba_games`, `nba_box_scores`, and `nba_standings` tables remain available for structured records; the API currently persists its complete external-feed snapshots in `api_cache`.

The `/api/v1/community-challenges` resource supports database-backed `GET`, `POST`, `PATCH`, and `DELETE` operations. Collection reads can search challenge titles with `q`, filter on `rule_type`, and paginate with `limit` and `offset`; omitting `limit` retrieves all matching rows in pages. Individual records can be read, partially updated, or deleted by UUID. Create and update validate challenge fields and selected player IDs against the Supabase-backed catalog.

The challenge collection and individual reads still use the legacy `X-API-Key` app gate. That value is embedded in browser JavaScript and therefore is publicly discoverable; do not treat it as a secret or as user authentication. Create, update, and delete instead require a Supabase Auth access token in the `Authorization: Bearer` header. The server verifies the token with Supabase Auth, stores the verified user ID as `owner_id` when creating a challenge, and scopes updates/deletes to that owner. Legacy ownerless rows remain readable but cannot be changed by an ordinary user. The browser stores access/refresh tokens in tab-scoped `sessionStorage`; only the Supabase publishable key is sent to the browser. The service-role key remains server-only. If you have already run the setup SQL, rerun `SUPABASE_COMPLETE_SETUP.sql` (or the community-challenges migration) to add ownership and ensure the service role has the required CRUD grants.

## Official challenge publishing

For an existing database, run [`supabase/migrations/20261121_official_challenges.sql`](./supabase/migrations/20261121_official_challenges.sql) in the Supabase SQL Editor. The same table is included in `SUPABASE_COMPLETE_SETUP.sql`. Only an authenticated administrator can publish through `POST /api/v1/official-challenges`; the API checks the verified Supabase user's `app_metadata.role` or the server-side `ADMIN_EMAILS` list. The public challenge list is read through `GET /api/v1/official-challenges`. Admin-published challenges appear in Official Challenges and remain separate from user-created Community Challenges. The existing built-in official challenges are unchanged.

## Trade Machine community and current data

For an existing database, run [`supabase/migrations/20261121_trade_machine_community.sql`](./supabase/migrations/20261121_trade_machine_community.sql) in the Supabase SQL Editor. The same schema is included in `SUPABASE_COMPLETE_SETUP.sql` for new projects. This migration adds the cloud trade, comment, and rating tables, enables RLS, and grants table access only to the server's `service_role`.

The Trade Machine uses `/api/v1/trade-machine/saved-trades` for the signed-in user's saved proposals and `/api/v1/trade-machine/trades` for the public community feed. Submitting, deleting, commenting, and rating require a verified Supabase Auth bearer token; guests can browse the public feed. A user's saved-trade list and delete operation are scoped to that verified user. A submitted trade is public, including its team and asset details. Ratings are 1–5 and a user can update their rating; comments are trimmed and limited to 500 characters. Older browser-local saved trades are imported idempotently after sign-in and removed from that browser only after every import succeeds.

Players listed under Trade Machine cap holds can be added as sign-and-trade proposals. The builder lets the user enter a first-year salary, select a 3- or 4-year term, and choose the modeled raise rate; it applies the first-year raise amount to each following season. The API snapshot does not contain prior salary or years of service, so player-specific salary maxima and signing eligibility are not verified. The checker uses the proposed first-year salary for trade matching and estimates the receiving team's first-apron hard cap, including its current cap holds.

The Trade Machine's `/api/v1/trade-machine/teams` endpoint reads its roster, current-season stats, salary, and contract years from `nba_teams`/`nba_players` in Supabase; it does not query `nba_player_profiles`, ESPN, or NBA.com for those values. Unreported salary and years remain unavailable rather than being estimated. Current future-pick inventory and ownership still come from `nba_draft_picks` in Supabase; the API excludes completed draft years but does not independently verify whether a stored pick conveyance has changed. Check the returned snapshot/source labels when reviewing data.

After applying the migration or full setup SQL, redeploy the API and frontend. Live Supabase writes and deployment are not performed by this repository change.

Challenge input is validated in the API and constrained in the database: title and creator lengths, nonblank trimmed values, description length, allowed rule types, selected-player count, and player membership/uniqueness. Invalid bodies return 422, missing or non-owned records return 404, missing/invalid/expired user tokens return 401, and database connection/operation errors return sanitized 503/502 responses without exposing credentials. Supabase email-confirmation settings may require a user to confirm their address before they can sign in.

## Phase 6 security assessment

- **Validation:** Pydantic checks field types, allowed rule types, and length/count bounds; validators trim text and reject whitespace-only values. The API checks that player IDs are unique and belong to the current catalog. SQL adds corresponding nonblank/length constraints and bounds the saved JSON player list.
- **Errors:** Invalid input returns 422; missing and non-owned challenge IDs return the same 404; absent or invalid user access tokens return 401; missing configuration and Supabase outages return sanitized 503/502 responses. Server logs retain operational context without returning service credentials to clients.
- **Authentication/authorization:** Supabase Auth email/password signup and sign-in issue user tokens. The API verifies bearer tokens server-side for challenge creation, update, and deletion. Updates/deletes are constrained by both challenge ID and authenticated owner ID. Read endpoints remain public-data reads protected only by the legacy public app key, which is not an authorization boundary.
- **Secrets/configuration:** Keep `SUPABASE_SERVICE_ROLE_KEY` only in Vercel/server environment variables; never add it to HTML/JavaScript. `SUPABASE_PUBLISHABLE_KEY` is a public client key, not a secret. The repository's legacy `API_KEY` is hardcoded in the browser bundle and backend; treat it as publicly visible and rotate/remove it if it has been reused as a real secret. `.env*` files are ignored by Git.

For evidence screenshots, capture: (1) Vercel environment variable *names* with values hidden, including the publishable key; (2) Supabase SQL Editor showing the `owner_id` column/index and RLS enabled; (3) the Cap Space Manager sign-in/create-account controls; and (4) Swagger/OpenAPI or browser network details showing a protected write without a bearer token returns 401 and an authenticated write succeeds. Never include a password, access/refresh token, or service-role key in a screenshot.

Older community challenges created before the selected-player migration have no saved player list, so the game marks them unavailable rather than generating a random pool. Recreate those challenges and choose their players.
