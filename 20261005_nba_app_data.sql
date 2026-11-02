create extension if not exists pgcrypto;

create table if not exists public.api_cache (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  cache_key text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resource_type, cache_key)
);

create index if not exists api_cache_resource_type_expires_idx
  on public.api_cache (resource_type, expires_at);

create index if not exists api_cache_updated_at_idx
  on public.api_cache (updated_at desc);

create table if not exists public.nba_teams (
  id integer primary key,
  name text not null,
  abbreviation text not null,
  conference text not null,
  division text,
  city text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nba_players (
  id text primary key,
  team_id integer references public.nba_teams(id),
  name text not null,
  full_name text,
  position text,
  jersey_number text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nba_games (
  id text primary key,
  season text not null,
  game_date timestamptz,
  home_team_id integer references public.nba_teams(id),
  away_team_id integer references public.nba_teams(id),
  status text,
  home_score integer,
  away_score integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nba_box_scores (
  game_id text not null references public.nba_games(id),
  player_id text not null references public.nba_players(id),
  team_id integer references public.nba_teams(id),
  season text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create table if not exists public.nba_standings (
  season text not null,
  season_type text not null,
  team_id integer references public.nba_teams(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season, season_type, team_id)
);

alter table public.api_cache enable row level security;
alter table public.nba_teams enable row level security;
alter table public.nba_players enable row level security;
alter table public.nba_games enable row level security;
alter table public.nba_box_scores enable row level security;
alter table public.nba_standings enable row level security;

grant select, insert, update, delete on public.api_cache to service_role;
grant select, insert, update, delete on public.nba_teams to service_role;
grant select, insert, update, delete on public.nba_players to service_role;
grant select, insert, update, delete on public.nba_games to service_role;
grant select, insert, update, delete on public.nba_box_scores to service_role;
grant select, insert, update, delete on public.nba_standings to service_role;
