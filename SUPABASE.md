# Community challenge storage

Community-created challenge definitions are shared through Supabase. The API uses the Supabase **service-role key only on the server**; do not add it to any HTML or JavaScript file.

If the shared API is not configured, Cap Space Manager still allows challenge creation in browser-local mode. Those challenges are saved only in that browser and are not visible to other users.

## Setup

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/migrations/20261004_community_challenges.sql`](./supabase/migrations/20261004_community_challenges.sql).
3. Run [`supabase/migrations/20261004_community_challenge_players.sql`](./supabase/migrations/20261004_community_challenge_players.sql) to enable creator-selected player pools.
4. In the Vercel project that deploys this FastAPI app, add these environment variables:
   - `SUPABASE_URL`: the project URL from Supabase Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret from Supabase Project Settings → API.
5. Redeploy the API after applying the migration and setting both values.

The `GET` and `POST /api/v1/community-challenges` endpoints require the existing `X-API-Key` header. The browser sends only that existing app key; it never receives the Supabase service-role key. Challenge creator names are public display names, not authenticated identities.

Older community challenges created before the selected-player migration have no saved player list, so the game marks them unavailable rather than generating a random pool. Recreate those challenges and choose their players.
