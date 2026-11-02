# Supabase storage for NBA Hub

This project can persist shared application data in Supabase, while keeping the service-role secret on the server only. Do not add the secret or any direct database URL to any HTML or JavaScript file.

The app uses Supabase both for shared community challenges and for a lightweight cache of NBA API responses. If Supabase is not configured, the app still runs in local-memory mode and community challenges remain browser-local only.

## Setup

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/migrations/20261004_community_challenges.sql`](./supabase/migrations/20261004_community_challenges.sql).
3. Run [`supabase/migrations/20261004_community_challenge_players.sql`](./supabase/migrations/20261004_community_challenge_players.sql) to enable creator-selected player pools.
4. Run [`supabase/migrations/20261005_nba_app_data.sql`](./supabase/migrations/20261005_nba_app_data.sql) to create the app cache and normalized NBA tables.
5. In the Vercel project or server environment that hosts the FastAPI app, add these environment variables:
   - `SUPABASE_URL`: the project URL from Supabase Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret from Supabase Project Settings → API.
6. Redeploy the API after applying the migration and setting both values.

## Included database schema

The app-level Supabase schema includes:

- `public.api_cache`: generic storage for cached standings, schedules, and box scores.
- `public.nba_teams`: normalized franchise metadata.
- `public.nba_players`: player identities and roster metadata.
- `public.nba_games`: stored game metadata and results.
- `public.nba_box_scores`: per-player box-score payloads keyed by game/player.
- `public.nba_standings`: season team standings snapshots.
- `public.community_challenges`: the shared community challenge list used by Cap Space Manager.

The API now reads from and writes to `api_cache` whenever Supabase is configured, instead of relying only on the process memory cache. This keeps the backend data layer portable while still preserving the local in-memory fallback for development.

The `GET` and `POST /api/v1/community-challenges` endpoints require the existing `X-API-Key` header. The browser sends only that existing app key; it never receives the Supabase service-role key. Challenge creator names are public display names, not authenticated identities.

Older community challenges created before the selected-player migration have no saved player list, so the game marks them unavailable rather than generating a random pool. Recreate those challenges and choose their players.
