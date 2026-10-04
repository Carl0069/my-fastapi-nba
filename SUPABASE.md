# Community challenge storage

Community-created challenge definitions are shared through Supabase. The API uses the Supabase **service-role key only on the server**; do not add it to any HTML or JavaScript file.

## Setup

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/migrations/20261004_community_challenges.sql`](./supabase/migrations/20261004_community_challenges.sql).
3. In the Vercel project that deploys this FastAPI app, add these environment variables:
   - `SUPABASE_URL`: the project URL from Supabase Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret from Supabase Project Settings → API.
4. Redeploy the API after setting both values.

The `GET` and `POST /api/v1/community-challenges` endpoints require the existing `X-API-Key` header. The browser sends only that existing app key; it never receives the Supabase service-role key. Challenge creator names are public display names, not authenticated identities.
