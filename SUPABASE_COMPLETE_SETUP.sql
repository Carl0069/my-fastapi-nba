-- NBA Hub complete Supabase setup
-- Paste this entire file into Supabase SQL Editor and run it once.
-- Safe to re-run: creates missing tables and upserts the bundled catalog data.
-- It does not drop tables or delete existing records.
-- This provisions schema and seed data; live ESPN/NBA snapshots are cached after the API runs.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- COMMUNITY CHALLENGES
create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 3 and 48),
  description text not null default '' check (char_length(description) <= 220),
  creator text not null check (char_length(creator) between 2 and 24),
  rule_type text not null check (
    rule_type in ('all', 'scorers', 'playmakers', 'rebounders', 'guards', 'forwards', 'bigs', 'defenders')
  ),
  created_at timestamptz not null default now()
);

alter table public.community_challenges
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

alter table public.community_challenges
  drop constraint if exists community_challenges_nonblank_fields_check;

alter table public.community_challenges
  add constraint community_challenges_nonblank_fields_check
  check (
    char_length(btrim(title)) between 3 and 48
    and char_length(btrim(creator)) between 2 and 24
    and char_length(btrim(description)) <= 220
  );

create index if not exists community_challenges_created_at_idx
  on public.community_challenges (created_at desc);

create index if not exists community_challenges_owner_id_idx
  on public.community_challenges (owner_id);

alter table public.community_challenges enable row level security;
grant select, insert, update, delete on public.community_challenges to service_role;


-- SELECTED PLAYER POOLS
alter table public.community_challenges
  add column if not exists selected_player_ids jsonb not null default '[]'::jsonb;

alter table public.community_challenges
  drop constraint if exists community_challenges_selected_player_ids_check;

alter table public.community_challenges
  add constraint community_challenges_selected_player_ids_check
  check (
    jsonb_typeof(selected_player_ids) = 'array'
    and jsonb_array_length(selected_player_ids) <= 590
  );


-- NBA TABLES AND CACHE
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
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nba_players
  add column if not exists is_active boolean not null default true;

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


-- NBA TEAMS, PLAYERS, AND ALL DRAFT PICKS
CREATE TABLE IF NOT EXISTS public.nba_draft_picks (
  team_id integer NOT NULL REFERENCES public.nba_teams(id) ON DELETE CASCADE,
  pick_order integer NOT NULL CHECK (pick_order >= 0),
  year smallint NOT NULL CHECK (year BETWEEN 2026 AND 2040),
  round smallint NOT NULL CHECK (round IN (1, 2)),
  original_owner text NOT NULL,
  is_swap boolean NOT NULL DEFAULT false,
  protection text,
  details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, pick_order)
);

CREATE INDEX IF NOT EXISTS nba_draft_picks_year_round_idx
  ON public.nba_draft_picks (year, round);

ALTER TABLE public.nba_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_draft_picks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nba_teams FROM anon, authenticated;
REVOKE ALL ON TABLE public.nba_players FROM anon, authenticated;
REVOKE ALL ON TABLE public.nba_draft_picks FROM anon, authenticated;
GRANT SELECT ON TABLE public.nba_teams TO service_role;
GRANT SELECT ON TABLE public.nba_players TO service_role;
GRANT SELECT ON TABLE public.nba_draft_picks TO service_role;

INSERT INTO public.nba_teams (id, name, abbreviation, conference, division, is_active, metadata) VALUES
  (1, 'Boston Celtics', 'BOS', 'Eastern', 'Atlantic', true, '{"id":1,"name":"Boston Celtics","conference":"Eastern","division":"Atlantic","featured_star":"Jayson Tatum","headline_stat":"26.8 PPG, 8.4 RPG","last_season_record":"56-26","total_salary":191137932,"tax_status":"Luxury Tax","championships":18,"championship_years":[1957,1959,1960,1961,1962,1963,1964,1965,1966,1968,1969,1974,1976,1981,1984,1986,2008,2024],"logo":"https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg","description":"Retooled Eastern front-runner featuring Jayson Tatum, Derrick White, and newly acquired Paul George alongside Mitchell Robinson."}'::jsonb),
  (2, 'Brooklyn Nets', 'BKN', 'Eastern', 'Atlantic', true, '{"id":2,"name":"Brooklyn Nets","conference":"Eastern","division":"Atlantic","featured_star":"Julius Randle","headline_stat":"23.8 PPG, 9.1 RPG","last_season_record":"20-62","total_salary":160105139,"tax_status":"Under Cap","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg","description":"Rebuilding franchise centered around Julius Randle, Michael Porter Jr., Egor Demin, and Moritz Wagner."}'::jsonb),
  (3, 'New York Knicks', 'NYK', 'Eastern', 'Atlantic', true, '{"id":3,"name":"New York Knicks","conference":"Eastern","division":"Atlantic","featured_star":"Jalen Brunson","headline_stat":"26.5 PPG, 7.3 APG","last_season_record":"53-29","total_salary":221455415,"tax_status":"Luxury Tax","championships":3,"championship_years":[1970,1973,2026],"logo":"https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg","description":"High-powered Manhattan roster boasting Jalen Brunson, Karl-Anthony Towns, Mikal Bridges, and OG Anunoby."}'::jsonb),
  (4, 'Philadelphia 76ers', 'PHI', 'Eastern', 'Atlantic', true, '{"id":4,"name":"Philadelphia 76ers","conference":"Eastern","division":"Atlantic","featured_star":"Joel Embiid","headline_stat":"24.9 PPG, 8.5 RPG","last_season_record":"45-37","total_salary":213165808,"tax_status":"Luxury Tax","championships":3,"championship_years":[1955,1967,1983],"logo":"https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg","description":"Powerhouse contender uniting LeBron James and Jaylen Brown alongside franchise pillars Joel Embiid and Tyrese Maxey."}'::jsonb),
  (5, 'Toronto Raptors', 'TOR', 'Eastern', 'Atlantic', true, '{"id":5,"name":"Toronto Raptors","conference":"Eastern","division":"Atlantic","featured_star":"Scottie Barnes","headline_stat":"20.2 PPG, 8.4 RPG, 5.9 APG","last_season_record":"46-36","total_salary":205084177,"tax_status":"Luxury Tax","championships":1,"championship_years":[2019],"logo":"https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg","description":"Dynamic young Eastern roster built around All-Star forward Scottie Barnes, RJ Barrett, Immanuel Quickley, and Kawhi Leonard."}'::jsonb),
  (6, 'Chicago Bulls', 'CHI', 'Eastern', 'Central', true, '{"id":6,"name":"Chicago Bulls","conference":"Eastern","division":"Central","featured_star":"Josh Giddey","headline_stat":"13.8 PPG, 7.2 RPG, 5.8 APG","last_season_record":"31-51","total_salary":164345080,"tax_status":"Under Cap","championships":6,"championship_years":[1991,1992,1993,1996,1997,1998],"logo":"https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg","description":"Transitioning core featuring Josh Giddey, Matas Buzelis, Nic Claxton, and veteran Norman Powell."}'::jsonb),
  (7, 'Cleveland Cavaliers', 'CLE', 'Eastern', 'Central', true, '{"id":7,"name":"Cleveland Cavaliers","conference":"Eastern","division":"Central","featured_star":"Donovan Mitchell","headline_stat":"26.2 PPG, 5.8 APG","last_season_record":"52-30","total_salary":216120753,"tax_status":"Luxury Tax","championships":1,"championship_years":[2016],"logo":"https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg","description":"Perennial Eastern heavyweight equipped with Donovan Mitchell, James Harden, Evan Mobley, and Jarrett Allen."}'::jsonb),
  (8, 'Detroit Pistons', 'DET', 'Eastern', 'Central', true, '{"id":8,"name":"Detroit Pistons","conference":"Eastern","division":"Central","featured_star":"Cade Cunningham","headline_stat":"23.4 PPG, 7.8 APG","last_season_record":"60-22","total_salary":188382759,"tax_status":"Under Cap","championships":3,"championship_years":[1989,1990,2004],"logo":"https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg","description":"Rising core powered by Cade Cunningham, Ausar Thompson, John Collins, and center Jalen Duren."}'::jsonb),
  (9, 'Indiana Pacers', 'IND', 'Eastern', 'Central', true, '{"id":9,"name":"Indiana Pacers","conference":"Eastern","division":"Central","featured_star":"Tyrese Haliburton","headline_stat":"18.5 PPG, 9.2 APG","last_season_record":"19-63","total_salary":203715395,"tax_status":"Luxury Tax","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg","description":"High-octane transition offense directed by Tyrese Haliburton alongside Pascal Siakam and Ivica Zubac."}'::jsonb),
  (10, 'Milwaukee Bucks', 'MIL', 'Eastern', 'Central', true, '{"id":10,"name":"Milwaukee Bucks","conference":"Eastern","division":"Central","featured_star":"Tyler Herro","headline_stat":"21.2 PPG, 5.4 RPG","last_season_record":"32-50","total_salary":193808287,"tax_status":"Over Cap","championships":2,"championship_years":[1971,2021],"logo":"https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg","description":"Restructured lineup commanded by Ryan Rollins, Myles Turner, Tyler Herro, and Jaime Jaquez Jr."}'::jsonb),
  (11, 'Miami Heat', 'MIA', 'Eastern', 'Southeast', true, '{"id":11,"name":"Miami Heat","conference":"Eastern","division":"Southeast","featured_star":"Giannis Antetokounmpo","headline_stat":"30.4 PPG, 11.9 RPG, 6.1 APG","last_season_record":"43-39","total_salary":204486535,"tax_status":"Luxury Tax","championships":3,"championship_years":[2006,2012,2013],"logo":"https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg","description":"Championship front-runner after landing superstar Giannis Antetokounmpo to join Bam Adebayo and Jimmy Butler."}'::jsonb),
  (12, 'Atlanta Hawks', 'ATL', 'Eastern', 'Southeast', true, '{"id":12,"name":"Atlanta Hawks","conference":"Eastern","division":"Southeast","featured_star":"Jalen Johnson","headline_stat":"17.5 PPG, 9.1 RPG, 4.4 APG","last_season_record":"46-36","total_salary":175673253,"tax_status":"Luxury Tax","championships":1,"championship_years":[1958],"logo":"https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg","description":"Athletic retool driven by Dyson Daniels, Jalen Johnson, Onyeka Okongwu, and veteran C.J. McCollum."}'::jsonb),
  (13, 'Charlotte Hornets', 'CHA', 'Eastern', 'Southeast', true, '{"id":13,"name":"Charlotte Hornets","conference":"Eastern","division":"Southeast","featured_star":"Brandon Miller","headline_stat":"18.5 PPG, 4.6 RPG","last_season_record":"44-38","total_salary":153570647,"tax_status":"Under Cap","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg","description":"Revamped perimeter group featuring Brandon Miller, Coby White, and stretch big Naz Reid."}'::jsonb),
  (14, 'Orlando Magic', 'ORL', 'Eastern', 'Southeast', true, '{"id":14,"name":"Orlando Magic","conference":"Eastern","division":"Southeast","featured_star":"Paolo Banchero","headline_stat":"23.5 PPG, 7.2 RPG, 5.8 APG","last_season_record":"45-37","total_salary":223288224,"tax_status":"1st Apron","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg","description":"Elite defensive squad with forward versatility led by Paolo Banchero and Franz Wagner."}'::jsonb),
  (15, 'Washington Wizards', 'WAS', 'Eastern', 'Southeast', true, '{"id":15,"name":"Washington Wizards","conference":"Eastern","division":"Southeast","featured_star":"Trae Young","headline_stat":"24.5 PPG, 11.6 APG","last_season_record":"17-65","total_salary":183462525,"tax_status":"Over Cap","championships":1,"championship_years":[1978],"logo":"https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg","description":"Revitalized attack featuring elite playmaker Trae Young, rim protector Anthony Davis, and Alex Sarr."}'::jsonb),
  (16, 'Denver Nuggets', 'DEN', 'Western', 'Northwest', true, '{"id":16,"name":"Denver Nuggets","conference":"Western","division":"Northwest","featured_star":"Nikola Jokić","headline_stat":"29.6 PPG, 12.8 RPG, 10.2 APG","last_season_record":"54-28","total_salary":221069148,"tax_status":"Luxury Tax","championships":1,"championship_years":[2023],"logo":"https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg","description":"Championship contender orchestrated by 3-time MVP Nikola Jokic, Jamal Murray, and DeMar DeRozan."}'::jsonb),
  (17, 'Minnesota Timberwolves', 'MIN', 'Western', 'Northwest', true, '{"id":17,"name":"Minnesota Timberwolves","conference":"Western","division":"Northwest","featured_star":"Anthony Edwards","headline_stat":"27.2 PPG, 5.7 RPG, 5.1 APG","last_season_record":"49-33","total_salary":215327417,"tax_status":"1st Apron","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg","description":"Star-loaded contender pairing superstar Anthony Edwards with LaMelo Ball and Jonathan Kuminga."}'::jsonb),
  (18, 'Oklahoma City Thunder', 'OKC', 'Western', 'Northwest', true, '{"id":18,"name":"Oklahoma City Thunder","conference":"Western","division":"Northwest","featured_star":"Shai Gilgeous-Alexander","headline_stat":"32.7 PPG, 6.4 APG, 1.8 SPG","last_season_record":"64-18","total_salary":214798992,"tax_status":"1st Apron","championships":2,"championship_years":[1979,2025],"logo":"https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg","description":"Championship favorite led by Shai Gilgeous-Alexander, Chet Holmgren, and Jalen Williams."}'::jsonb),
  (19, 'Portland Trail Blazers', 'POR', 'Western', 'Northwest', true, '{"id":19,"name":"Portland Trail Blazers","conference":"Western","division":"Northwest","featured_star":"Ja Morant","headline_stat":"24.6 PPG, 7.8 APG","last_season_record":"42-40","total_salary":194511148,"tax_status":"Over Cap","championships":1,"championship_years":[1977],"logo":"https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg","description":"Explosive backcourt unit featuring Ja Morant, Damian Lillard, Deni Avdija, Jrue Holiday, and center Donovan Clingan."}'::jsonb),
  (20, 'Utah Jazz', 'UTA', 'Western', 'Northwest', true, '{"id":20,"name":"Utah Jazz","conference":"Western","division":"Northwest","featured_star":"Lauri Markkanen","headline_stat":"22.8 PPG, 8.0 RPG","last_season_record":"22-60","total_salary":173265019,"tax_status":"Over Cap","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg","description":"Floor-spacing lineup keyed by Lauri Markkanen, Keyonte George, and defensive anchor Jusuf Nurkic."}'::jsonb),
  (21, 'Golden State Warriors', 'GSW', 'Western', 'Pacific', true, '{"id":21,"name":"Golden State Warriors","conference":"Western","division":"Pacific","featured_star":"Stephen Curry","headline_stat":"24.2 PPG, 6.1 APG","last_season_record":"37-45","total_salary":223306506,"tax_status":"1st Apron","championships":7,"championship_years":[1947,1956,1975,2015,2017,2018,2022],"logo":"https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg","description":"Veteran championship contender orchestrated by Stephen Curry, Draymond Green, Jimmy Butler, and Kristaps Porzingis."}'::jsonb),
  (22, 'LA Clippers', 'LAC', 'Western', 'Pacific', true, '{"id":22,"name":"LA Clippers","conference":"Western","division":"Pacific","featured_star":"Darius Garland","headline_stat":"18.4 PPG, 6.8 APG","last_season_record":"42-40","total_salary":196862414,"tax_status":"Over Cap","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg","description":"Disciplined Western squad leaning into Darius Garland, Brandon Ingram, Gradey Dick, and center Brook Lopez."}'::jsonb),
  (23, 'Los Angeles Lakers', 'LAL', 'Western', 'Pacific', true, '{"id":23,"name":"Los Angeles Lakers","conference":"Western","division":"Pacific","featured_star":"Luka Dončić","headline_stat":"28.2 PPG, 8.2 RPG, 7.8 APG","last_season_record":"53-29","total_salary":201332759,"tax_status":"Luxury Tax","championships":17,"championship_years":[1949,1950,1952,1953,1954,1972,1980,1982,1985,1987,1988,2000,2001,2002,2009,2010,2020],"logo":"https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg","description":"Restructured marquee franchise revolving around Luka Doncic, Austin Reaves, and defensive anchor Walker Kessler."}'::jsonb),
  (24, 'Phoenix Suns', 'PHX', 'Western', 'Pacific', true, '{"id":24,"name":"Phoenix Suns","conference":"Western","division":"Pacific","featured_star":"Devin Booker","headline_stat":"25.8 PPG, 7.1 APG","last_season_record":"45-37","total_salary":193028455,"tax_status":"1st Apron","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg","description":"Potent perimeter scoring group featuring Devin Booker, Miles Bridges, Dillon Brooks, and Mark Williams."}'::jsonb),
  (25, 'Sacramento Kings', 'SAC', 'Western', 'Pacific', true, '{"id":25,"name":"Sacramento Kings","conference":"Western","division":"Pacific","featured_star":"Domantas Sabonis","headline_stat":"19.4 PPG, 13.9 RPG, 8.2 APG","last_season_record":"22-60","total_salary":191795907,"tax_status":"Over Cap","championships":1,"championship_years":[1951],"logo":"https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg","description":"High-IQ passing and scoring unit led by triple-double machine Domantas Sabonis and Zach LaVine."}'::jsonb),
  (26, 'Dallas Mavericks', 'DAL', 'Western', 'Southwest', true, '{"id":26,"name":"Dallas Mavericks","conference":"Western","division":"Southwest","featured_star":"Kyrie Irving","headline_stat":"25.2 PPG, 5.1 APG","last_season_record":"26-56","total_salary":177194561,"tax_status":"Over Cap","championships":1,"championship_years":[2011],"logo":"https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg","description":"Electrifying roster revolving around Kyrie Irving, #1 pick Zaccharie Risacher, and top draft standout Cooper Flagg."}'::jsonb),
  (27, 'Houston Rockets', 'HOU', 'Western', 'Southwest', true, '{"id":27,"name":"Houston Rockets","conference":"Western","division":"Southwest","featured_star":"Alperen Şengün","headline_stat":"21.4 PPG, 9.5 RPG, 5.2 APG","last_season_record":"52-30","total_salary":205487343,"tax_status":"Luxury Tax","championships":2,"championship_years":[1994,1995],"logo":"https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg","description":"Western contender driven by veteran champion Kevin Durant alongside playmaking big Alperen Sengun."}'::jsonb),
  (28, 'Memphis Grizzlies', 'MEM', 'Western', 'Southwest', true, '{"id":28,"name":"Memphis Grizzlies","conference":"Western","division":"Southwest","featured_star":"Zach Edey","headline_stat":"14.2 PPG, 9.2 RPG, 1.6 BPG","last_season_record":"25-57","total_salary":133200098,"tax_status":"Over Cap","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg","description":"Youth-oriented squad anchored by 7-foot-4 center Zach Edey, Jaylen Wells, and Cedric Coward."}'::jsonb),
  (29, 'New Orleans Pelicans', 'NOP', 'Western', 'Southwest', true, '{"id":29,"name":"New Orleans Pelicans","conference":"Western","division":"Southwest","featured_star":"Zion Williamson","headline_stat":"23.2 PPG, 5.9 RPG, 5.1 APG","last_season_record":"26-56","total_salary":204110200,"tax_status":"Luxury Tax","championships":0,"championship_years":[],"logo":"https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg","description":"High-powered offense revolving around Zion Williamson, Dejounte Murray, and defensive specialist Herb Jones."}'::jsonb),
  (30, 'San Antonio Spurs', 'SAS', 'Western', 'Southwest', true, '{"id":30,"name":"San Antonio Spurs","conference":"Western","division":"Southwest","featured_star":"Victor Wembanyama","headline_stat":"24.3 PPG, 11.0 RPG, 3.1 BPG","last_season_record":"62-20","total_salary":182110209,"tax_status":"Over Cap","championships":5,"championship_years":[1999,2003,2005,2007,2014],"logo":"https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg","description":"Rapidly climbing Western powerhouse engineered around transcendent center Victor Wembanyama and Stephon Castle."}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    abbreviation = EXCLUDED.abbreviation,
    conference = EXCLUDED.conference,
    division = EXCLUDED.division,
    is_active = EXCLUDED.is_active,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players (id, team_id, name, full_name, position, metadata) VALUES
  ('1:derrick white', 1, 'Derrick White', 'Derrick White', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Derrick White","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":77,"pts":16.5,"reb":4.4,"ast":5.4,"stl":1.1,"blk":1.3,"tov":1.7,"fg":39.4,"fg3":32.7,"ft":90.2,"salary":28400000}}'::jsonb),
  ('1:baylor scheierman', 1, 'Baylor Scheierman', 'Baylor Scheierman', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Baylor Scheierman","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":77,"pts":5.5,"reb":3.5,"ast":1.5,"stl":0.5,"blk":0.1,"tov":0.6,"fg":45.3,"fg3":39.9,"ft":90.3,"salary":2700000}}'::jsonb),
  ('1:paul george', 1, 'Paul George', 'Paul George', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Paul George","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":37,"pts":17.3,"reb":5.3,"ast":3.6,"stl":1.7,"blk":0.4,"tov":1.7,"fg":43.9,"fg3":39.2,"ft":82.0,"salary":54100000}}'::jsonb),
  ('1:jayson tatum', 1, 'Jayson Tatum', 'Jayson Tatum', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Jayson Tatum","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":16,"pts":21.8,"reb":10.0,"ast":5.3,"stl":1.4,"blk":0.2,"tov":2.4,"fg":41.1,"fg3":32.9,"ft":82.3,"salary":58400000}}'::jsonb),
  ('1:mitchell robinson', 1, 'Mitchell Robinson', 'Mitchell Robinson', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Mitchell Robinson","pos":"C","contract_type":null,"stats_season":"2025-26","gp":60,"pts":5.7,"reb":8.8,"ast":0.9,"stl":0.9,"blk":1.2,"tov":0.7,"fg":72.3,"fg3":0.0,"ft":40.8,"salary":15000000}}'::jsonb),
  ('1:payton pritchard', 1, 'Payton Pritchard', 'Payton Pritchard', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Payton Pritchard","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":79,"pts":17.0,"reb":3.9,"ast":5.2,"stl":0.7,"blk":0.1,"tov":1.4,"fg":46.4,"fg3":37.7,"ft":89.0,"salary":7700000}}'::jsonb),
  ('1:ron harper jr.', 1, 'Ron Harper Jr.', 'Ron Harper Jr.', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Ron Harper Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":29,"pts":4.2,"reb":1.7,"ast":0.8,"stl":0.3,"blk":0.3,"tov":0.3,"fg":41.8,"fg3":35.0,"ft":75.0,"salary":3100000}}'::jsonb),
  ('1:jordan walsh', 1, 'Jordan Walsh', 'Jordan Walsh', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"Jordan Walsh","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":68,"pts":5.4,"reb":4.0,"ast":0.8,"stl":0.7,"blk":0.5,"tov":0.5,"fg":50.9,"fg3":38.4,"ft":77.2,"salary":2400000}}'::jsonb),
  ('1:hugo gonzález', 1, 'Hugo González', 'Hugo González', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Hugo González","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":74,"pts":3.9,"reb":3.3,"ast":0.5,"stl":0.6,"blk":0.3,"tov":0.5,"fg":47.6,"fg3":36.2,"ft":50.0,"salary":2900000}}'::jsonb),
  ('1:sam hauser', 1, 'Sam Hauser', 'Sam Hauser', 'SF', '{"is_starter":false,"roster_order":9,"player":{"name":"Sam Hauser","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":78,"pts":9.2,"reb":3.8,"ast":1.5,"stl":0.5,"blk":0.3,"tov":0.4,"fg":41.9,"fg3":39.3,"ft":85.0,"salary":10800000}}'::jsonb),
  ('1:mike conley', 1, 'Mike Conley', 'Mike Conley', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Mike Conley","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":54,"pts":4.5,"reb":1.7,"ast":2.9,"stl":0.6,"blk":0.3,"tov":0.6,"fg":33.5,"fg3":33.7,"ft":90.0,"salary":3800000}}'::jsonb),
  ('1:luka garza', 1, 'Luka Garza', 'Luka Garza', 'C', '{"is_starter":false,"roster_order":11,"player":{"name":"Luka Garza","pos":"C","contract_type":null,"stats_season":"2025-26","gp":69,"pts":8.1,"reb":4.1,"ast":1.0,"stl":0.4,"blk":0.4,"tov":0.7,"fg":57.7,"fg3":43.3,"ft":76.9,"salary":2800000}}'::jsonb),
  ('1:amari williams', 1, 'Amari Williams', 'Amari Williams', 'C', '{"is_starter":false,"roster_order":12,"player":{"name":"Amari Williams","pos":"C","contract_type":null,"stats_season":"2025-26","gp":22,"pts":1.4,"reb":1.8,"ast":0.5,"stl":0.1,"blk":0.5,"tov":0.5,"fg":50.0,"fg3":0.0,"ft":71.4,"salary":2400000}}'::jsonb),
  ('1:neemias queta', 1, 'Neemias Queta', 'Neemias Queta', 'C', '{"is_starter":false,"roster_order":13,"player":{"name":"Neemias Queta","pos":"C","contract_type":null,"stats_season":"2025-26","gp":76,"pts":10.2,"reb":8.4,"ast":1.7,"stl":0.8,"blk":1.3,"tov":1.0,"fg":65.3,"fg3":12.5,"ft":70.3,"salary":2600000}}'::jsonb),
  ('1:chris cenac jr.', 1, 'Chris Cenac Jr.', 'Chris Cenac Jr.', 'PF', '{"is_starter":false,"roster_order":14,"player":{"name":"Chris Cenac Jr.","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2900000}}'::jsonb),
  ('1:tucker devries', 1, 'Tucker DeVries', 'Tucker DeVries', 'SG', '{"is_starter":false,"roster_order":15,"player":{"name":"Tucker DeVries","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('1:dillon mitchell', 1, 'Dillon Mitchell', 'Dillon Mitchell', 'SF', '{"is_starter":false,"roster_order":16,"player":{"name":"Dillon Mitchell","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('1:milos uzan', 1, 'Milos Uzan', 'Milos Uzan', 'PG', '{"is_starter":false,"roster_order":17,"player":{"name":"Milos Uzan","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('2:egor dëmin', 2, 'Egor Dëmin', 'Egor Dëmin', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Egor Dëmin","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":52,"pts":10.3,"reb":3.2,"ast":3.3,"stl":0.8,"blk":0.3,"tov":1.7,"fg":39.9,"fg3":38.5,"ft":83.1,"salary":7200000}}'::jsonb),
  ('2:michael porter jr.', 2, 'Michael Porter Jr.', 'Michael Porter Jr.', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Michael Porter Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":52,"pts":24.2,"reb":7.1,"ast":3.0,"stl":1.1,"blk":0.3,"tov":2.3,"fg":46.3,"fg3":36.3,"ft":85.9,"salary":40800000}}'::jsonb),
  ('2:julius randle', 2, 'Julius Randle', 'Julius Randle', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Julius Randle","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":79,"pts":21.1,"reb":6.7,"ast":5.0,"stl":1.1,"blk":0.2,"tov":2.7,"fg":48.1,"fg3":31.5,"ft":80.2,"salary":33300000}}'::jsonb),
  ('2:day''ron sharpe', 2, 'Day''Ron Sharpe', 'Day''Ron Sharpe', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Day''Ron Sharpe","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":62,"pts":8.7,"reb":6.7,"ast":2.3,"stl":1.1,"blk":0.4,"tov":1.7,"fg":60.1,"fg3":23.1,"ft":67.8,"salary":10000000}}'::jsonb),
  ('2:moritz wagner', 2, 'Moritz Wagner', 'Moritz Wagner', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Moritz Wagner","pos":"C","contract_type":null,"stats_season":"2025-26","gp":36,"pts":6.9,"reb":3.2,"ast":0.8,"stl":0.4,"blk":0.1,"tov":0.5,"fg":42.6,"fg3":31.4,"ft":81.9,"salary":9000000,"contract_note":"2-year, $18.45M contract: $9M in 2026-27; $9.45M in 2027-28 (mutual option).","contract_label":"2027-28 mutual option"}}'::jsonb),
  ('2:josh minott', 2, 'Josh Minott', 'Josh Minott', 'SF', '{"is_starter":false,"roster_order":5,"player":{"name":"Josh Minott","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":49,"pts":7.4,"reb":3.2,"ast":0.9,"stl":0.9,"blk":0.5,"tov":0.9,"fg":50.0,"fg3":41.8,"ft":78.7,"salary":4500000}}'::jsonb),
  ('2:mikel brown jr.', 2, 'Mikel Brown Jr.', 'Mikel Brown Jr.', 'PG', '{"is_starter":false,"roster_order":6,"player":{"name":"Mikel Brown Jr.","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":8700000}}'::jsonb),
  ('2:danny wolf', 2, 'Danny Wolf', 'Danny Wolf', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Danny Wolf","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":57,"pts":8.9,"reb":4.9,"ast":2.2,"stl":0.5,"blk":0.6,"tov":1.3,"fg":40.5,"fg3":32.2,"ft":77.1,"salary":2900000}}'::jsonb),
  ('2:drake powell', 2, 'Drake Powell', 'Drake Powell', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Drake Powell","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":63,"pts":6.5,"reb":1.8,"ast":1.4,"stl":0.6,"blk":0.2,"tov":1.0,"fg":40.2,"fg3":28.0,"ft":89.6,"salary":3500000}}'::jsonb),
  ('2:joshua jefferson', 2, 'Joshua Jefferson', 'Joshua Jefferson', 'PF', '{"is_starter":false,"roster_order":9,"player":{"name":"Joshua Jefferson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2900000}}'::jsonb),
  ('2:nolan traore', 2, 'Nolan Traore', 'Nolan Traore', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Nolan Traore","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":56,"pts":8.9,"reb":1.8,"ast":3.8,"stl":0.8,"blk":0.4,"tov":2.3,"fg":38.0,"fg3":31.8,"ft":78.7,"salary":4000000}}'::jsonb),
  ('2:keon ellis', 2, 'Keon Ellis', 'Keon Ellis', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Keon Ellis","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":72,"pts":6.7,"reb":1.9,"ast":1.0,"stl":1.2,"blk":0.6,"tov":0.6,"fg":44.0,"fg3":36.3,"ft":72.9,"salary":9000000}}'::jsonb),
  ('2:terance mann', 2, 'Terance Mann', 'Terance Mann', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Terance Mann","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":63,"pts":7.2,"reb":3.2,"ast":3.0,"stl":0.7,"blk":0.2,"tov":1.1,"fg":45.7,"fg3":36.4,"ft":78.8,"salary":15500000}}'::jsonb),
  ('2:grant nelson', 2, 'Grant Nelson', 'Grant Nelson', 'PF', '{"is_starter":false,"roster_order":13,"player":{"name":"Grant Nelson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":4,"pts":4.3,"reb":1.5,"ast":1.3,"stl":0.3,"blk":1.3,"tov":1.0,"fg":55.6,"fg3":0.0,"ft":70.0,"salary":null}}'::jsonb),
  ('2:noah clowney', 2, 'Noah Clowney', 'Noah Clowney', 'PF', '{"is_starter":false,"roster_order":14,"player":{"name":"Noah Clowney","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":66,"pts":12.3,"reb":4.1,"ast":1.6,"stl":0.8,"blk":0.7,"tov":1.5,"fg":39.6,"fg3":32.9,"ft":80.4,"salary":5400000}}'::jsonb),
  ('2:chaney johnson', 2, 'Chaney Johnson', 'Chaney Johnson', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Chaney Johnson","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":17,"pts":8.2,"reb":4.6,"ast":2.1,"stl":0.9,"blk":0.5,"tov":1.2,"fg":54.3,"fg3":30.0,"ft":80.0,"salary":0}}'::jsonb),
  ('2:tyler bilodeau', 2, 'Tyler Bilodeau', 'Tyler Bilodeau', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"Tyler Bilodeau","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('2:ben saraf', 2, 'Ben Saraf', 'Ben Saraf', 'PG', '{"is_starter":false,"roster_order":17,"player":{"name":"Ben Saraf","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":44,"pts":7.5,"reb":2.1,"ast":3.3,"stl":0.9,"blk":0.2,"tov":2.3,"fg":39.6,"fg3":21.1,"ft":83.0,"salary":3000000}}'::jsonb),
  ('3:jalen brunson', 3, 'Jalen Brunson', 'Jalen Brunson', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Jalen Brunson","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":74,"pts":26.0,"reb":3.3,"ast":6.8,"stl":0.8,"blk":0.1,"tov":2.4,"fg":46.7,"fg3":36.9,"ft":84.1,"salary":37700000}}'::jsonb),
  ('3:josh hart', 3, 'Josh Hart', 'Josh Hart', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Josh Hart","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":66,"pts":12.0,"reb":7.4,"ast":4.8,"stl":1.1,"blk":0.3,"tov":1.9,"fg":50.8,"fg3":41.3,"ft":72.0,"salary":20900000}}'::jsonb),
  ('3:mikal bridges', 3, 'Mikal Bridges', 'Mikal Bridges', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Mikal Bridges","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":82,"pts":14.4,"reb":3.8,"ast":3.7,"stl":1.3,"blk":0.8,"tov":1.0,"fg":49.0,"fg3":37.1,"ft":82.7,"salary":33400000}}'::jsonb),
  ('3:og anunoby', 3, 'OG Anunoby', 'OG Anunoby', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"OG Anunoby","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":67,"pts":16.7,"reb":5.2,"ast":2.2,"stl":1.6,"blk":0.7,"tov":1.8,"fg":48.4,"fg3":38.6,"ft":82.8,"salary":42500000}}'::jsonb),
  ('3:karl-anthony towns', 3, 'Karl-Anthony Towns', 'Karl-Anthony Towns', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Karl-Anthony Towns","pos":"C","contract_type":null,"stats_season":"2025-26","gp":75,"pts":20.1,"reb":11.9,"ast":3.0,"stl":0.9,"blk":0.5,"tov":2.5,"fg":50.1,"fg3":36.8,"ft":85.8,"salary":57000000}}'::jsonb),
  ('3:jack kayil', 3, 'Jack Kayil', 'Jack Kayil', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Jack Kayil","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('3:tyler nickel', 3, 'Tyler Nickel', 'Tyler Nickel', 'SF', '{"is_starter":false,"roster_order":6,"player":{"name":"Tyler Nickel","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('3:andre drummond', 3, 'Andre Drummond', 'Andre Drummond', 'C', '{"is_starter":false,"roster_order":7,"player":{"name":"Andre Drummond","pos":"C","contract_type":null,"stats_season":"2025-26","gp":63,"pts":6.4,"reb":8.4,"ast":1.3,"stl":0.6,"blk":0.8,"tov":1.0,"fg":47.2,"fg3":35.6,"ft":63.1,"salary":3800000}}'::jsonb),
  ('3:jordan clarkson', 3, 'Jordan Clarkson', 'Jordan Clarkson', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Jordan Clarkson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":72,"pts":8.6,"reb":1.8,"ast":1.3,"stl":0.4,"blk":0.1,"tov":0.9,"fg":45.1,"fg3":32.7,"ft":83.0,"salary":3800000}}'::jsonb),
  ('3:miles mcbride', 3, 'Miles McBride', 'Miles McBride', 'PG', '{"is_starter":false,"roster_order":9,"player":{"name":"Miles McBride","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":41,"pts":12.0,"reb":2.4,"ast":2.6,"stl":0.9,"blk":0.2,"tov":0.8,"fg":42.3,"fg3":41.3,"ft":78.7,"salary":3900000}}'::jsonb),
  ('3:pacôme dadiet', 3, 'Pacôme Dadiet', 'Pacôme Dadiet', 'SF', '{"is_starter":false,"roster_order":10,"player":{"name":"Pacôme Dadiet","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":29,"pts":1.7,"reb":0.9,"ast":0.4,"stl":0.1,"blk":0.0,"tov":0.1,"fg":33.3,"fg3":21.9,"ft":81.8,"salary":2900000}}'::jsonb),
  ('3:jose alvarado', 3, 'Jose Alvarado', 'Jose Alvarado', 'PG', '{"is_starter":false,"roster_order":11,"player":{"name":"Jose Alvarado","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":7.4,"reb":2.5,"ast":3.4,"stl":1.0,"blk":0.1,"tov":1.1,"fg":41.6,"fg3":35.2,"ft":76.1,"salary":4400000}}'::jsonb),
  ('3:kevin mccullar jr.', 3, 'Kevin McCullar Jr.', 'Kevin McCullar Jr.', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Kevin McCullar Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":21,"pts":2.4,"reb":1.3,"ast":1.0,"stl":0.4,"blk":0.0,"tov":0.6,"fg":42.6,"fg3":33.3,"ft":40.0,"salary":null}}'::jsonb),
  ('3:tyler kolek', 3, 'Tyler Kolek', 'Tyler Kolek', 'PG', '{"is_starter":false,"roster_order":13,"player":{"name":"Tyler Kolek","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":62,"pts":4.4,"reb":1.6,"ast":2.7,"stl":0.4,"blk":0.1,"tov":0.9,"fg":43.5,"fg3":38.6,"ft":70.0,"salary":2200000}}'::jsonb),
  ('3:landry shamet', 3, 'Landry Shamet', 'Landry Shamet', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"Landry Shamet","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":51,"pts":9.3,"reb":1.8,"ast":1.4,"stl":0.6,"blk":0.2,"tov":0.6,"fg":43.7,"fg3":39.2,"ft":71.1,"salary":5400000}}'::jsonb),
  ('3:mohamed diawara', 3, 'Mohamed Diawara', 'Mohamed Diawara', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Mohamed Diawara","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":69,"pts":3.6,"reb":1.4,"ast":0.8,"stl":0.2,"blk":0.1,"tov":0.4,"fg":42.3,"fg3":36.9,"ft":75.0,"salary":2600000}}'::jsonb),
  ('3:tony bradley', 3, 'Tony Bradley', 'Tony Bradley', 'C', '{"is_starter":false,"roster_order":16,"player":{"name":"Tony Bradley","pos":"C","contract_type":null,"stats_season":"2025-26","gp":41,"pts":4.0,"reb":2.8,"ast":0.5,"stl":0.1,"blk":0.2,"tov":0.4,"fg":54.7,"fg3":50.0,"ft":74.4,"salary":3506659}}'::jsonb),
  ('4:tyrese maxey', 4, 'Tyrese Maxey', 'Tyrese Maxey', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Tyrese Maxey","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":28.3,"reb":4.1,"ast":6.6,"stl":1.9,"blk":0.8,"tov":2.4,"fg":46.2,"fg3":36.7,"ft":89.2,"salary":40770520}}'::jsonb),
  ('4:jaylen brown', 4, 'Jaylen Brown', 'Jaylen Brown', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Jaylen Brown","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":71,"pts":28.7,"reb":6.9,"ast":5.1,"stl":1.0,"blk":0.4,"tov":3.6,"fg":47.7,"fg3":34.7,"ft":79.5,"salary":57078728}}'::jsonb),
  ('4:vj edgecombe', 4, 'VJ Edgecombe', 'VJ Edgecombe', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"VJ Edgecombe","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":75,"pts":16.0,"reb":5.6,"ast":4.2,"stl":1.4,"blk":0.5,"tov":1.8,"fg":43.8,"fg3":35.4,"ft":81.8,"salary":11663880}}'::jsonb),
  ('4:lebron james', 4, 'LeBron James', 'LeBron James', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"LeBron James","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":60,"pts":20.9,"reb":6.1,"ast":7.2,"stl":1.2,"blk":0.6,"tov":3.0,"fg":51.5,"fg3":31.7,"ft":73.7,"salary":3876529}}'::jsonb),
  ('4:joel embiid', 4, 'Joel Embiid', 'Joel Embiid', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Joel Embiid","pos":"C","contract_type":null,"stats_season":"2025-26","gp":38,"pts":26.9,"reb":7.7,"ast":3.9,"stl":0.6,"blk":1.2,"tov":2.9,"fg":48.9,"fg3":33.3,"ft":85.4,"salary":58100000}}'::jsonb),
  ('4:labaron philon jr.', 4, 'Labaron Philon Jr.', 'Labaron Philon Jr.', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Labaron Philon Jr.","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3597120}}'::jsonb),
  ('4:caleb love', 4, 'Caleb Love', 'Caleb Love', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Caleb Love","pos":"SG","contract_type":"Two-Way","stats_season":"2025-26","gp":49,"pts":10.4,"reb":2.3,"ast":2.5,"stl":0.6,"blk":0.1,"tov":1.3,"fg":38.8,"fg3":31.8,"ft":73.5,"salary":null}}'::jsonb),
  ('4:kentavious caldwell-pope', 4, 'Kentavious Caldwell-Pope', 'Kentavious Caldwell-Pope', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"Kentavious Caldwell-Pope","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":51,"pts":8.4,"reb":2.5,"ast":2.7,"stl":0.8,"blk":0.2,"tov":1.2,"fg":41.0,"fg3":31.6,"ft":91.3,"salary":2449421}}'::jsonb),
  ('4:justin edwards', 4, 'Justin Edwards', 'Justin Edwards', 'SF', '{"is_starter":false,"roster_order":8,"player":{"name":"Justin Edwards","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":64,"pts":6.0,"reb":1.5,"ast":1.3,"stl":0.8,"blk":0.2,"tov":0.6,"fg":44.7,"fg3":37.2,"ft":84.6,"salary":2411090}}'::jsonb),
  ('4:marjon beauchamp', 4, 'MarJon Beauchamp', 'MarJon Beauchamp', 'SF', '{"is_starter":false,"roster_order":9,"player":{"name":"MarJon Beauchamp","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":14,"pts":6.8,"reb":2.3,"ast":1.1,"stl":0.6,"blk":0.3,"tov":0.9,"fg":43.4,"fg3":34.0,"ft":68.4,"salary":null}}'::jsonb),
  ('4:rayan rupert', 4, 'Rayan Rupert', 'Rayan Rupert', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Rayan Rupert","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":64,"pts":5.2,"reb":2.9,"ast":1.1,"stl":0.9,"blk":0.1,"tov":0.9,"fg":39.3,"fg3":32.4,"ft":77.8,"salary":null}}'::jsonb),
  ('4:anfernee simons', 4, 'Anfernee Simons', 'Anfernee Simons', 'PG', '{"is_starter":false,"roster_order":11,"player":{"name":"Anfernee Simons","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":55,"pts":14.3,"reb":2.5,"ast":2.4,"stl":0.5,"blk":0.1,"tov":1.2,"fg":44.0,"fg3":38.5,"ft":89.6,"salary":6000000}}'::jsonb),
  ('4:tyrese martin', 4, 'Tyrese Martin', 'Tyrese Martin', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Tyrese Martin","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":46,"pts":6.3,"reb":2.5,"ast":1.7,"stl":0.5,"blk":0.1,"tov":0.9,"fg":39.4,"fg3":32.1,"ft":67.9,"salary":null}}'::jsonb),
  ('4:dominick barlow', 4, 'Dominick Barlow', 'Dominick Barlow', 'PF', '{"is_starter":false,"roster_order":13,"player":{"name":"Dominick Barlow","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":71,"pts":7.7,"reb":4.8,"ast":1.2,"stl":0.9,"blk":0.7,"tov":0.8,"fg":53.9,"fg3":25.6,"ft":71.8,"salary":3415000}}'::jsonb),
  ('4:adem bona', 4, 'Adem Bona', 'Adem Bona', 'C', '{"is_starter":false,"roster_order":14,"player":{"name":"Adem Bona","pos":"C","contract_type":null,"stats_season":"2025-26","gp":71,"pts":4.8,"reb":4.3,"ast":0.5,"stl":0.4,"blk":1.2,"tov":0.8,"fg":59.5,"fg3":33.3,"ft":70.8,"salary":2296271}}'::jsonb),
  ('4:dean wade', 4, 'Dean Wade', 'Dean Wade', 'PF', '{"is_starter":false,"roster_order":15,"player":{"name":"Dean Wade","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":59,"pts":5.8,"reb":4.2,"ast":1.5,"stl":0.7,"blk":0.4,"tov":0.3,"fg":43.9,"fg3":36.2,"ft":71.1,"salary":9000000}}'::jsonb),
  ('4:jabari walker', 4, 'Jabari Walker', 'Jabari Walker', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"Jabari Walker","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":64,"pts":4.3,"reb":3.0,"ast":0.5,"stl":0.4,"blk":0.2,"tov":0.4,"fg":45.5,"fg3":33.7,"ft":73.5,"salary":2584539}}'::jsonb),
  ('4:ariel hukporti', 4, 'Ariel Hukporti', 'Ariel Hukporti', 'C', '{"is_starter":false,"roster_order":17,"player":{"name":"Ariel Hukporti","pos":"C","contract_type":null,"stats_season":"2025-26","gp":54,"pts":2.2,"reb":2.9,"ast":0.5,"stl":0.2,"blk":0.5,"tov":0.6,"fg":56.3,"fg3":25.0,"ft":78.8,"salary":3400000}}'::jsonb),
  ('4:tacko fall', 4, 'Tacko Fall', 'Tacko Fall', 'C', '{"is_starter":false,"roster_order":18,"player":{"name":"Tacko Fall","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('4:jameer nelson jr.', 4, 'Jameer Nelson Jr.', 'Jameer Nelson Jr.', 'PG', '{"is_starter":false,"roster_order":19,"player":{"name":"Jameer Nelson Jr.","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('4:saint thomas', 4, 'Saint Thomas', 'Saint Thomas', 'SF', '{"is_starter":false,"roster_order":20,"player":{"name":"Saint Thomas","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('4:duke miles', 4, 'Duke Miles', 'Duke Miles', 'PG', '{"is_starter":false,"roster_order":21,"player":{"name":"Duke Miles","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('4:dillon jones', 4, 'Dillon Jones', 'Dillon Jones', 'SF', '{"is_starter":false,"roster_order":22,"player":{"name":"Dillon Jones","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":7,"pts":1.3,"reb":1.0,"ast":0.6,"stl":0.4,"blk":0.0,"tov":0.0,"fg":22.2,"fg3":20.0,"ft":100.0,"salary":2449421}}'::jsonb),
  ('5:immanuel quickley', 5, 'Immanuel Quickley', 'Immanuel Quickley', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Immanuel Quickley","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":16.4,"reb":4.0,"ast":5.9,"stl":1.3,"blk":0.1,"tov":1.5,"fg":44.3,"fg3":37.4,"ft":82.1,"salary":32500000}}'::jsonb),
  ('5:rj barrett', 5, 'RJ Barrett', 'RJ Barrett', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"RJ Barrett","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":57,"pts":19.3,"reb":5.3,"ast":3.3,"stl":0.7,"blk":0.3,"tov":1.7,"fg":49.1,"fg3":33.9,"ft":71.7,"salary":29616071}}'::jsonb),
  ('5:kawhi leonard', 5, 'Kawhi Leonard', 'Kawhi Leonard', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Kawhi Leonard","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":65,"pts":27.9,"reb":6.4,"ast":3.6,"stl":1.9,"blk":0.4,"tov":2.0,"fg":50.5,"fg3":38.7,"ft":89.2,"salary":50300000}}'::jsonb),
  ('5:scottie barnes', 5, 'Scottie Barnes', 'Scottie Barnes', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Scottie Barnes","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":80,"pts":18.1,"reb":7.5,"ast":5.9,"stl":1.4,"blk":1.5,"tov":2.6,"fg":50.7,"fg3":30.4,"ft":81.5,"salary":41754690}}'::jsonb),
  ('5:jakob poeltl', 5, 'Jakob Poeltl', 'Jakob Poeltl', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Jakob Poeltl","pos":"C","contract_type":null,"stats_season":"2025-26","gp":46,"pts":10.7,"reb":7.0,"ast":2.0,"stl":0.9,"blk":0.7,"tov":1.2,"fg":70.0,"fg3":0.0,"ft":60.2,"salary":19500000}}'::jsonb),
  ('5:kyle anderson', 5, 'Kyle Anderson', 'Kyle Anderson', 'F', '{"is_starter":false,"roster_order":5,"player":{"name":"Kyle Anderson","pos":"F","contract_type":null,"stats_season":"2025-26","gp":43,"pts":6.2,"reb":3.5,"ast":2.9,"stl":1.0,"blk":0.6,"tov":0.9,"fg":53.0,"fg3":36.4,"ft":70.6,"salary":2449421}}'::jsonb),
  ('5:trey jemison iii', 5, 'Trey Jemison III', 'Trey Jemison III', 'C', '{"is_starter":false,"roster_order":6,"player":{"name":"Trey Jemison III","pos":"C","contract_type":null,"stats_season":"2025-26","gp":13,"pts":1.0,"reb":1.4,"ast":0.4,"stl":0.1,"blk":0.2,"tov":0.8,"fg":60.0,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('5:chucky hepburn', 5, 'Chucky Hepburn', 'Chucky Hepburn', 'PG', '{"is_starter":false,"roster_order":7,"player":{"name":"Chucky Hepburn","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":2,"pts":0.0,"reb":0.5,"ast":1.0,"stl":0.5,"blk":0.0,"tov":0.5,"fg":0.0,"fg3":0.0,"ft":0.0,"salary":null}}'::jsonb),
  ('5:nate bittle', 5, 'Nate Bittle', 'Nate Bittle', 'C', '{"is_starter":false,"roster_order":8,"player":{"name":"Nate Bittle","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('5:jaden bradley', 5, 'Jaden Bradley', 'Jaden Bradley', 'PG', '{"is_starter":false,"roster_order":9,"player":{"name":"Jaden Bradley","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('5:a.j. lawson', 5, 'A.J. Lawson', 'A.J. Lawson', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"A.J. Lawson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":24,"pts":4.2,"reb":1.8,"ast":0.3,"stl":0.5,"blk":0.2,"tov":0.3,"fg":43.6,"fg3":42.2,"ft":77.8,"salary":null}}'::jsonb),
  ('5:ja''kobe walter', 5, 'Ja''Kobe Walter', 'Ja''Kobe Walter', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Ja''Kobe Walter","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":72,"pts":7.5,"reb":2.6,"ast":1.2,"stl":1.0,"blk":0.2,"tov":0.5,"fg":44.6,"fg3":40.9,"ft":78.9,"salary":3811800}}'::jsonb),
  ('5:malachi smith', 5, 'Malachi Smith', 'Malachi Smith', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Malachi Smith","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":15,"pts":8.3,"reb":3.4,"ast":3.3,"stl":0.8,"blk":0.3,"tov":0.9,"fg":48.5,"fg3":43.5,"ft":100.0,"salary":null}}'::jsonb),
  ('5:allen graves', 5, 'Allen Graves', 'Allen Graves', 'PF', '{"is_starter":false,"roster_order":13,"player":{"name":"Allen Graves","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":4065720}}'::jsonb),
  ('5:jamal shead', 5, 'Jamal Shead', 'Jamal Shead', 'PG', '{"is_starter":false,"roster_order":14,"player":{"name":"Jamal Shead","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":6.6,"reb":1.7,"ast":5.4,"stl":0.9,"blk":0.2,"tov":1.4,"fg":36.7,"fg3":32.1,"ft":78.4,"salary":2296271}}'::jsonb),
  ('5:collin murray-boyles', 5, 'Collin Murray-Boyles', 'Collin Murray-Boyles', 'PF', '{"is_starter":false,"roster_order":15,"player":{"name":"Collin Murray-Boyles","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":57,"pts":8.5,"reb":5.0,"ast":1.9,"stl":0.9,"blk":0.9,"tov":1.0,"fg":57.9,"fg3":34.0,"ft":65.7,"salary":6649560}}'::jsonb),
  ('5:trayce jackson-davis', 5, 'Trayce Jackson-Davis', 'Trayce Jackson-Davis', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"Trayce Jackson-Davis","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":53,"pts":3.4,"reb":2.7,"ast":0.7,"stl":0.3,"blk":0.5,"tov":0.4,"fg":57.3,"fg3":100.0,"ft":51.4,"salary":2406205}}'::jsonb),
  ('5:andre jackson jr.', 5, 'Andre Jackson Jr.', 'Andre Jackson Jr.', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Andre Jackson Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":48,"pts":2.4,"reb":1.5,"ast":0.9,"stl":0.4,"blk":0.1,"tov":0.6,"fg":32.8,"fg3":25.0,"ft":62.5,"salary":2537526}}'::jsonb),
  ('5:alijah martin', 5, 'Alijah Martin', 'Alijah Martin', 'SG', '{"is_starter":false,"roster_order":18,"player":{"name":"Alijah Martin","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":23,"pts":2.2,"reb":0.9,"ast":0.5,"stl":0.3,"blk":0.2,"tov":0.3,"fg":32.0,"fg3":19.0,"ft":78.9,"salary":2185116}}'::jsonb),
  ('5:jamison battle', 5, 'Jamison Battle', 'Jamison Battle', 'SF', '{"is_starter":false,"roster_order":19,"player":{"name":"Jamison Battle","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":61,"pts":3.1,"reb":1.5,"ast":0.4,"stl":0.1,"blk":0.0,"tov":0.3,"fg":51.0,"fg3":41.2,"ft":64.3,"salary":2296271}}'::jsonb),
  ('6:josh giddey', 6, 'Josh Giddey', 'Josh Giddey', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Josh Giddey","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":54,"pts":17.0,"reb":8.3,"ast":9.1,"stl":1.0,"blk":0.5,"tov":3.6,"fg":44.8,"fg3":36.4,"ft":76.3,"salary":25000000}}'::jsonb),
  ('6:norman powell', 6, 'Norman Powell', 'Norman Powell', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Norman Powell","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":58,"pts":21.7,"reb":3.5,"ast":2.5,"stl":1.1,"blk":0.2,"tov":1.9,"fg":47.0,"fg3":38.0,"ft":82.7,"salary":21500000}}'::jsonb),
  ('6:matas buzelis', 6, 'Matas Buzelis', 'Matas Buzelis', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Matas Buzelis","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":16.3,"reb":5.8,"ast":2.1,"stl":0.7,"blk":1.5,"tov":2.1,"fg":46.3,"fg3":34.9,"ft":78.6,"salary":5700000}}'::jsonb),
  ('6:patrick williams', 6, 'Patrick Williams', 'Patrick Williams', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Patrick Williams","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":72,"pts":7.0,"reb":3.0,"ast":1.5,"stl":0.7,"blk":0.4,"tov":1.0,"fg":37.2,"fg3":34.7,"ft":72.0,"salary":18000000}}'::jsonb),
  ('6:nic claxton', 6, 'Nic Claxton', 'Nic Claxton', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Nic Claxton","pos":"C","contract_type":null,"stats_season":"2025-26","gp":69,"pts":11.7,"reb":6.9,"ast":3.7,"stl":0.7,"blk":1.1,"tov":1.4,"fg":57.1,"fg3":15.8,"ft":61.6,"salary":23100000}}'::jsonb),
  ('6:caleb wilson', 6, 'Caleb Wilson', 'Caleb Wilson', 'PF', '{"is_starter":false,"roster_order":5,"player":{"name":"Caleb Wilson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":10600000}}'::jsonb),
  ('6:buddy hield', 6, 'Buddy Hield', 'Buddy Hield', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Buddy Hield","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":51,"pts":7.6,"reb":2.3,"ast":1.4,"stl":0.8,"blk":0.2,"tov":0.9,"fg":43.7,"fg3":34.9,"ft":81.1,"salary":9600000}}'::jsonb),
  ('6:leonard miller', 6, 'Leonard Miller', 'Leonard Miller', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Leonard Miller","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":46,"pts":7.8,"reb":3.9,"ast":0.9,"stl":0.4,"blk":0.3,"tov":0.8,"fg":55.3,"fg3":32.3,"ft":73.6,"salary":2400000}}'::jsonb),
  ('6:zach collins', 6, 'Zach Collins', 'Zach Collins', 'C', '{"is_starter":false,"roster_order":8,"player":{"name":"Zach Collins","pos":"C","contract_type":null,"stats_season":"2025-26","gp":10,"pts":9.7,"reb":5.6,"ast":1.5,"stl":0.2,"blk":0.4,"tov":1.0,"fg":57.8,"fg3":42.9,"ft":70.0,"salary":8500000}}'::jsonb),
  ('6:noa essengue', 6, 'Noa Essengue', 'Noa Essengue', 'SF', '{"is_starter":false,"roster_order":9,"player":{"name":"Noa Essengue","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":2,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.5,"blk":0.0,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":0.0,"salary":5700000}}'::jsonb),
  ('6:jalen smith', 6, 'Jalen Smith', 'Jalen Smith', 'C', '{"is_starter":false,"roster_order":10,"player":{"name":"Jalen Smith","pos":"C","contract_type":null,"stats_season":"2025-26","gp":53,"pts":10.2,"reb":6.7,"ast":1.2,"stl":0.5,"blk":0.8,"tov":1.0,"fg":48.3,"fg3":37.3,"ft":74.2,"salary":9400000}}'::jsonb),
  ('6:tre jones', 6, 'Tre Jones', 'Tre Jones', 'PG', '{"is_starter":false,"roster_order":11,"player":{"name":"Tre Jones","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":65,"pts":14.1,"reb":3.1,"ast":5.4,"stl":1.2,"blk":0.2,"tov":1.4,"fg":55.3,"fg3":31.5,"ft":84.1,"salary":8000000}}'::jsonb),
  ('6:isaac okoro', 6, 'Isaac Okoro', 'Isaac Okoro', 'SF', '{"is_starter":false,"roster_order":12,"player":{"name":"Isaac Okoro","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":63,"pts":9.3,"reb":2.7,"ast":1.6,"stl":0.7,"blk":0.5,"tov":0.7,"fg":46.0,"fg3":33.0,"ft":79.5,"salary":11800000}}'::jsonb),
  ('6:dailyn swain', 6, 'Dailyn Swain', 'Dailyn Swain', 'SF', '{"is_starter":false,"roster_order":13,"player":{"name":"Dailyn Swain","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":4900000}}'::jsonb),
  ('6:tobe awaka', 6, 'Tobe Awaka', 'Tobe Awaka', 'PF', '{"is_starter":false,"roster_order":14,"player":{"name":"Tobe Awaka","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('6:jaylin sellers', 6, 'Jaylin Sellers', 'Jaylin Sellers', 'SG', '{"is_starter":false,"roster_order":15,"player":{"name":"Jaylin Sellers","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('7:james harden', 7, 'James Harden', 'James Harden', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"James Harden","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":23.6,"reb":4.8,"ast":8.0,"stl":1.1,"blk":0.4,"tov":3.5,"fg":43.4,"fg3":37.5,"ft":88.4,"salary":30647619}}'::jsonb),
  ('7:donovan mitchell', 7, 'Donovan Mitchell', 'Donovan Mitchell', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Donovan Mitchell","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":27.9,"reb":4.5,"ast":5.7,"stl":1.5,"blk":0.3,"tov":2.8,"fg":48.3,"fg3":36.4,"ft":86.5,"salary":50100000}}'::jsonb),
  ('7:peyton watson', 7, 'Peyton Watson', 'Peyton Watson', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Peyton Watson","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":54,"pts":14.6,"reb":4.9,"ast":2.1,"stl":0.9,"blk":1.1,"tov":1.7,"fg":49.1,"fg3":41.1,"ft":73.0,"salary":20465116}}'::jsonb),
  ('7:evan mobley', 7, 'Evan Mobley', 'Evan Mobley', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Evan Mobley","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":65,"pts":18.2,"reb":9.0,"ast":3.6,"stl":0.7,"blk":1.7,"tov":1.9,"fg":54.6,"fg3":29.7,"ft":60.6,"salary":50100000}}'::jsonb),
  ('7:jarrett allen', 7, 'Jarrett Allen', 'Jarrett Allen', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Jarrett Allen","pos":"C","contract_type":null,"stats_season":"2025-26","gp":56,"pts":15.4,"reb":8.5,"ast":1.8,"stl":1.0,"blk":0.8,"tov":1.3,"fg":63.8,"fg3":10.0,"ft":70.9,"salary":28000000}}'::jsonb),
  ('7:thomas bryant', 7, 'Thomas Bryant', 'Thomas Bryant', 'C', '{"is_starter":false,"roster_order":5,"player":{"name":"Thomas Bryant","pos":"C","contract_type":null,"stats_season":"2025-26","gp":60,"pts":6.2,"reb":3.4,"ast":0.6,"stl":0.3,"blk":0.4,"tov":0.5,"fg":50.6,"fg3":35.9,"ft":80.3,"salary":3500000}}'::jsonb),
  ('7:sam merrill', 7, 'Sam Merrill', 'Sam Merrill', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Sam Merrill","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":52,"pts":12.8,"reb":2.6,"ast":2.4,"stl":0.6,"blk":0.1,"tov":0.8,"fg":46.1,"fg3":42.1,"ft":85.5,"salary":9100000}}'::jsonb),
  ('7:craig porter jr.', 7, 'Craig Porter Jr.', 'Craig Porter Jr.', 'PG', '{"is_starter":false,"roster_order":7,"player":{"name":"Craig Porter Jr.","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":64,"pts":4.5,"reb":3.4,"ast":3.2,"stl":0.9,"blk":0.6,"tov":0.9,"fg":45.0,"fg3":35.5,"ft":60.0,"salary":2400000}}'::jsonb),
  ('7:riley minix', 7, 'Riley Minix', 'Riley Minix', 'SF', '{"is_starter":false,"roster_order":8,"player":{"name":"Riley Minix","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":9,"pts":3.9,"reb":0.7,"ast":0.6,"stl":0.2,"blk":0.1,"tov":0.3,"fg":60.9,"fg3":33.3,"ft":100.0,"salary":0}}'::jsonb),
  ('7:meleek thomas', 7, 'Meleek Thomas', 'Meleek Thomas', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"Meleek Thomas","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('7:khalifa diop', 7, 'Khalifa Diop', 'Khalifa Diop', 'C', '{"is_starter":false,"roster_order":10,"player":{"name":"Khalifa Diop","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('7:jaylon tyson', 7, 'Jaylon Tyson', 'Jaylon Tyson', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Jaylon Tyson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":66,"pts":13.2,"reb":5.1,"ast":2.2,"stl":0.8,"blk":0.4,"tov":1.5,"fg":49.3,"fg3":44.6,"ft":73.8,"salary":3600000}}'::jsonb),
  ('7:tristan enaruna', 7, 'Tristan Enaruna', 'Tristan Enaruna', 'SF', '{"is_starter":false,"roster_order":12,"player":{"name":"Tristan Enaruna","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":9,"pts":4.1,"reb":1.6,"ast":0.8,"stl":0.6,"blk":0.0,"tov":0.3,"fg":50.0,"fg3":30.0,"ft":75.0,"salary":0}}'::jsonb),
  ('7:tyrese proctor', 7, 'Tyrese Proctor', 'Tyrese Proctor', 'PG', '{"is_starter":false,"roster_order":13,"player":{"name":"Tyrese Proctor","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":50,"pts":5.4,"reb":1.3,"ast":1.5,"stl":0.5,"blk":0.0,"tov":0.8,"fg":41.3,"fg3":35.1,"ft":88.9,"salary":2100000}}'::jsonb),
  ('7:mario hezonja', 7, 'Mario Hezonja', 'Mario Hezonja', 'SF', '{"is_starter":false,"roster_order":14,"player":{"name":"Mario Hezonja","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2845883}}'::jsonb),
  ('7:tre mann', 7, 'Tre Mann', 'Tre Mann', 'SG', '{"is_starter":false,"roster_order":15,"player":{"name":"Tre Mann","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":53,"pts":5.5,"reb":1.7,"ast":1.6,"stl":0.5,"blk":0.1,"tov":1.0,"fg":36.0,"fg3":32.3,"ft":85.2,"salary":8000000}}'::jsonb),
  ('7:nae''qwan tomlin', 7, 'Nae''Qwan Tomlin', 'Nae''Qwan Tomlin', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"Nae''Qwan Tomlin","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":64,"pts":5.8,"reb":2.9,"ast":0.8,"stl":0.6,"blk":0.5,"tov":0.5,"fg":47.8,"fg3":23.5,"ft":77.0,"salary":2400000}}'::jsonb),
  ('7:ernest udeh, jr.', 7, 'Ernest Udeh, Jr.', 'Ernest Udeh, Jr.', 'C', '{"is_starter":false,"roster_order":17,"player":{"name":"Ernest Udeh, Jr.","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('8:cade cunningham', 8, 'Cade Cunningham', 'Cade Cunningham', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Cade Cunningham","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":64,"pts":23.9,"reb":5.5,"ast":9.9,"stl":1.4,"blk":0.8,"tov":3.7,"fg":46.1,"fg3":34.2,"ft":81.2,"salary":50100000}}'::jsonb),
  ('8:duncan robinson', 8, 'Duncan Robinson', 'Duncan Robinson', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Duncan Robinson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":77,"pts":12.2,"reb":2.7,"ast":2.1,"stl":0.6,"blk":0.3,"tov":0.7,"fg":45.6,"fg3":41.0,"ft":75.5,"salary":15900000}}'::jsonb),
  ('8:ausar thompson', 8, 'Ausar Thompson', 'Ausar Thompson', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Ausar Thompson","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":73,"pts":9.9,"reb":5.7,"ast":3.1,"stl":2.0,"blk":0.9,"tov":1.5,"fg":52.5,"fg3":25.0,"ft":57.1,"salary":11100000}}'::jsonb),
  ('8:john collins', 8, 'John Collins', 'John Collins', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"John Collins","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":69,"pts":13.6,"reb":5.3,"ast":1.0,"stl":0.9,"blk":0.7,"tov":1.4,"fg":55.2,"fg3":40.6,"ft":76.6,"salary":17000000}}'::jsonb),
  ('8:jalen duren', 8, 'Jalen Duren', 'Jalen Duren', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Jalen Duren","pos":"C","contract_type":null,"stats_season":"2025-26","gp":70,"pts":19.5,"reb":10.5,"ast":2.0,"stl":0.8,"blk":0.8,"tov":1.9,"fg":65.0,"fg3":0.0,"ft":74.7,"salary":34482759,"contract_note":"2026-27 base salary: $34,482,759. His five-year, $200M extension averages $40M per year; actual future-year salaries vary."}}'::jsonb),
  ('8:ugonna onyenso', 8, 'Ugonna Onyenso', 'Ugonna Onyenso', 'C', '{"is_starter":false,"roster_order":5,"player":{"name":"Ugonna Onyenso","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('8:ebuka okorie', 8, 'Ebuka Okorie', 'Ebuka Okorie', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Ebuka Okorie","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":4400000}}'::jsonb),
  ('8:isaac jones', 8, 'Isaac Jones', 'Isaac Jones', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Isaac Jones","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":7,"pts":1.3,"reb":0.7,"ast":0.1,"stl":0.0,"blk":0.1,"tov":0.1,"fg":42.9,"fg3":0.0,"ft":75.0,"salary":0}}'::jsonb),
  ('8:ronald holland ii', 8, 'Ronald Holland II', 'Ronald Holland II', 'SF', '{"is_starter":false,"roster_order":8,"player":{"name":"Ronald Holland II","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":9000000}}'::jsonb),
  ('8:paul reed', 8, 'Paul Reed', 'Paul Reed', 'PF', '{"is_starter":false,"roster_order":9,"player":{"name":"Paul Reed","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":65,"pts":7.8,"reb":4.5,"ast":1.2,"stl":0.9,"blk":0.9,"tov":0.9,"fg":61.7,"fg3":32.5,"ft":66.4,"salary":5600000}}'::jsonb),
  ('8:isaiah joe', 8, 'Isaiah Joe', 'Isaiah Joe', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Isaiah Joe","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":71,"pts":11.1,"reb":2.5,"ast":1.3,"stl":0.7,"blk":0.2,"tov":0.6,"fg":45.5,"fg3":42.3,"ft":89.4,"salary":11300000}}'::jsonb),
  ('8:taurean prince', 8, 'Taurean Prince', 'Taurean Prince', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Taurean Prince","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":26,"pts":9.2,"reb":3.1,"ast":1.8,"stl":0.6,"blk":0.2,"tov":1.2,"fg":45.0,"fg3":43.6,"ft":100.0,"salary":3800000}}'::jsonb),
  ('8:wendell moore jr.', 8, 'Wendell Moore Jr.', 'Wendell Moore Jr.', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Wendell Moore Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":6,"pts":1.7,"reb":1.0,"ast":0.7,"stl":0.3,"blk":0.3,"tov":0.2,"fg":57.1,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('8:elijah harkless', 8, 'Elijah Harkless', 'Elijah Harkless', 'SG', '{"is_starter":false,"roster_order":13,"player":{"name":"Elijah Harkless","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":26,"pts":6.8,"reb":2.0,"ast":2.9,"stl":1.2,"blk":0.2,"tov":1.0,"fg":33.5,"fg3":23.9,"ft":76.6,"salary":0}}'::jsonb),
  ('8:chaz lanier', 8, 'Chaz Lanier', 'Chaz Lanier', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"Chaz Lanier","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":34,"pts":2.4,"reb":0.7,"ast":0.5,"stl":0.2,"blk":0.0,"tov":0.1,"fg":31.5,"fg3":28.4,"ft":83.3,"salary":2100000}}'::jsonb),
  ('8:daniss jenkins', 8, 'Daniss Jenkins', 'Daniss Jenkins', 'PG', '{"is_starter":false,"roster_order":15,"player":{"name":"Daniss Jenkins","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":72,"pts":9.3,"reb":2.3,"ast":3.9,"stl":0.9,"blk":0.2,"tov":1.6,"fg":40.8,"fg3":37.4,"ft":83.2,"salary":4000000}}'::jsonb),
  ('8:kevin huerter', 8, 'Kevin Huerter', 'Kevin Huerter', 'SG', '{"is_starter":false,"roster_order":16,"player":{"name":"Kevin Huerter","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":10.0,"reb":3.5,"ast":2.6,"stl":0.9,"blk":0.5,"tov":1.0,"fg":45.1,"fg3":30.8,"ft":77.5,"salary":9500000}}'::jsonb),
  ('8:javonte green', 8, 'Javonte Green', 'Javonte Green', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Javonte Green","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":6.9,"reb":2.8,"ast":0.7,"stl":1.2,"blk":0.3,"tov":0.5,"fg":44.7,"fg3":38.1,"ft":84.0,"salary":3900000}}'::jsonb),
  ('8:tolu smith', 8, 'Tolu Smith', 'Tolu Smith', 'C', '{"is_starter":false,"roster_order":18,"player":{"name":"Tolu Smith","pos":"C","contract_type":null,"stats_season":"2025-26","gp":15,"pts":3.7,"reb":3.3,"ast":0.9,"stl":0.1,"blk":0.4,"tov":0.5,"fg":50.0,"fg3":0.0,"ft":66.7,"salary":2400000}}'::jsonb),
  ('9:tyrese haliburton', 9, 'Tyrese Haliburton', 'Tyrese Haliburton', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Tyrese Haliburton","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":48900000}}'::jsonb),
  ('9:andrew nembhard', 9, 'Andrew Nembhard', 'Andrew Nembhard', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Andrew Nembhard","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":57,"pts":16.9,"reb":2.8,"ast":7.7,"stl":0.9,"blk":0.1,"tov":2.4,"fg":44.2,"fg3":36.1,"ft":82.5,"salary":19500000}}'::jsonb),
  ('9:aaron nesmith', 9, 'Aaron Nesmith', 'Aaron Nesmith', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Aaron Nesmith","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":45,"pts":13.8,"reb":4.2,"ast":1.9,"stl":0.6,"blk":0.5,"tov":1.4,"fg":41.4,"fg3":37.9,"ft":82.9,"salary":11000000}}'::jsonb),
  ('9:pascal siakam', 9, 'Pascal Siakam', 'Pascal Siakam', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Pascal Siakam","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":62,"pts":24.0,"reb":6.6,"ast":3.8,"stl":1.1,"blk":0.4,"tov":2.2,"fg":48.4,"fg3":35.8,"ft":69.3,"salary":48900000}}'::jsonb),
  ('9:ivica zubac', 9, 'Ivica Zubac', 'Ivica Zubac', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Ivica Zubac","pos":"C","contract_type":null,"stats_season":"2025-26","gp":48,"pts":14.1,"reb":10.6,"ast":2.2,"stl":0.4,"blk":0.8,"tov":1.8,"fg":59.8,"fg3":0.0,"ft":71.1,"salary":19500000}}'::jsonb),
  ('9:obi toppin', 9, 'Obi Toppin', 'Obi Toppin', 'PF', '{"is_starter":false,"roster_order":5,"player":{"name":"Obi Toppin","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":24,"pts":11.6,"reb":4.4,"ast":2.3,"stl":0.5,"blk":0.0,"tov":1.2,"fg":50.3,"fg3":35.2,"ft":91.3,"salary":15000000}}'::jsonb),
  ('9:braden smith', 9, 'Braden Smith', 'Braden Smith', 'PG', '{"is_starter":false,"roster_order":6,"player":{"name":"Braden Smith","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('9:jarace walker', 9, 'Jarace Walker', 'Jarace Walker', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Jarace Walker","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":76,"pts":11.6,"reb":5.1,"ast":2.5,"stl":0.8,"blk":0.3,"tov":1.8,"fg":41.9,"fg3":37.4,"ft":74.9,"salary":8400000}}'::jsonb),
  ('9:t.j. mcconnell', 9, 'T.J. McConnell', 'T.J. McConnell', 'PG', '{"is_starter":false,"roster_order":8,"player":{"name":"T.J. McConnell","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":56,"pts":9.4,"reb":2.2,"ast":5.1,"stl":1.0,"blk":0.2,"tov":1.1,"fg":53.8,"fg3":32.0,"ft":86.2,"salary":11000000}}'::jsonb),
  ('9:kelly oubre jr.', 9, 'Kelly Oubre Jr.', 'Kelly Oubre Jr.', 'SF', '{"is_starter":false,"roster_order":9,"player":{"name":"Kelly Oubre Jr.","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":50,"pts":14.1,"reb":5.0,"ast":1.6,"stl":1.4,"blk":0.5,"tov":1.4,"fg":46.7,"fg3":36.0,"ft":76.6,"salary":8000000}}'::jsonb),
  ('9:johnny furphy', 9, 'Johnny Furphy', 'Johnny Furphy', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Johnny Furphy","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":35,"pts":5.1,"reb":4.4,"ast":1.2,"stl":0.6,"blk":0.2,"tov":0.8,"fg":47.0,"fg3":32.4,"ft":48.6,"salary":2200000}}'::jsonb),
  ('9:jalen slawson', 9, 'Jalen Slawson', 'Jalen Slawson', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Jalen Slawson","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":13,"pts":7.3,"reb":4.4,"ast":2.8,"stl":1.5,"blk":1.1,"tov":1.3,"fg":44.2,"fg3":37.5,"ft":70.6,"salary":null}}'::jsonb),
  ('9:larry nance jr.', 9, 'Larry Nance Jr.', 'Larry Nance Jr.', 'PF', '{"is_starter":false,"roster_order":12,"player":{"name":"Larry Nance Jr.","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":35,"pts":3.7,"reb":2.7,"ast":1.0,"stl":0.6,"blk":0.2,"tov":0.6,"fg":41.9,"fg3":33.3,"ft":46.2,"salary":3800000}}'::jsonb),
  ('9:kobe brown', 9, 'Kobe Brown', 'Kobe Brown', 'PF', '{"is_starter":false,"roster_order":13,"player":{"name":"Kobe Brown","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":61,"pts":5.8,"reb":3.0,"ast":1.3,"stl":0.4,"blk":0.2,"tov":0.9,"fg":46.9,"fg3":37.4,"ft":79.7,"salary":0}}'::jsonb),
  ('9:ben sheppard', 9, 'Ben Sheppard', 'Ben Sheppard', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"Ben Sheppard","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":65,"pts":7.1,"reb":3.0,"ast":1.8,"stl":0.6,"blk":0.1,"tov":0.6,"fg":43.4,"fg3":36.2,"ft":76.5,"salary":5000000}}'::jsonb),
  ('9:quenton jackson', 9, 'Quenton Jackson', 'Quenton Jackson', 'SG', '{"is_starter":false,"roster_order":15,"player":{"name":"Quenton Jackson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":49,"pts":9.1,"reb":2.3,"ast":2.9,"stl":0.6,"blk":0.1,"tov":1.3,"fg":47.0,"fg3":35.6,"ft":82.4,"salary":2500000}}'::jsonb),
  ('9:jay huff', 9, 'Jay Huff', 'Jay Huff', 'C', '{"is_starter":false,"roster_order":16,"player":{"name":"Jay Huff","pos":"C","contract_type":null,"stats_season":"2025-26","gp":82,"pts":9.5,"reb":4.0,"ast":1.5,"stl":0.5,"blk":1.9,"tov":0.9,"fg":47.6,"fg3":31.9,"ft":82.8,"salary":2600000}}'::jsonb),
  ('9:ethan thompson', 9, 'Ethan Thompson', 'Ethan Thompson', 'F', '{"is_starter":false,"roster_order":17,"player":{"name":"Ethan Thompson","pos":"F","contract_type":null,"stats_season":"2025-26","gp":32,"pts":7.0,"reb":2.2,"ast":1.8,"stl":0.6,"blk":0.3,"tov":0.8,"fg":37.8,"fg3":32.8,"ft":78.7,"salary":0}}'::jsonb),
  ('9:taelon peter', 9, 'Taelon Peter', 'Taelon Peter', 'F', '{"is_starter":false,"roster_order":18,"player":{"name":"Taelon Peter","pos":"F","contract_type":null,"stats_season":"2025-26","gp":38,"pts":4.5,"reb":1.6,"ast":1.1,"stl":0.7,"blk":0.1,"tov":0.7,"fg":38.0,"fg3":32.8,"ft":62.5,"salary":0}}'::jsonb),
  ('10:ryan rollins', 10, 'Ryan Rollins', 'Ryan Rollins', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Ryan Rollins","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":74,"pts":17.3,"reb":4.6,"ast":5.6,"stl":1.5,"blk":0.4,"tov":2.7,"fg":47.2,"fg3":40.6,"ft":79.6,"salary":4000000}}'::jsonb),
  ('10:tyler herro', 10, 'Tyler Herro', 'Tyler Herro', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Tyler Herro","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":33,"pts":20.5,"reb":4.8,"ast":4.1,"stl":0.7,"blk":0.4,"tov":1.9,"fg":48.0,"fg3":37.8,"ft":91.7,"salary":33000000}}'::jsonb),
  ('10:jaime jaquez jr.', 10, 'Jaime Jaquez Jr.', 'Jaime Jaquez Jr.', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Jaime Jaquez Jr.","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":75,"pts":15.4,"reb":5.0,"ast":4.7,"stl":0.7,"blk":0.3,"tov":2.0,"fg":50.7,"fg3":31.7,"ft":76.9,"salary":5939141}}'::jsonb),
  ('10:kyle kuzma', 10, 'Kyle Kuzma', 'Kyle Kuzma', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Kyle Kuzma","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":69,"pts":13.0,"reb":4.5,"ast":2.7,"stl":0.7,"blk":0.4,"tov":1.7,"fg":49.2,"fg3":34.7,"ft":72.6,"salary":20345152}}'::jsonb),
  ('10:myles turner', 10, 'Myles Turner', 'Myles Turner', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Myles Turner","pos":"C","contract_type":null,"stats_season":"2025-26","gp":71,"pts":11.9,"reb":5.3,"ast":1.5,"stl":0.7,"blk":1.6,"tov":1.2,"fg":44.0,"fg3":38.3,"ft":74.0,"salary":26584164}}'::jsonb),
  ('10:malique lewis', 10, 'Malique Lewis', 'Malique Lewis', 'SF', '{"is_starter":false,"roster_order":5,"player":{"name":"Malique Lewis","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('10:nate ament', 10, 'Nate Ament', 'Nate Ament', 'SF', '{"is_starter":false,"roster_order":6,"player":{"name":"Nate Ament","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":5502000}}'::jsonb),
  ('10:brayden burries', 10, 'Brayden Burries', 'Brayden Burries', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"Brayden Burries","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":6417360}}'::jsonb),
  ('10:jericho sims', 10, 'Jericho Sims', 'Jericho Sims', 'C', '{"is_starter":false,"roster_order":8,"player":{"name":"Jericho Sims","pos":"C","contract_type":null,"stats_season":"2025-26","gp":67,"pts":5.0,"reb":5.5,"ast":1.6,"stl":0.3,"blk":0.3,"tov":1.1,"fg":78.4,"fg3":0.0,"ft":62.0,"salary":2801346}}'::jsonb),
  ('10:gary trent jr.', 10, 'Gary Trent Jr.', 'Gary Trent Jr.', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"Gary Trent Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":65,"pts":8.1,"reb":1.0,"ast":1.2,"stl":0.5,"blk":0.0,"tov":0.6,"fg":38.7,"fg3":36.0,"ft":76.9,"salary":15200000}}'::jsonb),
  ('10:kevin porter jr.', 10, 'Kevin Porter Jr.', 'Kevin Porter Jr.', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Kevin Porter Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":38,"pts":17.4,"reb":5.2,"ast":7.4,"stl":2.2,"blk":0.5,"tov":2.9,"fg":46.5,"fg3":32.2,"ft":87.8,"salary":5390700}}'::jsonb),
  ('10:kam jones', 10, 'Kam Jones', 'Kam Jones', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Kam Jones","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":37,"pts":4.4,"reb":1.6,"ast":3.2,"stl":0.5,"blk":0.0,"tov":1.0,"fg":40.2,"fg3":29.3,"ft":50.0,"salary":null}}'::jsonb),
  ('10:caris levert', 10, 'Caris LeVert', 'Caris LeVert', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Caris LeVert","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":60,"pts":7.4,"reb":2.0,"ast":2.7,"stl":0.9,"blk":0.7,"tov":1.4,"fg":41.7,"fg3":33.3,"ft":67.9,"salary":14809200}}'::jsonb),
  ('10:kel''el ware', 10, 'Kel''el Ware', 'Kel''el Ware', 'C', '{"is_starter":false,"roster_order":13,"player":{"name":"Kel''el Ware","pos":"C","contract_type":null,"stats_season":"2025-26","gp":77,"pts":11.1,"reb":9.0,"ast":0.7,"stl":0.8,"blk":1.1,"tov":0.8,"fg":53.0,"fg3":39.5,"ft":74.0,"salary":4654920}}'::jsonb),
  ('10:john butler jr.', 10, 'John Butler Jr.', 'John Butler Jr.', 'C', '{"is_starter":false,"roster_order":14,"player":{"name":"John Butler Jr.","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2449421}}'::jsonb),
  ('10:aj green', 10, 'AJ Green', 'AJ Green', 'SG', '{"is_starter":false,"roster_order":15,"player":{"name":"AJ Green","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":78,"pts":10.4,"reb":2.7,"ast":1.9,"stl":0.5,"blk":0.1,"tov":1.0,"fg":42.4,"fg3":41.9,"ft":85.5,"salary":10044644}}'::jsonb),
  ('10:ousmane dieng', 10, 'Ousmane Dieng', 'Ousmane Dieng', 'SF', '{"is_starter":false,"roster_order":16,"player":{"name":"Ousmane Dieng","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":57,"pts":7.6,"reb":3.2,"ast":2.4,"stl":0.4,"blk":0.3,"tov":1.3,"fg":42.2,"fg3":34.1,"ft":71.1,"salary":5750000}}'::jsonb),
  ('10:bogoljub markovic', 10, 'Bogoljub Markovic', 'Bogoljub Markovic', 'PF', '{"is_starter":false,"roster_order":17,"player":{"name":"Bogoljub Markovic","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('10:kasparas jakučionis', 10, 'Kasparas Jakučionis', 'Kasparas Jakučionis', 'PG', '{"is_starter":false,"roster_order":18,"player":{"name":"Kasparas Jakučionis","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":53,"pts":6.2,"reb":2.6,"ast":2.6,"stl":0.6,"blk":0.1,"tov":0.9,"fg":42.9,"fg3":42.3,"ft":87.9,"salary":3841680}}'::jsonb),
  ('10:cormac ryan', 10, 'Cormac Ryan', 'Cormac Ryan', 'SG', '{"is_starter":false,"roster_order":19,"player":{"name":"Cormac Ryan","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":11,"pts":14.3,"reb":2.5,"ast":1.7,"stl":1.0,"blk":0.3,"tov":1.5,"fg":52.0,"fg3":45.8,"ft":92.3,"salary":null}}'::jsonb),
  ('10:pete nance', 10, 'Pete Nance', 'Pete Nance', 'PF', '{"is_starter":false,"roster_order":20,"player":{"name":"Pete Nance","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":47,"pts":5.4,"reb":2.7,"ast":1.0,"stl":0.3,"blk":0.3,"tov":0.6,"fg":51.5,"fg3":42.0,"ft":36.4,"salary":2537526}}'::jsonb),
  ('11:davion mitchell', 11, 'Davion Mitchell', 'Davion Mitchell', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Davion Mitchell","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":9.3,"reb":2.7,"ast":6.5,"stl":1.0,"blk":0.2,"tov":1.5,"fg":49.0,"fg3":39.5,"ft":64.6,"salary":12400000}}'::jsonb),
  ('11:tim hardaway jr.', 11, 'Tim Hardaway Jr.', 'Tim Hardaway Jr.', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Tim Hardaway Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":80,"pts":13.5,"reb":2.6,"ast":1.4,"stl":0.5,"blk":0.1,"tov":0.5,"fg":44.7,"fg3":40.7,"ft":81.1,"salary":6500000}}'::jsonb),
  ('11:andrew wiggins', 11, 'Andrew Wiggins', 'Andrew Wiggins', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Andrew Wiggins","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":68,"pts":15.4,"reb":4.8,"ast":2.7,"stl":1.1,"blk":1.0,"tov":1.5,"fg":47.5,"fg3":41.4,"ft":78.4,"salary":30169644}}'::jsonb),
  ('11:giannis antetokounmpo', 11, 'Giannis Antetokounmpo', 'Giannis Antetokounmpo', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Giannis Antetokounmpo","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":36,"pts":27.6,"reb":9.8,"ast":5.4,"stl":0.9,"blk":0.7,"tov":3.2,"fg":62.4,"fg3":33.3,"ft":65.0,"salary":58456566}}'::jsonb),
  ('11:bam adebayo', 11, 'Bam Adebayo', 'Bam Adebayo', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Bam Adebayo","pos":"C","contract_type":null,"stats_season":"2025-26","gp":73,"pts":20.1,"reb":10.0,"ast":3.2,"stl":1.2,"blk":0.7,"tov":1.6,"fg":44.2,"fg3":31.8,"ft":77.8,"salary":49800000}}'::jsonb),
  ('11:j''vonne hadley', 11, 'J''Vonne Hadley', 'J''Vonne Hadley', 'SF', '{"is_starter":false,"roster_order":5,"player":{"name":"J''Vonne Hadley","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('11:simone fontecchio', 11, 'Simone Fontecchio', 'Simone Fontecchio', 'SF', '{"is_starter":false,"roster_order":6,"player":{"name":"Simone Fontecchio","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":70,"pts":8.5,"reb":3.0,"ast":1.4,"stl":0.5,"blk":0.1,"tov":0.7,"fg":41.2,"fg3":37.5,"ft":84.3,"salary":2449421}}'::jsonb),
  ('11:trevor keels', 11, 'Trevor Keels', 'Trevor Keels', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"Trevor Keels","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":8,"pts":1.0,"reb":0.3,"ast":0.0,"stl":0.1,"blk":0.0,"tov":0.0,"fg":25.0,"fg3":22.2,"ft":0.0,"salary":null}}'::jsonb),
  ('11:ryan conwell', 11, 'Ryan Conwell', 'Ryan Conwell', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Ryan Conwell","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('11:nikola jović', 11, 'Nikola Jović', 'Nikola Jović', 'PF', '{"is_starter":false,"roster_order":9,"player":{"name":"Nikola Jović","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":47,"pts":7.3,"reb":3.3,"ast":2.2,"stl":0.6,"blk":0.4,"tov":1.4,"fg":36.6,"fg3":26.9,"ft":68.3,"salary":16200000}}'::jsonb),
  ('11:nick richards', 11, 'Nick Richards', 'Nick Richards', 'C', '{"is_starter":false,"roster_order":10,"player":{"name":"Nick Richards","pos":"C","contract_type":null,"stats_season":"2025-26","gp":48,"pts":5.8,"reb":5.1,"ast":0.3,"stl":0.2,"blk":0.7,"tov":1.2,"fg":51.2,"fg3":27.8,"ft":64.4,"salary":2449421}}'::jsonb),
  ('11:pelle larsson', 11, 'Pelle Larsson', 'Pelle Larsson', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Pelle Larsson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":11.4,"reb":3.5,"ast":3.4,"stl":0.7,"blk":0.2,"tov":1.4,"fg":49.6,"fg3":32.3,"ft":79.7,"salary":2296271}}'::jsonb),
  ('11:klay thompson', 11, 'Klay Thompson', 'Klay Thompson', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Klay Thompson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":11.7,"reb":2.1,"ast":1.4,"stl":0.5,"blk":0.3,"tov":0.9,"fg":39.3,"fg3":38.3,"ft":76.6,"salary":5600000}}'::jsonb),
  ('11:dru smith', 11, 'Dru Smith', 'Dru Smith', 'PG', '{"is_starter":false,"roster_order":13,"player":{"name":"Dru Smith","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":5.6,"reb":2.5,"ast":2.6,"stl":1.4,"blk":0.3,"tov":0.8,"fg":41.5,"fg3":29.5,"ft":82.9,"salary":2584539}}'::jsonb),
  ('11:myron gardner', 11, 'Myron Gardner', 'Myron Gardner', 'SF', '{"is_starter":false,"roster_order":14,"player":{"name":"Myron Gardner","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":45,"pts":3.6,"reb":2.7,"ast":1.0,"stl":0.4,"blk":0.2,"tov":0.4,"fg":48.0,"fg3":40.6,"ft":73.1,"salary":2150917}}'::jsonb),
  ('11:keshad johnson', 11, 'Keshad Johnson', 'Keshad Johnson', 'PF', '{"is_starter":false,"roster_order":15,"player":{"name":"Keshad Johnson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":32,"pts":4.3,"reb":1.9,"ast":0.3,"stl":0.5,"blk":0.3,"tov":0.4,"fg":49.0,"fg3":29.5,"ft":72.4,"salary":null}}'::jsonb),
  ('11:jahmir young', 11, 'Jahmir Young', 'Jahmir Young', 'PG', '{"is_starter":false,"roster_order":16,"player":{"name":"Jahmir Young","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":14,"pts":1.8,"reb":0.3,"ast":0.6,"stl":0.1,"blk":0.0,"tov":0.2,"fg":40.0,"fg3":33.3,"ft":100.0,"salary":null}}'::jsonb),
  ('11:tre donaldson', 11, 'Tre Donaldson', 'Tre Donaldson', 'PG', '{"is_starter":false,"roster_order":17,"player":{"name":"Tre Donaldson","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('11:vladislav goldin', 11, 'Vladislav Goldin', 'Vladislav Goldin', 'C', '{"is_starter":false,"roster_order":18,"player":{"name":"Vladislav Goldin","pos":"C","contract_type":null,"stats_season":"2025-26","gp":9,"pts":0.8,"reb":1.0,"ast":0.3,"stl":0.0,"blk":0.3,"tov":0.3,"fg":75.0,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('11:bobby portis jr.', 11, 'Bobby Portis Jr.', 'Bobby Portis Jr.', 'PF', '{"is_starter":false,"roster_order":19,"player":{"name":"Bobby Portis Jr.","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":67,"pts":13.7,"reb":6.4,"ast":1.6,"stl":0.6,"blk":0.2,"tov":1.0,"fg":48.8,"fg3":45.6,"ft":70.6,"salary":14521414}}'::jsonb),
  ('11:bez mbeng', 11, 'Bez Mbeng', 'Bez Mbeng', 'F', '{"is_starter":false,"roster_order":20,"player":{"name":"Bez Mbeng","pos":"F","contract_type":null,"stats_season":"2025-26","gp":15,"pts":8.1,"reb":3.8,"ast":4.1,"stl":2.3,"blk":0.3,"tov":1.5,"fg":50.0,"fg3":19.4,"ft":64.0,"salary":2185116}}'::jsonb),
  ('12:c.j. mccollum', 12, 'C.J. McCollum', 'C.J. McCollum', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"C.J. McCollum","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":76,"pts":18.7,"reb":3.3,"ast":3.9,"stl":0.8,"blk":0.5,"tov":1.8,"fg":45.5,"fg3":37.5,"ft":77.2,"salary":21000000}}'::jsonb),
  ('12:nickeil alexander-walker', 12, 'Nickeil Alexander-Walker', 'Nickeil Alexander-Walker', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Nickeil Alexander-Walker","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":78,"pts":20.8,"reb":3.4,"ast":3.7,"stl":1.3,"blk":0.5,"tov":2.1,"fg":45.9,"fg3":39.9,"ft":90.2,"salary":14400000}}'::jsonb),
  ('12:dyson daniels', 12, 'Dyson Daniels', 'Dyson Daniels', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Dyson Daniels","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":76,"pts":11.9,"reb":6.8,"ast":5.9,"stl":2.0,"blk":0.4,"tov":1.8,"fg":51.7,"fg3":18.8,"ft":61.5,"salary":25000000}}'::jsonb),
  ('12:jalen johnson', 12, 'Jalen Johnson', 'Jalen Johnson', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Jalen Johnson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":72,"pts":22.5,"reb":10.3,"ast":7.9,"stl":1.2,"blk":0.4,"tov":3.4,"fg":48.9,"fg3":35.2,"ft":78.8,"salary":30000000}}'::jsonb),
  ('12:onyeka okongwu', 12, 'Onyeka Okongwu', 'Onyeka Okongwu', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Onyeka Okongwu","pos":"C","contract_type":null,"stats_season":"2025-26","gp":74,"pts":15.2,"reb":7.6,"ast":3.1,"stl":1.1,"blk":1.1,"tov":1.7,"fg":48.0,"fg3":37.6,"ft":75.7,"salary":16100000}}'::jsonb),
  ('12:keshon gilbert', 12, 'Keshon Gilbert', 'Keshon Gilbert', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Keshon Gilbert","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":4,"pts":4.3,"reb":1.3,"ast":3.0,"stl":0.8,"blk":1.0,"tov":2.0,"fg":41.7,"fg3":0.0,"ft":100.0,"salary":0}}'::jsonb),
  ('12:rayj dennis', 12, 'RayJ Dennis', 'RayJ Dennis', 'PG', '{"is_starter":false,"roster_order":6,"player":{"name":"RayJ Dennis","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":17,"pts":4.4,"reb":1.5,"ast":1.9,"stl":0.2,"blk":0.2,"tov":1.0,"fg":31.3,"fg3":31.1,"ft":88.9,"salary":0}}'::jsonb),
  ('12:kingston flemings', 12, 'Kingston Flemings', 'Kingston Flemings', 'PG', '{"is_starter":false,"roster_order":7,"player":{"name":"Kingston Flemings","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":7300000}}'::jsonb),
  ('12:dorian finney-smith', 12, 'Dorian Finney-Smith', 'Dorian Finney-Smith', 'SF', '{"is_starter":false,"roster_order":8,"player":{"name":"Dorian Finney-Smith","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":37,"pts":3.3,"reb":2.5,"ast":1.0,"stl":0.4,"blk":0.2,"tov":0.6,"fg":33.3,"fg3":27.0,"ft":88.9,"salary":13335000}}'::jsonb),
  ('12:ryan nembhard', 12, 'Ryan Nembhard', 'Ryan Nembhard', 'PG', '{"is_starter":false,"roster_order":9,"player":{"name":"Ryan Nembhard","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":60,"pts":6.6,"reb":2.2,"ast":5.3,"stl":0.4,"blk":0.0,"tov":1.4,"fg":41.5,"fg3":35.6,"ft":80.6,"salary":null}}'::jsonb),
  ('12:henri veesaar', 12, 'Henri Veesaar', 'Henri Veesaar', 'C', '{"is_starter":false,"roster_order":10,"player":{"name":"Henri Veesaar","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('12:asa newell', 12, 'Asa Newell', 'Asa Newell', 'PF', '{"is_starter":false,"roster_order":11,"player":{"name":"Asa Newell","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":44,"pts":5.2,"reb":2.2,"ast":0.6,"stl":0.4,"blk":0.3,"tov":0.5,"fg":53.8,"fg3":38.7,"ft":55.2,"salary":3300000}}'::jsonb),
  ('12:mouhamed gueye', 12, 'Mouhamed Gueye', 'Mouhamed Gueye', 'PF', '{"is_starter":false,"roster_order":12,"player":{"name":"Mouhamed Gueye","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":4.4,"reb":3.6,"ast":0.9,"stl":0.8,"blk":0.5,"tov":0.4,"fg":45.2,"fg3":30.8,"ft":64.5,"salary":2400000}}'::jsonb),
  ('12:zuby ejiofor', 12, 'Zuby Ejiofor', 'Zuby Ejiofor', 'PF', '{"is_starter":false,"roster_order":13,"player":{"name":"Zuby Ejiofor","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3400000}}'::jsonb),
  ('12:aaron wiggins', 12, 'Aaron Wiggins', 'Aaron Wiggins', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"Aaron Wiggins","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":65,"pts":9.4,"reb":3.1,"ast":1.7,"stl":0.9,"blk":0.4,"tov":1.2,"fg":43.1,"fg3":35.6,"ft":73.6,"salary":8800000}}'::jsonb),
  ('12:jalen wilson', 12, 'Jalen Wilson', 'Jalen Wilson', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Jalen Wilson","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":54,"pts":6.4,"reb":2.1,"ast":0.9,"stl":0.4,"blk":0.0,"tov":0.7,"fg":39.6,"fg3":35.5,"ft":71.9,"salary":null}}'::jsonb),
  ('12:corey kispert', 12, 'Corey Kispert', 'Corey Kispert', 'SF', '{"is_starter":false,"roster_order":16,"player":{"name":"Corey Kispert","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":58,"pts":9.2,"reb":2.3,"ast":1.6,"stl":0.3,"blk":0.2,"tov":0.8,"fg":46.7,"fg3":36.7,"ft":79.4,"salary":13900000}}'::jsonb),
  ('12:jock landale', 12, 'Jock Landale', 'Jock Landale', 'C', '{"is_starter":false,"roster_order":17,"player":{"name":"Jock Landale","pos":"C","contract_type":null,"stats_season":"2025-26","gp":68,"pts":10.6,"reb":5.7,"ast":1.7,"stl":0.5,"blk":0.5,"tov":0.9,"fg":51.5,"fg3":38.3,"ft":63.5,"salary":14100000}}'::jsonb),
  ('12:jonathan kuminga', 12, 'Jonathan Kuminga', 'Jonathan Kuminga', 'F', '{"is_starter":false,"roster_order":18,"player":{"name":"Jonathan Kuminga","pos":"F","contract_type":null,"stats_season":"2025-26","gp":36,"pts":12.2,"reb":5.6,"ast":2.3,"stl":0.6,"blk":0.3,"tov":1.9,"fg":46.3,"fg3":33.3,"ft":72.4,"salary":0}}'::jsonb),
  ('12:luguentz dort', 12, 'Luguentz Dort', 'Luguentz Dort', 'SG', '{"is_starter":false,"roster_order":19,"player":{"name":"Luguentz Dort","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":8.3,"reb":3.6,"ast":1.2,"stl":0.9,"blk":0.4,"tov":0.8,"fg":38.5,"fg3":34.4,"ft":75.9,"salary":18222222,"contract_note":"2026-27 salary: $18,222,222 (Basketball-Reference)."}}'::jsonb),
  ('13:coby white', 13, 'Coby White', 'Coby White', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Coby White","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":50,"pts":17.4,"reb":3.4,"ast":4.0,"stl":0.5,"blk":0.1,"tov":2.6,"fg":44.6,"fg3":36.2,"ft":81.7,"salary":26800000}}'::jsonb),
  ('13:kon knueppel', 13, 'Kon Knueppel', 'Kon Knueppel', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Kon Knueppel","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":81,"pts":18.5,"reb":5.3,"ast":3.4,"stl":0.7,"blk":0.2,"tov":2.0,"fg":47.5,"fg3":42.5,"ft":86.3,"salary":10500000}}'::jsonb),
  ('13:brandon miller', 13, 'Brandon Miller', 'Brandon Miller', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Brandon Miller","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":65,"pts":20.2,"reb":4.9,"ast":3.3,"stl":1.0,"blk":0.7,"tov":2.5,"fg":43.5,"fg3":38.3,"ft":89.2,"salary":15100000}}'::jsonb),
  ('13:naz reid', 13, 'Naz Reid', 'Naz Reid', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Naz Reid","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":13.6,"reb":6.2,"ast":2.2,"stl":1.0,"blk":1.0,"tov":1.6,"fg":45.6,"fg3":36.2,"ft":73.2,"salary":23300000}}'::jsonb),
  ('13:moussa diabaté', 13, 'Moussa Diabaté', 'Moussa Diabaté', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Moussa Diabaté","pos":"C","contract_type":null,"stats_season":"2025-26","gp":73,"pts":7.9,"reb":8.7,"ast":1.9,"stl":0.8,"blk":1.0,"tov":1.0,"fg":63.1,"fg3":50.0,"ft":65.9,"salary":2400000}}'::jsonb),
  ('13:michael ajayi', 13, 'Michael Ajayi', 'Michael Ajayi', 'SG', '{"is_starter":false,"roster_order":5,"player":{"name":"Michael Ajayi","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('13:kylan boswell', 13, 'Kylan Boswell', 'Kylan Boswell', 'PG', '{"is_starter":false,"roster_order":6,"player":{"name":"Kylan Boswell","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('13:royce o''neale', 13, 'Royce O''Neale', 'Royce O''Neale', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Royce O''Neale","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":78,"pts":9.8,"reb":4.8,"ast":2.7,"stl":1.1,"blk":0.4,"tov":1.3,"fg":42.1,"fg3":40.8,"ft":71.1,"salary":10800000}}'::jsonb),
  ('13:grant williams', 13, 'Grant Williams', 'Grant Williams', 'PF', '{"is_starter":false,"roster_order":8,"player":{"name":"Grant Williams","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":36,"pts":7.0,"reb":3.9,"ast":1.6,"stl":0.5,"blk":0.5,"tov":0.9,"fg":42.6,"fg3":38.8,"ft":81.5,"salary":14200000}}'::jsonb),
  ('13:sion james', 13, 'Sion James', 'Sion James', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"Sion James","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":5.4,"reb":3.5,"ast":2.0,"stl":0.6,"blk":0.2,"tov":0.8,"fg":37.1,"fg3":35.2,"ft":83.7,"salary":2400000}}'::jsonb),
  ('13:christian anderson', 13, 'Christian Anderson', 'Christian Anderson', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Christian Anderson","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":4200000}}'::jsonb),
  ('13:grayson allen', 13, 'Grayson Allen', 'Grayson Allen', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Grayson Allen","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":51,"pts":16.5,"reb":3.0,"ast":3.8,"stl":1.4,"blk":0.3,"tov":1.6,"fg":40.3,"fg3":34.9,"ft":85.7,"salary":18100000}}'::jsonb),
  ('13:dennis schröder', 13, 'Dennis Schröder', 'Dennis Schröder', 'PG', '{"is_starter":false,"roster_order":12,"player":{"name":"Dennis Schröder","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":10.8,"reb":2.7,"ast":4.9,"stl":0.8,"blk":0.2,"tov":1.8,"fg":40.5,"fg3":32.9,"ft":83.4,"salary":14800000}}'::jsonb),
  ('13:ryan kalkbrenner', 13, 'Ryan Kalkbrenner', 'Ryan Kalkbrenner', 'C', '{"is_starter":false,"roster_order":13,"player":{"name":"Ryan Kalkbrenner","pos":"C","contract_type":null,"stats_season":"2025-26","gp":69,"pts":7.6,"reb":5.5,"ast":0.8,"stl":0.5,"blk":1.5,"tov":0.9,"fg":75.3,"fg3":0.0,"ft":71.6,"salary":2400000}}'::jsonb),
  ('13:antonio reeves', 13, 'Antonio Reeves', 'Antonio Reeves', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"Antonio Reeves","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":10,"pts":2.7,"reb":0.8,"ast":0.3,"stl":0.1,"blk":0.0,"tov":0.1,"fg":50.0,"fg3":53.8,"ft":0.0,"salary":null}}'::jsonb),
  ('13:pj hall', 13, 'PJ Hall', 'PJ Hall', 'C', '{"is_starter":false,"roster_order":15,"player":{"name":"PJ Hall","pos":"C","contract_type":null,"stats_season":"2025-26","gp":19,"pts":4.5,"reb":3.9,"ast":0.5,"stl":0.2,"blk":0.5,"tov":0.8,"fg":50.8,"fg3":60.0,"ft":79.3,"salary":0}}'::jsonb),
  ('13:pat connaughton', 13, 'Pat Connaughton', 'Pat Connaughton', 'SG', '{"is_starter":false,"roster_order":16,"player":{"name":"Pat Connaughton","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":42,"pts":2.6,"reb":1.5,"ast":0.4,"stl":0.3,"blk":0.0,"tov":0.3,"fg":44.7,"fg3":40.4,"ft":65.0,"salary":3800000}}'::jsonb),
  ('13:bez mbeng', 13, 'Bez Mbeng', 'Bez Mbeng', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Bez Mbeng","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":15,"pts":8.1,"reb":3.8,"ast":4.1,"stl":2.3,"blk":0.3,"tov":1.5,"fg":50.0,"fg3":19.4,"ft":64.0,"salary":null}}'::jsonb),
  ('13:hannes steinbach', 13, 'Hannes Steinbach', 'Hannes Steinbach', 'PF', '{"is_starter":false,"roster_order":18,"player":{"name":"Hannes Steinbach","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":5200000}}'::jsonb),
  ('13:xavier tillman', 13, 'Xavier Tillman', 'Xavier Tillman', 'PF', '{"is_starter":false,"roster_order":19,"player":{"name":"Xavier Tillman","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":30,"pts":1.5,"reb":1.4,"ast":0.4,"stl":0.3,"blk":0.2,"tov":0.3,"fg":43.5,"fg3":16.7,"ft":25.0,"salary":null}}'::jsonb),
  ('13:tidjane salaün', 13, 'Tidjane Salaün', 'Tidjane Salaün', 'PF', '{"is_starter":false,"roster_order":20,"player":{"name":"Tidjane Salaün","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":37,"pts":6.0,"reb":4.0,"ast":0.7,"stl":0.4,"blk":0.2,"tov":0.7,"fg":50.3,"fg3":43.4,"ft":65.0,"salary":8200000}}'::jsonb),
  ('13:liam mcneeley', 13, 'Liam McNeeley', 'Liam McNeeley', 'SF', '{"is_starter":false,"roster_order":21,"player":{"name":"Liam McNeeley","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":31,"pts":4.3,"reb":2.4,"ast":0.8,"stl":0.2,"blk":0.1,"tov":0.4,"fg":40.0,"fg3":40.0,"ft":82.1,"salary":2900000}}'::jsonb),
  ('13:mouhamadou gueye', 13, 'Mouhamadou Gueye', 'Mouhamadou Gueye', 'F', '{"is_starter":false,"roster_order":22,"player":{"name":"Mouhamadou Gueye","pos":"F","contract_type":null,"stats_season":"2025-26","gp":2,"pts":8.0,"reb":3.0,"ast":3.0,"stl":1.0,"blk":0.5,"tov":1.5,"fg":54.5,"fg3":20.0,"ft":75.0,"salary":2400000}}'::jsonb),
  ('14:jalen suggs', 14, 'Jalen Suggs', 'Jalen Suggs', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Jalen Suggs","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":57,"pts":13.8,"reb":3.9,"ast":5.5,"stl":1.8,"blk":0.7,"tov":2.7,"fg":43.5,"fg3":33.9,"ft":85.5,"salary":32400000}}'::jsonb),
  ('14:desmond bane', 14, 'Desmond Bane', 'Desmond Bane', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Desmond Bane","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":20.1,"reb":4.1,"ast":4.1,"stl":1.0,"blk":0.5,"tov":2.0,"fg":48.4,"fg3":39.1,"ft":90.8,"salary":39446090}}'::jsonb),
  ('14:franz wagner', 14, 'Franz Wagner', 'Franz Wagner', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Franz Wagner","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":34,"pts":20.6,"reb":5.2,"ast":3.3,"stl":0.9,"blk":0.3,"tov":1.7,"fg":48.1,"fg3":34.5,"ft":82.3,"salary":41754690}}'::jsonb),
  ('14:paolo banchero', 14, 'Paolo Banchero', 'Paolo Banchero', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Paolo Banchero","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":72,"pts":22.2,"reb":8.4,"ast":5.2,"stl":0.7,"blk":0.6,"tov":3.1,"fg":45.9,"fg3":30.5,"ft":77.5,"salary":41500000}}'::jsonb),
  ('14:wendell carter jr.', 14, 'Wendell Carter Jr.', 'Wendell Carter Jr.', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Wendell Carter Jr.","pos":"C","contract_type":null,"stats_season":"2025-26","gp":78,"pts":11.8,"reb":7.4,"ast":2.0,"stl":0.8,"blk":0.6,"tov":1.3,"fg":51.2,"fg3":31.9,"ft":79.2,"salary":18102000}}'::jsonb),
  ('14:anthony black', 14, 'Anthony Black', 'Anthony Black', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Anthony Black","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":64,"pts":15.0,"reb":3.8,"ast":3.7,"stl":1.4,"blk":0.7,"tov":2.1,"fg":44.7,"fg3":33.3,"ft":73.2,"salary":10106316}}'::jsonb),
  ('14:jonathan isaac', 14, 'Jonathan Isaac', 'Jonathan Isaac', 'PF', '{"is_starter":false,"roster_order":6,"player":{"name":"Jonathan Isaac","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":52,"pts":2.6,"reb":2.5,"ast":0.4,"stl":0.4,"blk":0.6,"tov":0.3,"fg":42.2,"fg3":18.4,"ft":60.3,"salary":10449421}}'::jsonb),
  ('14:jevon carter', 14, 'Jevon Carter', 'Jevon Carter', 'PG', '{"is_starter":false,"roster_order":7,"player":{"name":"Jevon Carter","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":53,"pts":6.4,"reb":1.7,"ast":1.6,"stl":0.8,"blk":0.2,"tov":0.7,"fg":40.1,"fg3":36.3,"ft":78.9,"salary":2449421}}'::jsonb),
  ('14:jd davison', 14, 'JD Davison', 'JD Davison', 'PG', '{"is_starter":false,"roster_order":8,"player":{"name":"JD Davison","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":28,"pts":2.5,"reb":1.2,"ast":1.3,"stl":0.2,"blk":0.2,"tov":0.3,"fg":37.5,"fg3":25.0,"ft":68.4,"salary":2625627}}'::jsonb),
  ('14:malaki branham', 14, 'Malaki Branham', 'Malaki Branham', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"Malaki Branham","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":28,"pts":4.6,"reb":1.6,"ast":0.8,"stl":0.4,"blk":0.1,"tov":0.5,"fg":47.3,"fg3":37.8,"ft":82.4,"salary":2537526}}'::jsonb),
  ('14:jamal cain', 14, 'Jamal Cain', 'Jamal Cain', 'SF', '{"is_starter":false,"roster_order":10,"player":{"name":"Jamal Cain","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":40,"pts":5.4,"reb":2.0,"ast":0.7,"stl":0.3,"blk":0.1,"tov":0.5,"fg":48.7,"fg3":38.4,"ft":84.8,"salary":2584539}}'::jsonb),
  ('14:nikola vučević', 14, 'Nikola Vučević', 'Nikola Vučević', 'C', '{"is_starter":false,"roster_order":11,"player":{"name":"Nikola Vučević","pos":"C","contract_type":null,"stats_season":"2025-26","gp":64,"pts":15.1,"reb":8.4,"ast":3.3,"stl":0.6,"blk":0.6,"tov":1.3,"fg":49.3,"fg3":36.9,"ft":82.8,"salary":2449421}}'::jsonb),
  ('14:jase richardson', 14, 'Jase Richardson', 'Jase Richardson', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Jase Richardson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":54,"pts":4.4,"reb":1.2,"ast":1.1,"stl":0.4,"blk":0.0,"tov":0.5,"fg":47.3,"fg3":35.4,"ft":71.7,"salary":3132360}}'::jsonb),
  ('14:colin castleton', 14, 'Colin Castleton', 'Colin Castleton', 'C', '{"is_starter":false,"roster_order":13,"player":{"name":"Colin Castleton","pos":"C","contract_type":null,"stats_season":"2025-26","gp":4,"pts":1.3,"reb":2.0,"ast":0.3,"stl":0.3,"blk":0.0,"tov":0.5,"fg":40.0,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('14:tristan da silva', 14, 'Tristan da Silva', 'Tristan da Silva', 'SF', '{"is_starter":false,"roster_order":14,"player":{"name":"Tristan da Silva","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":9.9,"reb":3.7,"ast":1.6,"stl":0.9,"blk":0.3,"tov":0.9,"fg":45.0,"fg3":37.4,"ft":88.4,"salary":3991200}}'::jsonb),
  ('14:izaiyah nelson', 14, 'Izaiyah Nelson', 'Izaiyah Nelson', 'PF', '{"is_starter":false,"roster_order":15,"player":{"name":"Izaiyah Nelson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('14:alex morales', 14, 'Alex Morales', 'Alex Morales', 'SG', '{"is_starter":false,"roster_order":16,"player":{"name":"Alex Morales","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":4,"pts":2.0,"reb":0.8,"ast":1.0,"stl":0.0,"blk":0.0,"tov":1.0,"fg":42.9,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('14:goga bitadze', 14, 'Goga Bitadze', 'Goga Bitadze', 'C', '{"is_starter":false,"roster_order":17,"player":{"name":"Goga Bitadze","pos":"C","contract_type":null,"stats_season":"2025-26","gp":64,"pts":5.9,"reb":5.0,"ast":1.3,"stl":0.6,"blk":1.0,"tov":0.7,"fg":67.6,"fg3":18.2,"ft":71.1,"salary":7608696}}'::jsonb),
  ('14:noah penda', 14, 'Noah Penda', 'Noah Penda', 'SF', '{"is_starter":false,"roster_order":18,"player":{"name":"Noah Penda","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":59,"pts":3.8,"reb":3.2,"ast":1.2,"stl":0.5,"blk":0.3,"tov":0.7,"fg":40.4,"fg3":32.3,"ft":68.8,"salary":2150917}}'::jsonb),
  ('15:trae young', 15, 'Trae Young', 'Trae Young', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Trae Young","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":15,"pts":17.9,"reb":2.0,"ast":8.0,"stl":0.9,"blk":0.1,"tov":2.6,"fg":45.8,"fg3":33.8,"ft":82.5,"salary":49488300}}'::jsonb),
  ('15:kyshawn george', 15, 'Kyshawn George', 'Kyshawn George', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Kyshawn George","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":48,"pts":14.8,"reb":5.1,"ast":4.5,"stl":1.0,"blk":0.9,"tov":2.6,"fg":43.8,"fg3":38.1,"ft":80.2,"salary":3108000}}'::jsonb),
  ('15:bilal coulibaly', 15, 'Bilal Coulibaly', 'Bilal Coulibaly', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Bilal Coulibaly","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":56,"pts":11.7,"reb":4.3,"ast":2.6,"stl":1.3,"blk":1.0,"tov":1.4,"fg":42.5,"fg3":31.9,"ft":74.6,"salary":9240012}}'::jsonb),
  ('15:alex sarr', 15, 'Alex Sarr', 'Alex Sarr', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Alex Sarr","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":48,"pts":16.3,"reb":7.4,"ast":2.7,"stl":0.8,"blk":2.0,"tov":1.7,"fg":48.2,"fg3":33.3,"ft":69.2,"salary":12370680}}'::jsonb),
  ('15:anthony davis', 15, 'Anthony Davis', 'Anthony Davis', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Anthony Davis","pos":"C","contract_type":null,"stats_season":"2025-26","gp":20,"pts":20.4,"reb":11.1,"ast":2.8,"stl":1.1,"blk":1.7,"tov":2.1,"fg":50.6,"fg3":27.0,"ft":72.8,"salary":58456566}}'::jsonb),
  ('15:felix okpara', 15, 'Felix Okpara', 'Felix Okpara', 'C', '{"is_starter":false,"roster_order":5,"player":{"name":"Felix Okpara","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('15:tristan vukcevic', 15, 'Tristan Vukcevic', 'Tristan Vukcevic', 'PF', '{"is_starter":false,"roster_order":6,"player":{"name":"Tristan Vukcevic","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":49,"pts":9.0,"reb":3.0,"ast":1.1,"stl":0.5,"blk":0.7,"tov":1.3,"fg":47.9,"fg3":34.7,"ft":78.4,"salary":null}}'::jsonb),
  ('15:aj dybantsa', 15, 'AJ Dybantsa', 'AJ Dybantsa', 'SF', '{"is_starter":false,"roster_order":7,"player":{"name":"AJ Dybantsa","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":14748000}}'::jsonb),
  ('15:jamir watkins', 15, 'Jamir Watkins', 'Jamir Watkins', 'SF', '{"is_starter":false,"roster_order":8,"player":{"name":"Jamir Watkins","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":50,"pts":7.4,"reb":3.9,"ast":1.3,"stl":1.1,"blk":0.5,"tov":0.8,"fg":44.6,"fg3":29.7,"ft":69.5,"salary":null}}'::jsonb),
  ('15:deandre ayton', 15, 'Deandre Ayton', 'Deandre Ayton', 'C', '{"is_starter":false,"roster_order":9,"player":{"name":"Deandre Ayton","pos":"C","contract_type":null,"stats_season":"2025-26","gp":72,"pts":12.5,"reb":8.0,"ast":0.8,"stl":0.6,"blk":1.0,"tov":1.2,"fg":67.1,"fg3":0.0,"ft":64.5,"salary":8104000}}'::jsonb),
  ('15:bub carrington', 15, 'Bub Carrington', 'Bub Carrington', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Bub Carrington","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":10.7,"reb":3.4,"ast":4.6,"stl":0.6,"blk":0.2,"tov":2.3,"fg":42.4,"fg3":40.8,"ft":73.0,"salary":4900560}}'::jsonb),
  ('15:justin champagnie', 15, 'Justin Champagnie', 'Justin Champagnie', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Justin Champagnie","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":69,"pts":8.7,"reb":5.6,"ast":1.2,"stl":0.9,"blk":0.6,"tov":0.7,"fg":50.2,"fg3":31.9,"ft":78.4,"salary":2667944}}'::jsonb),
  ('15:tre johnson', 15, 'Tre Johnson', 'Tre Johnson', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Tre Johnson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":60,"pts":12.2,"reb":2.8,"ast":2.0,"stl":0.6,"blk":0.3,"tov":1.6,"fg":41.9,"fg3":35.8,"ft":87.4,"salary":8649600}}'::jsonb),
  ('15:sharife cooper', 15, 'Sharife Cooper', 'Sharife Cooper', 'PG', '{"is_starter":false,"roster_order":13,"player":{"name":"Sharife Cooper","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":41,"pts":8.1,"reb":2.1,"ast":3.0,"stl":0.4,"blk":0.1,"tov":1.5,"fg":51.4,"fg3":38.2,"ft":83.3,"salary":null}}'::jsonb),
  ('15:anthony gill', 15, 'Anthony Gill', 'Anthony Gill', 'PF', '{"is_starter":false,"roster_order":14,"player":{"name":"Anthony Gill","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":55,"pts":5.8,"reb":2.9,"ast":1.3,"stl":0.6,"blk":0.4,"tov":0.7,"fg":62.8,"fg3":35.4,"ft":73.9,"salary":2449421}}'::jsonb),
  ('15:khris middleton', 15, 'Khris Middleton', 'Khris Middleton', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Khris Middleton","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":63,"pts":10.2,"reb":3.7,"ast":2.8,"stl":0.7,"blk":0.1,"tov":1.7,"fg":42.0,"fg3":36.0,"ft":87.5,"salary":5591122}}'::jsonb),
  ('15:will riley', 15, 'Will Riley', 'Will Riley', 'SF', '{"is_starter":false,"roster_order":16,"player":{"name":"Will Riley","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":74,"pts":10.3,"reb":2.9,"ast":2.0,"stl":0.7,"blk":0.1,"tov":1.3,"fg":43.9,"fg3":31.6,"ft":80.0,"salary":3688320}}'::jsonb),
  ('16:jamal murray', 16, 'Jamal Murray', 'Jamal Murray', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Jamal Murray","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":75,"pts":25.4,"reb":4.4,"ast":7.1,"stl":0.9,"blk":0.4,"tov":2.3,"fg":48.3,"fg3":43.5,"ft":88.7,"salary":50105628}}'::jsonb),
  ('16:christian braun', 16, 'Christian Braun', 'Christian Braun', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Christian Braun","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":44,"pts":12.0,"reb":4.8,"ast":2.7,"stl":0.7,"blk":0.3,"tov":1.0,"fg":51.9,"fg3":30.1,"ft":78.2,"salary":21551726}}'::jsonb),
  ('16:demar derozan', 16, 'DeMar DeRozan', 'DeMar DeRozan', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"DeMar DeRozan","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":18.4,"reb":2.9,"ast":4.1,"stl":1.0,"blk":0.3,"tov":1.2,"fg":49.7,"fg3":32.0,"ft":86.8,"salary":2449421}}'::jsonb),
  ('16:aaron gordon', 16, 'Aaron Gordon', 'Aaron Gordon', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Aaron Gordon","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":36,"pts":16.2,"reb":5.8,"ast":2.7,"stl":0.6,"blk":0.3,"tov":1.1,"fg":49.7,"fg3":38.9,"ft":76.7,"salary":33658037}}'::jsonb),
  ('16:nikola jokić', 16, 'Nikola Jokić', 'Nikola Jokić', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Nikola Jokić","pos":"C","contract_type":null,"stats_season":"2025-26","gp":65,"pts":27.7,"reb":12.9,"ast":10.7,"stl":1.4,"blk":0.8,"tov":3.7,"fg":56.9,"fg3":38.0,"ft":83.1,"salary":59033114}}'::jsonb),
  ('16:trevon brazile', 16, 'Trevon Brazile', 'Trevon Brazile', 'PF', '{"is_starter":false,"roster_order":5,"player":{"name":"Trevon Brazile","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('16:bryce hopkins', 16, 'Bryce Hopkins', 'Bryce Hopkins', 'PF', '{"is_starter":false,"roster_order":6,"player":{"name":"Bryce Hopkins","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('16:alpha diallo', 16, 'Alpha Diallo', 'Alpha Diallo', 'SF', '{"is_starter":false,"roster_order":7,"player":{"name":"Alpha Diallo","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('16:curtis jones', 16, 'Curtis Jones', 'Curtis Jones', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Curtis Jones","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":10,"pts":2.9,"reb":1.1,"ast":1.0,"stl":0.4,"blk":0.0,"tov":0.2,"fg":40.7,"fg3":33.3,"ft":50.0,"salary":null}}'::jsonb),
  ('16:julian strawther', 16, 'Julian Strawther', 'Julian Strawther', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"Julian Strawther","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":57,"pts":7.2,"reb":2.0,"ast":1.1,"stl":0.4,"blk":0.1,"tov":0.6,"fg":46.7,"fg3":38.7,"ft":81.4,"salary":4826931}}'::jsonb),
  ('16:tyus jones', 16, 'Tyus Jones', 'Tyus Jones', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Tyus Jones","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":67,"pts":3.0,"reb":1.1,"ast":2.4,"stl":0.6,"blk":0.0,"tov":0.4,"fg":34.9,"fg3":29.2,"ft":77.8,"salary":2449421}}'::jsonb),
  ('16:daron holmes ii', 16, 'DaRon Holmes II', 'DaRon Holmes II', 'PF', '{"is_starter":false,"roster_order":11,"player":{"name":"DaRon Holmes II","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":25,"pts":3.7,"reb":1.4,"ast":0.6,"stl":0.0,"blk":0.2,"tov":0.5,"fg":50.8,"fg3":44.4,"ft":78.6,"salary":3372120}}'::jsonb),
  ('16:lonnie walker iv', 16, 'Lonnie Walker IV', 'Lonnie Walker IV', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Lonnie Walker IV","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3286399}}'::jsonb),
  ('16:spencer jones', 16, 'Spencer Jones', 'Spencer Jones', 'SF', '{"is_starter":false,"roster_order":13,"player":{"name":"Spencer Jones","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":64,"pts":5.5,"reb":3.3,"ast":0.8,"stl":0.8,"blk":0.5,"tov":0.5,"fg":50.4,"fg3":39.6,"ft":60.8,"salary":6000000}}'::jsonb),
  ('16:zeke nnaji', 16, 'Zeke Nnaji', 'Zeke Nnaji', 'C', '{"is_starter":false,"roster_order":14,"player":{"name":"Zeke Nnaji","pos":"C","contract_type":null,"stats_season":"2025-26","gp":52,"pts":3.7,"reb":2.6,"ast":0.6,"stl":0.3,"blk":0.5,"tov":0.5,"fg":47.0,"fg3":25.9,"ft":77.3,"salary":7466667}}'::jsonb),
  ('16:cameron johnson', 16, 'Cameron Johnson', 'Cameron Johnson', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Cameron Johnson","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":54,"pts":12.2,"reb":3.8,"ast":2.4,"stl":0.7,"blk":0.4,"tov":0.9,"fg":48.0,"fg3":43.0,"ft":83.9,"salary":23062500}}'::jsonb),
  ('16:kj simpson', 16, 'KJ Simpson', 'KJ Simpson', 'PG', '{"is_starter":false,"roster_order":16,"player":{"name":"KJ Simpson","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":20,"pts":4.6,"reb":1.9,"ast":2.2,"stl":0.8,"blk":0.0,"tov":1.3,"fg":34.3,"fg3":30.0,"ft":61.1,"salary":null}}'::jsonb),
  ('16:marvin bagley iii', 16, 'Marvin Bagley III', 'Marvin Bagley III', 'PF', '{"is_starter":false,"roster_order":17,"player":{"name":"Marvin Bagley III","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":60,"pts":10.5,"reb":6.1,"ast":1.4,"stl":0.5,"blk":0.7,"tov":1.0,"fg":61.8,"fg3":46.2,"ft":66.0,"salary":2449421}}'::jsonb),
  ('16:david roddy', 16, 'David Roddy', 'David Roddy', 'SF', '{"is_starter":false,"roster_order":18,"player":{"name":"David Roddy","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":5,"pts":8.0,"reb":4.0,"ast":0.8,"stl":0.8,"blk":0.2,"tov":0.4,"fg":50.0,"fg3":27.3,"ft":100.0,"salary":null}}'::jsonb),
  ('17:lamelo ball', 17, 'LaMelo Ball', 'LaMelo Ball', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"LaMelo Ball","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":72,"pts":20.1,"reb":4.8,"ast":7.1,"stl":1.2,"blk":0.2,"tov":2.8,"fg":40.7,"fg3":36.8,"ft":89.9,"salary":40770520}}'::jsonb),
  ('17:anthony edwards', 17, 'Anthony Edwards', 'Anthony Edwards', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Anthony Edwards","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":61,"pts":28.8,"reb":5.0,"ast":3.7,"stl":1.4,"blk":0.8,"tov":2.9,"fg":48.9,"fg3":39.9,"ft":79.6,"salary":48924624}}'::jsonb),
  ('17:jaden mcdaniels', 17, 'Jaden McDaniels', 'Jaden McDaniels', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Jaden McDaniels","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":73,"pts":14.8,"reb":4.2,"ast":2.7,"stl":1.1,"blk":1.0,"tov":1.8,"fg":51.5,"fg3":41.2,"ft":83.5,"salary":26200001}}'::jsonb),
  ('17:jonathan kuminga', 17, 'Jonathan Kuminga', 'Jonathan Kuminga', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Jonathan Kuminga","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":36,"pts":12.2,"reb":5.6,"ast":2.3,"stl":0.6,"blk":0.3,"tov":1.9,"fg":46.3,"fg3":33.3,"ft":72.4,"salary":6064000}}'::jsonb),
  ('17:rudy gobert', 17, 'Rudy Gobert', 'Rudy Gobert', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Rudy Gobert","pos":"C","contract_type":null,"stats_season":"2025-26","gp":76,"pts":10.9,"reb":11.5,"ast":1.7,"stl":0.8,"blk":1.6,"tov":1.4,"fg":68.2,"fg3":0.0,"ft":52.6,"salary":36500000}}'::jsonb),
  ('17:donte divincenzo', 17, 'Donte DiVincenzo', 'Donte DiVincenzo', 'SG', '{"is_starter":false,"roster_order":5,"player":{"name":"Donte DiVincenzo","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":12.2,"reb":4.1,"ast":3.8,"stl":1.3,"blk":0.4,"tov":1.4,"fg":40.6,"fg3":37.9,"ft":74.3,"salary":12535000}}'::jsonb),
  ('17:terance shannon jr', 17, 'Terance Shannon Jr', 'Terance Shannon Jr', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Terance Shannon Jr","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":43,"pts":5.6,"reb":1.1,"ast":0.9,"stl":0.3,"blk":0.0,"tov":0.6,"fg":45.0,"fg3":40.8,"ft":80.0,"salary":null}}'::jsonb),
  ('17:cody williams', 17, 'Cody Williams', 'Cody Williams', 'SF', '{"is_starter":false,"roster_order":7,"player":{"name":"Cody Williams","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":67,"pts":8.8,"reb":3.0,"ast":2.0,"stl":0.8,"blk":0.4,"tov":1.1,"fg":46.8,"fg3":21.4,"ft":70.6,"salary":6015600}}'::jsonb),
  ('17:jaylen clark', 17, 'Jaylen Clark', 'Jaylen Clark', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Jaylen Clark","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":68,"pts":4.0,"reb":1.8,"ast":0.6,"stl":0.7,"blk":0.1,"tov":0.3,"fg":43.4,"fg3":32.7,"ft":65.7,"salary":3086420}}'::jsonb),
  ('17:bones hyland', 17, 'Bones Hyland', 'Bones Hyland', 'PG', '{"is_starter":false,"roster_order":9,"player":{"name":"Bones Hyland","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":71,"pts":8.5,"reb":1.8,"ast":2.6,"stl":0.6,"blk":0.2,"tov":1.0,"fg":45.3,"fg3":38.8,"ft":78.0,"salary":2845883}}'::jsonb),
  ('17:ayo dosunmu', 17, 'Ayo Dosunmu', 'Ayo Dosunmu', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Ayo Dosunmu","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":14.8,"reb":3.4,"ast":3.6,"stl":0.8,"blk":0.3,"tov":1.4,"fg":51.7,"fg3":43.9,"ft":87.6,"salary":19310345}}'::jsonb),
  ('17:trey kaufman-renn', 17, 'Trey Kaufman-Renn', 'Trey Kaufman-Renn', 'PF', '{"is_starter":false,"roster_order":11,"player":{"name":"Trey Kaufman-Renn","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('17:zyon pullin', 17, 'Zyon Pullin', 'Zyon Pullin', 'PG', '{"is_starter":false,"roster_order":12,"player":{"name":"Zyon Pullin","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":5,"pts":4.6,"reb":0.6,"ast":1.8,"stl":0.2,"blk":0.0,"tov":0.6,"fg":69.2,"fg3":33.3,"ft":100.0,"salary":null}}'::jsonb),
  ('17:joan beringer', 17, 'Joan Beringer', 'Joan Beringer', 'PF', '{"is_starter":false,"roster_order":13,"player":{"name":"Joan Beringer","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":40,"pts":3.9,"reb":2.3,"ast":0.3,"stl":0.2,"blk":0.7,"tov":0.3,"fg":66.3,"fg3":0.0,"ft":70.3,"salary":4411200}}'::jsonb),
  ('17:enrique freeman', 17, 'Enrique Freeman', 'Enrique Freeman', 'PF', '{"is_starter":false,"roster_order":14,"player":{"name":"Enrique Freeman","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":4,"pts":3.3,"reb":2.5,"ast":0.5,"stl":0.5,"blk":0.8,"tov":0.5,"fg":50.0,"fg3":50.0,"ft":75.0,"salary":null}}'::jsonb),
  ('17:isaiah evans', 17, 'Isaiah Evans', 'Isaiah Evans', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Isaiah Evans","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('17:trey lyles', 17, 'Trey Lyles', 'Trey Lyles', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"Trey Lyles","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2449421}}'::jsonb),
  ('17:rocco zikarsky', 17, 'Rocco Zikarsky', 'Rocco Zikarsky', 'C', '{"is_starter":false,"roster_order":17,"player":{"name":"Rocco Zikarsky","pos":"C","contract_type":null,"stats_season":"2025-26","gp":5,"pts":2.8,"reb":2.8,"ast":0.4,"stl":0.0,"blk":1.0,"tov":0.2,"fg":62.5,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('17:john konchar', 17, 'John Konchar', 'John Konchar', 'SG', '{"is_starter":false,"roster_order":18,"player":{"name":"John Konchar","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":56,"pts":4.4,"reb":4.3,"ast":2.1,"stl":1.5,"blk":0.7,"tov":0.6,"fg":47.2,"fg3":28.3,"ft":72.7,"salary":2055000}}'::jsonb),
  ('17:terrence shannon jr.', 17, 'Terrence Shannon Jr.', 'Terrence Shannon Jr.', 'F', '{"is_starter":false,"roster_order":19,"player":{"name":"Terrence Shannon Jr.","pos":"F","contract_type":null,"stats_season":"2025-26","gp":43,"pts":5.6,"reb":1.1,"ast":0.9,"stl":0.3,"blk":0.0,"tov":0.6,"fg":45.0,"fg3":40.8,"ft":80.0,"salary":2801640}}'::jsonb),
  ('18:shai gilgeous-alexander', 18, 'Shai Gilgeous-Alexander', 'Shai Gilgeous-Alexander', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Shai Gilgeous-Alexander","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":68,"pts":31.1,"reb":4.3,"ast":6.6,"stl":1.4,"blk":0.8,"tov":2.2,"fg":55.3,"fg3":38.6,"ft":87.9,"salary":40800000}}'::jsonb),
  ('18:cason wallace', 18, 'Cason Wallace', 'Cason Wallace', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Cason Wallace","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":77,"pts":8.6,"reb":3.1,"ast":2.6,"stl":1.9,"blk":0.4,"tov":0.9,"fg":43.2,"fg3":35.1,"ft":80.9,"salary":7400000}}'::jsonb),
  ('18:jalen williams', 18, 'Jalen Williams', 'Jalen Williams', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Jalen Williams","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":33,"pts":17.1,"reb":4.6,"ast":5.5,"stl":1.2,"blk":0.3,"tov":1.9,"fg":48.4,"fg3":29.9,"ft":83.7,"salary":41200000}}'::jsonb),
  ('18:chet holmgren', 18, 'Chet Holmgren', 'Chet Holmgren', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Chet Holmgren","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":69,"pts":17.1,"reb":8.9,"ast":1.7,"stl":0.6,"blk":1.9,"tov":1.6,"fg":55.7,"fg3":36.2,"ft":79.2,"salary":41200000}}'::jsonb),
  ('18:isaiah hartenstein', 18, 'Isaiah Hartenstein', 'Isaiah Hartenstein', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Isaiah Hartenstein","pos":"C","contract_type":null,"stats_season":"2025-26","gp":47,"pts":9.2,"reb":9.4,"ast":3.5,"stl":1.0,"blk":0.8,"tov":1.7,"fg":62.2,"fg3":0.0,"ft":61.0,"salary":23100000}}'::jsonb),
  ('18:josh dix', 18, 'Josh Dix', 'Josh Dix', 'SG', '{"is_starter":false,"roster_order":5,"player":{"name":"Josh Dix","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('18:jared mccain', 18, 'Jared McCain', 'Jared McCain', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Jared McCain","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":67,"pts":8.3,"reb":2.0,"ast":1.3,"stl":0.5,"blk":0.1,"tov":0.8,"fg":42.5,"fg3":38.5,"ft":86.4,"salary":4400000}}'::jsonb),
  ('18:jaylin williams', 18, 'Jaylin Williams', 'Jaylin Williams', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Jaylin Williams","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":65,"pts":7.2,"reb":5.5,"ast":2.4,"stl":0.5,"blk":0.6,"tov":1.0,"fg":42.3,"fg3":38.3,"ft":79.3,"salary":7700000}}'::jsonb),
  ('18:alex caruso', 18, 'Alex Caruso', 'Alex Caruso', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Alex Caruso","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":56,"pts":6.2,"reb":2.8,"ast":2.0,"stl":1.3,"blk":0.3,"tov":0.9,"fg":42.3,"fg3":29.3,"ft":80.4,"salary":19500000}}'::jsonb),
  ('18:thomas sorber', 18, 'Thomas Sorber', 'Thomas Sorber', 'C', '{"is_starter":false,"roster_order":9,"player":{"name":"Thomas Sorber","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":4800000}}'::jsonb),
  ('18:otega oweh', 18, 'Otega Oweh', 'Otega Oweh', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Otega Oweh","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('18:bennett stirtz', 18, 'Bennett Stirtz', 'Bennett Stirtz', 'PG', '{"is_starter":false,"roster_order":11,"player":{"name":"Bennett Stirtz","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":4700000}}'::jsonb),
  ('18:aday mara', 18, 'Aday Mara', 'Aday Mara', 'C', '{"is_starter":false,"roster_order":12,"player":{"name":"Aday Mara","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":5700000}}'::jsonb),
  ('18:brooks barnhizer', 18, 'Brooks Barnhizer', 'Brooks Barnhizer', 'SG', '{"is_starter":false,"roster_order":13,"player":{"name":"Brooks Barnhizer","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":40,"pts":1.7,"reb":2.0,"ast":0.6,"stl":0.3,"blk":0.1,"tov":0.3,"fg":38.0,"fg3":29.2,"ft":70.0,"salary":0}}'::jsonb),
  ('18:ajay mitchell', 18, 'Ajay Mitchell', 'Ajay Mitchell', 'PG', '{"is_starter":false,"roster_order":14,"player":{"name":"Ajay Mitchell","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":57,"pts":13.6,"reb":3.3,"ast":3.6,"stl":1.2,"blk":0.3,"tov":1.4,"fg":48.5,"fg3":34.7,"ft":87.0,"salary":2800000}}'::jsonb),
  ('18:kenrich williams', 18, 'Kenrich Williams', 'Kenrich Williams', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Kenrich Williams","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":56,"pts":6.5,"reb":3.3,"ast":1.4,"stl":0.6,"blk":0.1,"tov":0.8,"fg":47.3,"fg3":38.8,"ft":63.5,"salary":5000000}}'::jsonb),
  ('18:nikola topić', 18, 'Nikola Topić', 'Nikola Topić', 'PG', '{"is_starter":false,"roster_order":16,"player":{"name":"Nikola Topić","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":10,"pts":5.2,"reb":1.9,"ast":4.4,"stl":0.5,"blk":0.0,"tov":2.5,"fg":43.1,"fg3":40.0,"ft":40.0,"salary":5400000}}'::jsonb),
  ('19:damian lillard', 19, 'Damian Lillard', 'Damian Lillard', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Damian Lillard","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":13300000}}'::jsonb),
  ('19:ja morant', 19, 'Ja Morant', 'Ja Morant', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Ja Morant","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":20,"pts":19.5,"reb":3.3,"ast":8.1,"stl":1.0,"blk":0.3,"tov":3.6,"fg":41.0,"fg3":23.5,"ft":89.7,"salary":42100000}}'::jsonb),
  ('19:deni avdija', 19, 'Deni Avdija', 'Deni Avdija', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Deni Avdija","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":66,"pts":24.2,"reb":6.9,"ast":6.7,"stl":0.8,"blk":0.6,"tov":3.8,"fg":46.2,"fg3":31.8,"ft":80.2,"salary":13100000}}'::jsonb),
  ('19:jeremy sochan', 19, 'Jeremy Sochan', 'Jeremy Sochan', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Jeremy Sochan","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":44,"pts":3.6,"reb":2.4,"ast":0.9,"stl":0.4,"blk":0.2,"tov":0.5,"fg":49.6,"fg3":24.4,"ft":73.1,"salary":null}}'::jsonb),
  ('19:donovan clingan', 19, 'Donovan Clingan', 'Donovan Clingan', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Donovan Clingan","pos":"C","contract_type":null,"stats_season":"2025-26","gp":77,"pts":12.1,"reb":11.6,"ast":2.1,"stl":0.6,"blk":1.7,"tov":1.2,"fg":52.0,"fg3":34.1,"ft":68.0,"salary":7500000}}'::jsonb),
  ('19:jayson kent', 19, 'Jayson Kent', 'Jayson Kent', 'SF', '{"is_starter":false,"roster_order":5,"player":{"name":"Jayson Kent","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":5,"pts":2.0,"reb":1.0,"ast":0.0,"stl":0.2,"blk":0.2,"tov":0.0,"fg":57.1,"fg3":25.0,"ft":100.0,"salary":null}}'::jsonb),
  ('19:scoot henderson', 19, 'Scoot Henderson', 'Scoot Henderson', 'PG', '{"is_starter":false,"roster_order":6,"player":{"name":"Scoot Henderson","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":30,"pts":14.2,"reb":2.7,"ast":3.7,"stl":0.9,"blk":0.3,"tov":2.4,"fg":41.8,"fg3":35.2,"ft":84.0,"salary":13500000}}'::jsonb),
  ('19:chris youngblood', 19, 'Chris Youngblood', 'Chris Youngblood', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"Chris Youngblood","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":34,"pts":2.1,"reb":0.8,"ast":0.4,"stl":0.1,"blk":0.1,"tov":0.1,"fg":34.9,"fg3":33.3,"ft":90.0,"salary":0}}'::jsonb),
  ('19:jrue holiday', 19, 'Jrue Holiday', 'Jrue Holiday', 'PG', '{"is_starter":false,"roster_order":8,"player":{"name":"Jrue Holiday","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":53,"pts":16.3,"reb":4.6,"ast":6.1,"stl":1.0,"blk":0.1,"tov":2.8,"fg":45.1,"fg3":37.8,"ft":83.8,"salary":34800000}}'::jsonb),
  ('19:john tonje', 19, 'John Tonje', 'John Tonje', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"John Tonje","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":6,"pts":2.5,"reb":1.0,"ast":0.3,"stl":0.3,"blk":0.0,"tov":0.0,"fg":28.6,"fg3":30.0,"ft":100.0,"salary":null}}'::jsonb),
  ('19:micah potter', 19, 'Micah Potter', 'Micah Potter', 'C', '{"is_starter":false,"roster_order":10,"player":{"name":"Micah Potter","pos":"C","contract_type":null,"stats_season":"2025-26","gp":47,"pts":9.7,"reb":5.0,"ast":1.5,"stl":0.5,"blk":0.3,"tov":1.0,"fg":51.5,"fg3":42.3,"ft":84.2,"salary":2800000}}'::jsonb),
  ('19:branden carlson', 19, 'Branden Carlson', 'Branden Carlson', 'C', '{"is_starter":false,"roster_order":11,"player":{"name":"Branden Carlson","pos":"C","contract_type":null,"stats_season":"2025-26","gp":42,"pts":5.8,"reb":3.0,"ast":0.7,"stl":0.2,"blk":0.6,"tov":0.4,"fg":52.7,"fg3":36.0,"ft":57.7,"salary":2400000}}'::jsonb),
  ('19:yang hansen', 19, 'Yang Hansen', 'Yang Hansen', 'C', '{"is_starter":false,"roster_order":12,"player":{"name":"Yang Hansen","pos":"C","contract_type":null,"stats_season":"2025-26","gp":43,"pts":2.2,"reb":1.5,"ast":0.5,"stl":0.1,"blk":0.2,"tov":0.7,"fg":31.0,"fg3":11.9,"ft":82.4,"salary":4600000}}'::jsonb),
  ('19:shaedon sharpe', 19, 'Shaedon Sharpe', 'Shaedon Sharpe', 'SG', '{"is_starter":false,"roster_order":13,"player":{"name":"Shaedon Sharpe","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":50,"pts":20.8,"reb":4.3,"ast":2.6,"stl":1.4,"blk":0.1,"tov":2.9,"fg":45.2,"fg3":33.7,"ft":78.7,"salary":20000000}}'::jsonb),
  ('19:vít krejčí', 19, 'Vít Krejčí', 'Vít Krejčí', 'PG', '{"is_starter":false,"roster_order":14,"player":{"name":"Vít Krejčí","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":65,"pts":8.5,"reb":2.3,"ast":1.5,"stl":0.7,"blk":0.3,"tov":0.6,"fg":44.8,"fg3":39.0,"ft":74.5,"salary":2600000}}'::jsonb),
  ('19:toumani camara', 19, 'Toumani Camara', 'Toumani Camara', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Toumani Camara","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":82,"pts":13.4,"reb":5.1,"ast":2.5,"stl":1.1,"blk":0.4,"tov":1.8,"fg":44.0,"fg3":37.0,"ft":70.8,"salary":18000000}}'::jsonb),
  ('19:robert williams iii', 19, 'Robert Williams III', 'Robert Williams III', 'C', '{"is_starter":false,"roster_order":16,"player":{"name":"Robert Williams III","pos":"C","contract_type":null,"stats_season":"2025-26","gp":59,"pts":6.7,"reb":7.0,"ast":1.0,"stl":0.6,"blk":1.5,"tov":0.8,"fg":70.8,"fg3":39.1,"ft":59.6,"salary":14000000}}'::jsonb),
  ('19:sidy cissoko', 19, 'Sidy Cissoko', 'Sidy Cissoko', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Sidy Cissoko","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":75,"pts":5.1,"reb":2.2,"ast":1.5,"stl":0.7,"blk":0.3,"tov":0.9,"fg":39.8,"fg3":29.8,"ft":65.9,"salary":2400000}}'::jsonb),
  ('20:keyonte george', 20, 'Keyonte George', 'Keyonte George', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Keyonte George","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":54,"pts":23.6,"reb":3.7,"ast":6.1,"stl":1.1,"blk":0.3,"tov":3.1,"fg":45.6,"fg3":37.1,"ft":89.2,"salary":6500000}}'::jsonb),
  ('20:josh green', 20, 'Josh Green', 'Josh Green', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Josh Green","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":58,"pts":4.3,"reb":1.8,"ast":0.8,"stl":0.6,"blk":0.1,"tov":0.6,"fg":45.9,"fg3":42.0,"ft":89.3,"salary":null}}'::jsonb),
  ('20:lauri markkanen', 20, 'Lauri Markkanen', 'Lauri Markkanen', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Lauri Markkanen","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":42,"pts":26.7,"reb":6.9,"ast":2.1,"stl":1.0,"blk":0.5,"tov":1.5,"fg":47.7,"fg3":35.5,"ft":89.6,"salary":46100000}}'::jsonb),
  ('20:jaren jackson jr.', 20, 'Jaren Jackson Jr.', 'Jaren Jackson Jr.', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Jaren Jackson Jr.","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":48,"pts":19.4,"reb":5.7,"ast":2.0,"stl":1.1,"blk":1.4,"tov":2.2,"fg":47.6,"fg3":35.7,"ft":80.3,"salary":49000000}}'::jsonb),
  ('20:jusuf nurkić', 20, 'Jusuf Nurkić', 'Jusuf Nurkić', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Jusuf Nurkić","pos":"C","contract_type":null,"stats_season":"2025-26","gp":41,"pts":10.9,"reb":10.4,"ast":4.8,"stl":1.3,"blk":0.5,"tov":2.5,"fg":50.3,"fg3":35.2,"ft":54.9,"salary":11400000}}'::jsonb),
  ('20:hayden gray', 20, 'Hayden Gray', 'Hayden Gray', 'G', '{"is_starter":false,"roster_order":5,"player":{"name":"Hayden Gray","pos":"G","contract_type":null,"stats_season":"2025-26","gp":1,"pts":6.0,"reb":0.0,"ast":1.0,"stl":1.0,"blk":1.0,"tov":1.0,"fg":66.7,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('20:kyle filipowski', 20, 'Kyle Filipowski', 'Kyle Filipowski', 'C', '{"is_starter":false,"roster_order":6,"player":{"name":"Kyle Filipowski","pos":"C","contract_type":null,"stats_season":"2025-26","gp":77,"pts":11.4,"reb":7.2,"ast":2.6,"stl":0.9,"blk":0.5,"tov":1.6,"fg":49.2,"fg3":32.5,"ft":75.0,"salary":3000000}}'::jsonb),
  ('20:blake hinson', 20, 'Blake Hinson', 'Blake Hinson', 'F', '{"is_starter":false,"roster_order":7,"player":{"name":"Blake Hinson","pos":"F","contract_type":null,"stats_season":"2025-26","gp":14,"pts":11.9,"reb":2.4,"ast":1.1,"stl":0.4,"blk":0.1,"tov":0.4,"fg":51.3,"fg3":46.8,"ft":75.0,"salary":0}}'::jsonb),
  ('20:tamar bates', 20, 'Tamar Bates', 'Tamar Bates', 'G', '{"is_starter":false,"roster_order":8,"player":{"name":"Tamar Bates","pos":"G","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":0}}'::jsonb),
  ('20:isaiah collier', 20, 'Isaiah Collier', 'Isaiah Collier', 'PG', '{"is_starter":false,"roster_order":9,"player":{"name":"Isaiah Collier","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":59,"pts":11.7,"reb":2.5,"ast":7.2,"stl":1.1,"blk":0.3,"tov":2.5,"fg":49.5,"fg3":27.0,"ft":72.2,"salary":2700000}}'::jsonb),
  ('20:svi mykhailiuk', 20, 'Svi Mykhailiuk', 'Svi Mykhailiuk', 'G-F', '{"is_starter":false,"roster_order":10,"player":{"name":"Svi Mykhailiuk","pos":"G-F","contract_type":null,"stats_season":"2025-26","gp":50,"pts":9.4,"reb":2.5,"ast":1.9,"stl":0.5,"blk":0.1,"tov":0.8,"fg":47.8,"fg3":40.8,"ft":89.3,"salary":3800000}}'::jsonb),
  ('20:jaxson hayes', 20, 'Jaxson Hayes', 'Jaxson Hayes', 'C', '{"is_starter":false,"roster_order":11,"player":{"name":"Jaxson Hayes","pos":"C","contract_type":null,"stats_season":"2025-26","gp":66,"pts":7.5,"reb":4.1,"ast":0.9,"stl":0.4,"blk":0.8,"tov":0.5,"fg":75.6,"fg3":100.0,"ft":65.3,"salary":6000000}}'::jsonb),
  ('20:mo bamba', 20, 'Mo Bamba', 'Mo Bamba', 'C', '{"is_starter":false,"roster_order":12,"player":{"name":"Mo Bamba","pos":"C","contract_type":null,"stats_season":"2025-26","gp":4,"pts":2.5,"reb":5.5,"ast":0.3,"stl":0.0,"blk":0.8,"tov":0.5,"fg":45.5,"fg3":0.0,"ft":0.0,"salary":3500000}}'::jsonb),
  ('20:ace bailey', 20, 'Ace Bailey', 'Ace Bailey', 'G-F', '{"is_starter":false,"roster_order":13,"player":{"name":"Ace Bailey","pos":"G-F","contract_type":null,"stats_season":"2025-26","gp":72,"pts":13.8,"reb":4.2,"ast":1.8,"stl":0.8,"blk":0.7,"tov":1.5,"fg":44.3,"fg3":34.4,"ft":75.0,"salary":9500000}}'::jsonb),
  ('20:josh okogie', 20, 'Josh Okogie', 'Josh Okogie', 'G', '{"is_starter":false,"roster_order":14,"player":{"name":"Josh Okogie","pos":"G","contract_type":null,"stats_season":"2025-26","gp":78,"pts":4.5,"reb":2.6,"ast":0.9,"stl":0.8,"blk":0.2,"tov":0.5,"fg":42.5,"fg3":38.5,"ft":59.4,"salary":6000000}}'::jsonb),
  ('20:darron peterson', 20, 'Darron Peterson', 'Darron Peterson', 'G', '{"is_starter":false,"roster_order":15,"player":{"name":"Darron Peterson","pos":"G","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('20:trey alexander', 20, 'Trey Alexander', 'Trey Alexander', 'G', '{"is_starter":false,"roster_order":16,"player":{"name":"Trey Alexander","pos":"G","contract_type":null,"stats_season":"2025-26","gp":9,"pts":5.2,"reb":1.2,"ast":1.0,"stl":0.7,"blk":0.2,"tov":0.3,"fg":51.4,"fg3":50.0,"ft":60.0,"salary":0}}'::jsonb),
  ('20:brice sensabaugh', 20, 'Brice Sensabaugh', 'Brice Sensabaugh', 'F', '{"is_starter":false,"roster_order":17,"player":{"name":"Brice Sensabaugh","pos":"F","contract_type":null,"stats_season":"2025-26","gp":75,"pts":14.9,"reb":3.1,"ast":1.9,"stl":0.7,"blk":0.2,"tov":1.7,"fg":46.0,"fg3":36.7,"ft":82.6,"salary":4800000}}'::jsonb),
  ('20:harrison ingram', 20, 'Harrison Ingram', 'Harrison Ingram', 'F', '{"is_starter":false,"roster_order":18,"player":{"name":"Harrison Ingram","pos":"F","contract_type":null,"stats_season":"2025-26","gp":7,"pts":1.6,"reb":0.4,"ast":0.1,"stl":0.0,"blk":0.0,"tov":0.1,"fg":83.3,"fg3":100.0,"ft":0.0,"salary":null}}'::jsonb),
  ('20:darryn peterson', 20, 'Darryn Peterson', 'Darryn Peterson', 'F', '{"is_starter":false,"roster_order":19,"player":{"name":"Darryn Peterson","pos":"F","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":13100000}}'::jsonb),
  ('20:cody williams', 20, 'Cody Williams', 'Cody Williams', 'F', '{"is_starter":false,"roster_order":20,"player":{"name":"Cody Williams","pos":"F","contract_type":null,"stats_season":"2025-26","gp":67,"pts":8.8,"reb":3.0,"ast":2.0,"stl":0.8,"blk":0.4,"tov":1.1,"fg":46.8,"fg3":21.4,"ft":70.6,"salary":6000000}}'::jsonb),
  ('21:stephen curry', 21, 'Stephen Curry', 'Stephen Curry', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Stephen Curry","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":43,"pts":26.6,"reb":3.6,"ast":4.7,"stl":1.1,"blk":0.4,"tov":2.8,"fg":46.8,"fg3":39.3,"ft":92.3,"salary":62587158}}'::jsonb),
  ('21:brandin podziemski', 21, 'Brandin Podziemski', 'Brandin Podziemski', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Brandin Podziemski","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":13.8,"reb":5.1,"ast":3.7,"stl":1.1,"blk":0.2,"tov":1.6,"fg":45.5,"fg3":37.1,"ft":79.7,"salary":5679459}}'::jsonb),
  ('21:jimmy butler', 21, 'Jimmy Butler', 'Jimmy Butler', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Jimmy Butler","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":38,"pts":20.0,"reb":5.6,"ast":4.9,"stl":1.4,"blk":0.2,"tov":1.6,"fg":51.9,"fg3":37.6,"ft":86.4,"salary":56832773}}'::jsonb),
  ('21:draymond green', 21, 'Draymond Green', 'Draymond Green', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Draymond Green","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":68,"pts":8.4,"reb":5.5,"ast":5.5,"stl":0.9,"blk":0.6,"tov":2.7,"fg":41.8,"fg3":32.6,"ft":70.2,"salary":27678571}}'::jsonb),
  ('21:kristaps porziņģis', 21, 'Kristaps Porziņģis', 'Kristaps Porziņģis', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Kristaps Porziņģis","pos":"C","contract_type":null,"stats_season":"2025-26","gp":32,"pts":16.7,"reb":5.2,"ast":2.5,"stl":0.6,"blk":1.2,"tov":1.3,"fg":44.6,"fg3":33.8,"ft":84.2,"salary":19512195}}'::jsonb),
  ('21:gary payton ii', 21, 'Gary Payton II', 'Gary Payton II', 'SG', '{"is_starter":false,"roster_order":5,"player":{"name":"Gary Payton II","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":73,"pts":7.5,"reb":3.6,"ast":1.7,"stl":0.9,"blk":0.3,"tov":0.8,"fg":58.3,"fg3":29.1,"ft":65.0,"salary":2449421}}'::jsonb),
  ('21:yaxel lendeborg', 21, 'Yaxel Lendeborg', 'Yaxel Lendeborg', 'PF', '{"is_starter":false,"roster_order":6,"player":{"name":"Yaxel Lendeborg","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":6096240}}'::jsonb),
  ('21:will richard', 21, 'Will Richard', 'Will Richard', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"Will Richard","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":6.4,"reb":2.5,"ast":1.3,"stl":1.2,"blk":0.1,"tov":0.8,"fg":46.8,"fg3":33.5,"ft":85.2,"salary":2150917}}'::jsonb),
  ('21:moses moody', 21, 'Moses Moody', 'Moses Moody', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Moses Moody","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":60,"pts":12.1,"reb":3.3,"ast":1.6,"stl":1.0,"blk":0.6,"tov":1.0,"fg":44.0,"fg3":40.1,"ft":77.0,"salary":12500000}}'::jsonb),
  ('21:de''anthony melton', 21, 'De''Anthony Melton', 'De''Anthony Melton', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"De''Anthony Melton","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":49,"pts":12.3,"reb":3.2,"ast":2.6,"stl":1.6,"blk":0.4,"tov":1.9,"fg":40.7,"fg3":29.4,"ft":82.6,"salary":5477000}}'::jsonb),
  ('21:brandon williams', 21, 'Brandon Williams', 'Brandon Williams', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Brandon Williams","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":66,"pts":13.0,"reb":2.9,"ast":3.9,"stl":0.9,"blk":0.3,"tov":1.9,"fg":47.2,"fg3":23.2,"ft":79.3,"salary":2449421}}'::jsonb),
  ('21:gui santos', 21, 'Gui Santos', 'Gui Santos', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Gui Santos","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":68,"pts":9.2,"reb":3.9,"ast":2.3,"stl":0.9,"blk":0.3,"tov":1.5,"fg":50.0,"fg3":35.1,"ft":72.5,"salary":4629630}}'::jsonb),
  ('21:lj cryer', 21, 'LJ Cryer', 'LJ Cryer', 'PG', '{"is_starter":false,"roster_order":12,"player":{"name":"LJ Cryer","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":18,"pts":8.2,"reb":1.6,"ast":1.0,"stl":0.2,"blk":0.0,"tov":0.8,"fg":40.2,"fg3":39.4,"ft":89.5,"salary":null}}'::jsonb),
  ('21:nate williams', 21, 'Nate Williams', 'Nate Williams', 'SG', '{"is_starter":false,"roster_order":13,"player":{"name":"Nate Williams","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":14,"pts":8.0,"reb":2.1,"ast":1.0,"stl":0.4,"blk":0.0,"tov":1.1,"fg":48.9,"fg3":43.3,"ft":86.7,"salary":null}}'::jsonb),
  ('21:al horford', 21, 'Al Horford', 'Al Horford', 'C', '{"is_starter":false,"roster_order":14,"player":{"name":"Al Horford","pos":"C","contract_type":null,"stats_season":"2025-26","gp":45,"pts":8.3,"reb":4.9,"ast":2.6,"stl":0.7,"blk":1.1,"tov":0.9,"fg":42.6,"fg3":36.1,"ft":84.6,"salary":6822000}}'::jsonb),
  ('21:dalen terry', 21, 'Dalen Terry', 'Dalen Terry', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Dalen Terry","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":48,"pts":3.7,"reb":1.8,"ast":1.4,"stl":0.6,"blk":0.3,"tov":0.5,"fg":43.9,"fg3":36.4,"ft":53.3,"salary":1357763}}'::jsonb),
  ('21:alex toohey', 21, 'Alex Toohey', 'Alex Toohey', 'SF', '{"is_starter":false,"roster_order":16,"player":{"name":"Alex Toohey","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2185116}}'::jsonb),
  ('21:lajae jones', 21, 'Lajae Jones', 'Lajae Jones', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Lajae Jones","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('21:charles bassey', 21, 'Charles Bassey', 'Charles Bassey', 'C', '{"is_starter":false,"roster_order":18,"player":{"name":"Charles Bassey","pos":"C","contract_type":null,"stats_season":"2025-26","gp":13,"pts":5.8,"reb":4.4,"ast":0.5,"stl":0.3,"blk":0.8,"tov":0.5,"fg":66.0,"fg3":0.0,"ft":70.0,"salary":2449421}}'::jsonb),
  ('21:seth curry', 21, 'Seth Curry', 'Seth Curry', 'SG', '{"is_starter":false,"roster_order":19,"player":{"name":"Seth Curry","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":10,"pts":7.1,"reb":1.2,"ast":1.0,"stl":0.3,"blk":0.0,"tov":0.2,"fg":49.0,"fg3":48.0,"ft":91.7,"salary":null}}'::jsonb),
  ('21:georges niang', 21, 'Georges Niang', 'Georges Niang', 'PF', '{"is_starter":false,"roster_order":20,"player":{"name":"Georges Niang","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2449421}}'::jsonb),
  ('21:malevy leons', 21, 'Malevy Leons', 'Malevy Leons', 'PF', '{"is_starter":false,"roster_order":21,"player":{"name":"Malevy Leons","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":25,"pts":3.3,"reb":2.1,"ast":0.9,"stl":0.6,"blk":0.4,"tov":0.5,"fg":44.4,"fg3":25.0,"ft":78.9,"salary":null}}'::jsonb),
  ('22:kris dunn', 22, 'Kris Dunn', 'Kris Dunn', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Kris Dunn","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":7.3,"reb":3.3,"ast":3.6,"stl":1.6,"blk":0.2,"tov":1.4,"fg":47.6,"fg3":37.4,"ft":76.5,"salary":5684800}}'::jsonb),
  ('22:darius garland', 22, 'Darius Garland', 'Darius Garland', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Darius Garland","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":45,"pts":18.8,"reb":2.4,"ast":6.7,"stl":1.0,"blk":0.2,"tov":2.9,"fg":46.0,"fg3":39.6,"ft":86.1,"salary":42166510}}'::jsonb),
  ('22:brandon ingram', 22, 'Brandon Ingram', 'Brandon Ingram', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Brandon Ingram","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":21.5,"reb":5.6,"ast":3.7,"stl":0.8,"blk":0.7,"tov":2.4,"fg":47.7,"fg3":38.2,"ft":82.0,"salary":40000000}}'::jsonb),
  ('22:rui hachimura', 22, 'Rui Hachimura', 'Rui Hachimura', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Rui Hachimura","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":68,"pts":11.5,"reb":3.3,"ast":0.8,"stl":0.6,"blk":0.3,"tov":0.6,"fg":51.4,"fg3":44.3,"ft":69.4,"salary":14000000}}'::jsonb),
  ('22:brook lopez', 22, 'Brook Lopez', 'Brook Lopez', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Brook Lopez","pos":"C","contract_type":null,"stats_season":"2025-26","gp":75,"pts":8.5,"reb":3.6,"ast":1.3,"stl":0.6,"blk":1.2,"tov":0.8,"fg":42.8,"fg3":36.0,"ft":75.7,"salary":9187500}}'::jsonb),
  ('22:gradey dick', 22, 'Gradey Dick', 'Gradey Dick', 'SG', '{"is_starter":false,"roster_order":5,"player":{"name":"Gradey Dick","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":76,"pts":6.0,"reb":1.9,"ast":0.7,"stl":0.6,"blk":0.1,"tov":0.6,"fg":41.9,"fg3":30.1,"ft":87.5,"salary":7131511}}'::jsonb),
  ('22:norchad omier', 22, 'Norchad Omier', 'Norchad Omier', 'PF', '{"is_starter":false,"roster_order":6,"player":{"name":"Norchad Omier","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":6,"pts":2.8,"reb":1.2,"ast":0.3,"stl":0.2,"blk":0.0,"tov":0.0,"fg":70.0,"fg3":0.0,"ft":100.0,"salary":null}}'::jsonb),
  ('22:baba miller', 22, 'Baba Miller', 'Baba Miller', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Baba Miller","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1705630}}'::jsonb),
  ('22:nick martinelli', 22, 'Nick Martinelli', 'Nick Martinelli', 'SF', '{"is_starter":false,"roster_order":8,"player":{"name":"Nick Martinelli","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":0}}'::jsonb),
  ('22:narcisse ngoy', 22, 'Narcisse Ngoy', 'Narcisse Ngoy', 'C', '{"is_starter":false,"roster_order":9,"player":{"name":"Narcisse Ngoy","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('22:bradley beal', 22, 'Bradley Beal', 'Bradley Beal', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Bradley Beal","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":6,"pts":8.2,"reb":0.8,"ast":1.7,"stl":0.5,"blk":0.0,"tov":1.5,"fg":37.5,"fg3":36.8,"ft":75.0,"salary":6424800}}'::jsonb),
  ('22:keaton wagler', 22, 'Keaton Wagler', 'Keaton Wagler', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Keaton Wagler","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":9674760}}'::jsonb),
  ('22:max strus', 22, 'Max Strus', 'Max Strus', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Max Strus","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":12,"pts":11.2,"reb":5.4,"ast":2.0,"stl":0.3,"blk":0.0,"tov":0.8,"fg":44.3,"fg3":40.2,"ft":77.8,"salary":16660836}}'::jsonb),
  ('22:kobe sanders', 22, 'Kobe Sanders', 'Kobe Sanders', 'SG', '{"is_starter":false,"roster_order":13,"player":{"name":"Kobe Sanders","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":68,"pts":7.3,"reb":2.3,"ast":1.6,"stl":0.7,"blk":0.1,"tov":1.2,"fg":46.6,"fg3":40.8,"ft":82.6,"salary":2622139}}'::jsonb),
  ('22:derrick jones jr.', 22, 'Derrick Jones Jr.', 'Derrick Jones Jr.', 'SF', '{"is_starter":false,"roster_order":14,"player":{"name":"Derrick Jones Jr.","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":50,"pts":10.1,"reb":3.5,"ast":1.4,"stl":0.9,"blk":1.0,"tov":0.8,"fg":49.9,"fg3":35.9,"ft":76.3,"salary":10476190}}'::jsonb),
  ('22:yuki kawamura', 22, 'Yuki Kawamura', 'Yuki Kawamura', 'PG', '{"is_starter":false,"roster_order":15,"player":{"name":"Yuki Kawamura","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":18,"pts":3.4,"reb":1.8,"ast":2.6,"stl":0.5,"blk":0.0,"tov":0.8,"fg":32.7,"fg3":29.7,"ft":89.5,"salary":2449421}}'::jsonb),
  ('22:yanic konan niederhäuser', 22, 'Yanic Konan Niederhäuser', 'Yanic Konan Niederhäuser', 'C', '{"is_starter":false,"roster_order":16,"player":{"name":"Yanic Konan Niederhäuser","pos":"C","contract_type":null,"stats_season":"2025-26","gp":41,"pts":4.3,"reb":2.9,"ast":0.3,"stl":0.1,"blk":0.7,"tov":0.6,"fg":64.0,"fg3":20.0,"ft":75.8,"salary":2880960}}'::jsonb),
  ('22:jordan miller', 22, 'Jordan Miller', 'Jordan Miller', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Jordan Miller","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":60,"pts":10.0,"reb":3.0,"ast":2.3,"stl":0.8,"blk":0.2,"tov":1.1,"fg":53.1,"fg3":34.5,"ft":77.7,"salary":5300000}}'::jsonb),
  ('22:johni broome', 22, 'Johni Broome', 'Johni Broome', 'PF', '{"is_starter":false,"roster_order":18,"player":{"name":"Johni Broome","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":11,"pts":0.9,"reb":1.5,"ast":0.4,"stl":0.3,"blk":0.2,"tov":0.3,"fg":16.7,"fg3":0.0,"ft":33.3,"salary":null}}'::jsonb),
  ('22:isaiah jackson', 22, 'Isaiah Jackson', 'Isaiah Jackson', 'PF', '{"is_starter":false,"roster_order":19,"player":{"name":"Isaiah Jackson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":55,"pts":6.7,"reb":5.3,"ast":0.9,"stl":0.7,"blk":0.9,"tov":1.1,"fg":63.7,"fg3":0.0,"ft":64.8,"salary":7000000}}'::jsonb),
  ('22:cam christie', 22, 'Cam Christie', 'Cam Christie', 'SG', '{"is_starter":false,"roster_order":20,"player":{"name":"Cam Christie","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":55,"pts":2.8,"reb":1.4,"ast":0.6,"stl":0.3,"blk":0.1,"tov":0.4,"fg":38.1,"fg3":24.5,"ft":76.0,"salary":2296271}}'::jsonb),
  ('22:jalen pickett', 22, 'Jalen Pickett', 'Jalen Pickett', 'PG', '{"is_starter":false,"roster_order":21,"player":{"name":"Jalen Pickett","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":50,"pts":5.2,"reb":2.3,"ast":2.3,"stl":0.3,"blk":0.1,"tov":0.7,"fg":42.2,"fg3":38.6,"ft":78.9,"salary":0}}'::jsonb),
  ('22:nicolas batum', 22, 'Nicolas Batum', 'Nicolas Batum', 'SF', '{"is_starter":false,"roster_order":22,"player":{"name":"Nicolas Batum","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":74,"pts":4.0,"reb":2.5,"ast":0.9,"stl":0.6,"blk":0.3,"tov":0.5,"fg":40.3,"fg3":40.4,"ft":81.8,"salary":5881680}}'::jsonb),
  ('22:jamarion sharp', 22, 'Jamarion Sharp', 'Jamarion Sharp', 'C', '{"is_starter":false,"roster_order":23,"player":{"name":"Jamarion Sharp","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('22:fletcher loyer', 22, 'Fletcher Loyer', 'Fletcher Loyer', 'F', '{"is_starter":false,"roster_order":24,"player":{"name":"Fletcher Loyer","pos":"F","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":0}}'::jsonb),
  ('23:luka dončić', 23, 'Luka Dončić', 'Luka Dončić', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Luka Dončić","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":64,"pts":33.5,"reb":7.7,"ast":8.3,"stl":1.6,"blk":0.5,"tov":4.0,"fg":47.6,"fg3":36.6,"ft":78.0,"salary":49800000}}'::jsonb),
  ('23:austin reaves', 23, 'Austin Reaves', 'Austin Reaves', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Austin Reaves","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":51,"pts":23.3,"reb":4.7,"ast":5.5,"stl":1.1,"blk":0.4,"tov":3.0,"fg":49.0,"fg3":36.0,"ft":87.1,"salary":41240250}}'::jsonb),
  ('23:quentin grimes', 23, 'Quentin Grimes', 'Quentin Grimes', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Quentin Grimes","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":75,"pts":13.4,"reb":3.6,"ast":3.3,"stl":0.9,"blk":0.4,"tov":1.8,"fg":45.0,"fg3":33.4,"ft":84.0,"salary":13953489}}'::jsonb),
  ('23:sandro mamukelashvili', 23, 'Sandro Mamukelashvili', 'Sandro Mamukelashvili', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Sandro Mamukelashvili","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":80,"pts":11.2,"reb":4.9,"ast":1.9,"stl":0.8,"blk":0.5,"tov":0.8,"fg":52.3,"fg3":38.9,"ft":74.7,"salary":13000000}}'::jsonb),
  ('23:walker kessler', 23, 'Walker Kessler', 'Walker Kessler', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Walker Kessler","pos":"C","contract_type":null,"stats_season":"2025-26","gp":5,"pts":14.4,"reb":10.8,"ast":3.0,"stl":1.4,"blk":1.8,"tov":3.2,"fg":70.3,"fg3":75.0,"ft":70.0,"salary":30232558}}'::jsonb),
  ('23:arthur kaluma', 23, 'Arthur Kaluma', 'Arthur Kaluma', 'PF', '{"is_starter":false,"roster_order":5,"player":{"name":"Arthur Kaluma","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('23:adou thiero', 23, 'Adou Thiero', 'Adou Thiero', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Adou Thiero","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":25,"pts":1.9,"reb":1.1,"ast":0.4,"stl":0.3,"blk":0.1,"tov":0.4,"fg":51.6,"fg3":33.3,"ft":63.6,"salary":2150917}}'::jsonb),
  ('23:jarred vanderbilt', 23, 'Jarred Vanderbilt', 'Jarred Vanderbilt', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Jarred Vanderbilt","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":65,"pts":4.4,"reb":4.5,"ast":1.3,"stl":0.8,"blk":0.3,"tov":0.9,"fg":47.1,"fg3":29.3,"ft":58.9,"salary":12428571}}'::jsonb),
  ('23:matisse thybulle', 23, 'Matisse Thybulle', 'Matisse Thybulle', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Matisse Thybulle","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":30,"pts":5.8,"reb":2.0,"ast":0.9,"stl":2.0,"blk":0.5,"tov":0.9,"fg":43.3,"fg3":39.8,"ft":84.0,"salary":2449421}}'::jsonb),
  ('23:dalton knecht', 23, 'Dalton Knecht', 'Dalton Knecht', 'SF', '{"is_starter":false,"roster_order":9,"player":{"name":"Dalton Knecht","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":54,"pts":4.2,"reb":1.4,"ast":0.4,"stl":0.2,"blk":0.2,"tov":0.4,"fg":45.5,"fg3":34.2,"ft":72.7,"salary":4201080}}'::jsonb),
  ('23:jaden hardy', 23, 'Jaden Hardy', 'Jaden Hardy', 'SG', '{"is_starter":false,"roster_order":10,"player":{"name":"Jaden Hardy","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":57,"pts":9.2,"reb":1.5,"ast":1.0,"stl":0.3,"blk":0.1,"tov":1.1,"fg":42.4,"fg3":39.7,"ft":73.3,"salary":6000000}}'::jsonb),
  ('23:bronny james', 23, 'Bronny James', 'Bronny James', 'PG', '{"is_starter":false,"roster_order":11,"player":{"name":"Bronny James","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":42,"pts":2.9,"reb":0.5,"ast":1.2,"stl":0.5,"blk":0.1,"tov":0.6,"fg":40.9,"fg3":38.6,"ft":85.7,"salary":2296271}}'::jsonb),
  ('23:collin sexton', 23, 'Collin Sexton', 'Collin Sexton', 'PG', '{"is_starter":false,"roster_order":12,"player":{"name":"Collin Sexton","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":68,"pts":15.4,"reb":2.3,"ast":3.3,"stl":1.1,"blk":0.1,"tov":2.1,"fg":48.5,"fg3":40.1,"ft":85.5,"salary":9366000}}'::jsonb),
  ('23:ziaire williams', 23, 'Ziaire Williams', 'Ziaire Williams', 'SF', '{"is_starter":false,"roster_order":13,"player":{"name":"Ziaire Williams","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":56,"pts":10.2,"reb":2.4,"ast":1.1,"stl":1.4,"blk":0.4,"tov":1.1,"fg":42.5,"fg3":34.3,"ft":85.0,"salary":2449421}}'::jsonb),
  ('23:jake laravia', 23, 'Jake LaRavia', 'Jake LaRavia', 'SF', '{"is_starter":false,"roster_order":14,"player":{"name":"Jake LaRavia","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":82,"pts":8.2,"reb":4.0,"ast":1.8,"stl":1.3,"blk":0.5,"tov":1.1,"fg":45.9,"fg3":32.1,"ft":76.3,"salary":6000000}}'::jsonb),
  ('23:chris mañon', 23, 'Chris Mañon', 'Chris Mañon', 'SG', '{"is_starter":false,"roster_order":15,"player":{"name":"Chris Mañon","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":9,"pts":0.8,"reb":1.1,"ast":0.3,"stl":0.6,"blk":0.2,"tov":0.1,"fg":33.3,"fg3":0.0,"ft":75.0,"salary":null}}'::jsonb),
  ('23:ak okereke', 23, 'AK Okereke', 'AK Okereke', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"AK Okereke","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('23:cameron carr', 23, 'Cameron Carr', 'Cameron Carr', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Cameron Carr","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3315360}}'::jsonb),
  ('23:kevon looney', 23, 'Kevon Looney', 'Kevon Looney', 'C', '{"is_starter":false,"roster_order":18,"player":{"name":"Kevon Looney","pos":"C","contract_type":null,"stats_season":"2025-26","gp":21,"pts":2.8,"reb":5.6,"ast":1.6,"stl":0.4,"blk":0.5,"tov":0.4,"fg":41.7,"fg3":15.4,"ft":70.0,"salary":2449421}}'::jsonb),
  ('24:devin booker', 24, 'Devin Booker', 'Devin Booker', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Devin Booker","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":64,"pts":26.1,"reb":3.9,"ast":6.0,"stl":0.8,"blk":0.3,"tov":3.1,"fg":45.6,"fg3":33.0,"ft":87.3,"salary":57078728}}'::jsonb),
  ('24:jalen green', 24, 'Jalen Green', 'Jalen Green', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Jalen Green","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":32,"pts":17.8,"reb":3.6,"ast":2.8,"stl":1.1,"blk":0.3,"tov":2.3,"fg":42.2,"fg3":31.3,"ft":74.7,"salary":36251166}}'::jsonb),
  ('24:dillon brooks', 24, 'Dillon Brooks', 'Dillon Brooks', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Dillon Brooks","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":56,"pts":20.2,"reb":3.6,"ast":1.8,"stl":1.0,"blk":0.2,"tov":1.8,"fg":43.5,"fg3":34.4,"ft":84.2,"salary":19992727}}'::jsonb),
  ('24:miles bridges', 24, 'Miles Bridges', 'Miles Bridges', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Miles Bridges","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":17.1,"reb":5.8,"ast":3.2,"stl":0.6,"blk":0.4,"tov":1.4,"fg":46.0,"fg3":33.3,"ft":82.2,"salary":22826087}}'::jsonb),
  ('24:mark williams', 24, 'Mark Williams', 'Mark Williams', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Mark Williams","pos":"C","contract_type":null,"stats_season":"2025-26","gp":60,"pts":11.7,"reb":8.0,"ast":1.0,"stl":0.9,"blk":0.9,"tov":1.1,"fg":64.4,"fg3":100.0,"ft":77.1,"salary":11728395}}'::jsonb),
  ('24:ryan dunn', 24, 'Ryan Dunn', 'Ryan Dunn', 'PF', '{"is_starter":false,"roster_order":5,"player":{"name":"Ryan Dunn","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":70,"pts":5.8,"reb":4.2,"ast":1.5,"stl":0.9,"blk":0.4,"tov":0.8,"fg":45.3,"fg3":33.1,"ft":48.9,"salary":2784240}}'::jsonb),
  ('24:amir coffey', 24, 'Amir Coffey', 'Amir Coffey', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Amir Coffey","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":46,"pts":3.2,"reb":1.2,"ast":0.6,"stl":0.2,"blk":0.1,"tov":0.2,"fg":48.7,"fg3":34.7,"ft":78.6,"salary":null}}'::jsonb),
  ('24:haywood highsmith', 24, 'Haywood Highsmith', 'Haywood Highsmith', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Haywood Highsmith","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":7,"pts":5.4,"reb":1.9,"ast":1.0,"stl":0.6,"blk":0.0,"tov":0.0,"fg":52.2,"fg3":57.1,"ft":85.7,"salary":3449421}}'::jsonb),
  ('24:luke kennard', 24, 'Luke Kennard', 'Luke Kennard', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Luke Kennard","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":78,"pts":8.4,"reb":2.3,"ast":2.2,"stl":0.7,"blk":0.1,"tov":0.8,"fg":53.3,"fg3":47.8,"ft":91.3,"salary":6064000}}'::jsonb),
  ('24:khaman maluach', 24, 'Khaman Maluach', 'Khaman Maluach', 'C', '{"is_starter":false,"roster_order":9,"player":{"name":"Khaman Maluach","pos":"C","contract_type":null,"stats_season":"2025-26","gp":46,"pts":3.0,"reb":2.9,"ast":0.1,"stl":0.1,"blk":0.7,"tov":0.5,"fg":53.3,"fg3":23.8,"ft":71.0,"salary":6316680}}'::jsonb),
  ('24:oso ighodaro', 24, 'Oso Ighodaro', 'Oso Ighodaro', 'PF', '{"is_starter":false,"roster_order":10,"player":{"name":"Oso Ighodaro","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":82,"pts":6.5,"reb":5.1,"ast":2.3,"stl":0.9,"blk":0.7,"tov":1.2,"fg":65.3,"fg3":0.0,"ft":45.3,"salary":2296271}}'::jsonb),
  ('24:collin gillespie', 24, 'Collin Gillespie', 'Collin Gillespie', 'PG', '{"is_starter":false,"roster_order":11,"player":{"name":"Collin Gillespie","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":80,"pts":12.7,"reb":4.1,"ast":4.6,"stl":1.2,"blk":0.2,"tov":1.6,"fg":41.8,"fg3":40.1,"ft":87.4,"salary":10714286}}'::jsonb),
  ('24:koby brea', 24, 'Koby Brea', 'Koby Brea', 'SG', '{"is_starter":false,"roster_order":12,"player":{"name":"Koby Brea","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":12,"pts":3.8,"reb":0.7,"ast":0.8,"stl":0.1,"blk":0.0,"tov":0.3,"fg":41.7,"fg3":43.3,"ft":100.0,"salary":null}}'::jsonb),
  ('24:jamaree bouyea', 24, 'Jamaree Bouyea', 'Jamaree Bouyea', 'PG', '{"is_starter":false,"roster_order":13,"player":{"name":"Jamaree Bouyea","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":46,"pts":5.7,"reb":1.8,"ast":1.8,"stl":0.6,"blk":0.3,"tov":0.7,"fg":45.8,"fg3":29.5,"ft":68.6,"salary":2584539}}'::jsonb),
  ('24:isaiah livers', 24, 'Isaiah Livers', 'Isaiah Livers', 'PF', '{"is_starter":false,"roster_order":14,"player":{"name":"Isaiah Livers","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":36,"pts":1.8,"reb":1.7,"ast":0.6,"stl":0.4,"blk":0.2,"tov":0.3,"fg":34.4,"fg3":30.0,"ft":75.0,"salary":null}}'::jsonb),
  ('24:koa peat', 24, 'Koa Peat', 'Koa Peat', 'PF', '{"is_starter":false,"roster_order":15,"player":{"name":"Koa Peat","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2926800}}'::jsonb),
  ('24:rasheer fleming', 24, 'Rasheer Fleming', 'Rasheer Fleming', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"Rasheer Fleming","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":55,"pts":4.3,"reb":2.3,"ast":0.3,"stl":0.4,"blk":0.4,"tov":0.5,"fg":40.5,"fg3":34.6,"ft":55.9,"salary":2150917}}'::jsonb),
  ('24:cj huntley', 24, 'CJ Huntley', 'CJ Huntley', 'PF', '{"is_starter":false,"roster_order":17,"player":{"name":"CJ Huntley","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":4,"pts":3.0,"reb":1.3,"ast":0.5,"stl":0.3,"blk":0.0,"tov":0.0,"fg":54.5,"fg3":0.0,"ft":0.0,"salary":null}}'::jsonb),
  ('24:jordan goodwin', 24, 'Jordan Goodwin', 'Jordan Goodwin', 'SG', '{"is_starter":false,"roster_order":18,"player":{"name":"Jordan Goodwin","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":70,"pts":8.7,"reb":4.9,"ast":2.2,"stl":1.5,"blk":0.2,"tov":1.0,"fg":41.3,"fg3":37.1,"ft":69.6,"salary":5864198}}'::jsonb),
  ('24:pat spencer', 24, 'Pat Spencer', 'Pat Spencer', 'PG', '{"is_starter":false,"roster_order":19,"player":{"name":"Pat Spencer","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":66,"pts":7.2,"reb":2.4,"ast":3.5,"stl":0.7,"blk":0.1,"tov":1.3,"fg":42.7,"fg3":35.7,"ft":77.2,"salary":null}}'::jsonb),
  ('25:darius acuff jr.', 25, 'Darius Acuff Jr.', 'Darius Acuff Jr.', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Darius Acuff Jr.","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":8021640}}'::jsonb),
  ('25:de''andre hunter', 25, 'De''Andre Hunter', 'De''Andre Hunter', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"De''Andre Hunter","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":45,"pts":13.7,"reb":4.1,"ast":2.0,"stl":0.7,"blk":0.1,"tov":1.7,"fg":41.5,"fg3":30.5,"ft":86.7,"salary":24910714}}'::jsonb),
  ('25:keegan murray', 25, 'Keegan Murray', 'Keegan Murray', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Keegan Murray","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":23,"pts":14.0,"reb":5.7,"ast":1.7,"stl":1.0,"blk":1.6,"tov":1.2,"fg":42.0,"fg3":27.7,"ft":77.6,"salary":24137936}}'::jsonb),
  ('25:zach lavine', 25, 'Zach LaVine', 'Zach LaVine', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Zach LaVine","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":39,"pts":19.2,"reb":2.8,"ast":2.3,"stl":0.7,"blk":0.3,"tov":1.9,"fg":47.9,"fg3":39.0,"ft":88.0,"salary":48967380}}'::jsonb),
  ('25:domantas sabonis', 25, 'Domantas Sabonis', 'Domantas Sabonis', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Domantas Sabonis","pos":"C","contract_type":null,"stats_season":"2025-26","gp":19,"pts":15.8,"reb":11.4,"ast":4.1,"stl":0.9,"blk":0.2,"tov":2.7,"fg":54.3,"fg3":18.5,"ft":72.7,"salary":45472000}}'::jsonb),
  ('25:malik monk', 25, 'Malik Monk', 'Malik Monk', 'SG', '{"is_starter":false,"roster_order":5,"player":{"name":"Malik Monk","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":62,"pts":12.5,"reb":1.9,"ast":3.0,"stl":0.6,"blk":0.4,"tov":1.5,"fg":43.8,"fg3":39.5,"ft":87.9,"salary":20190035}}'::jsonb),
  ('25:jonathan mogbo', 25, 'Jonathan Mogbo', 'Jonathan Mogbo', 'PF', '{"is_starter":false,"roster_order":6,"player":{"name":"Jonathan Mogbo","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":40,"pts":1.5,"reb":1.7,"ast":0.6,"stl":0.3,"blk":0.2,"tov":0.4,"fg":59.1,"fg3":0.0,"ft":64.3,"salary":null}}'::jsonb),
  ('25:precious achiuwa', 25, 'Precious Achiuwa', 'Precious Achiuwa', 'PF', '{"is_starter":false,"roster_order":7,"player":{"name":"Precious Achiuwa","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":73,"pts":10.1,"reb":6.7,"ast":1.4,"stl":0.9,"blk":0.7,"tov":0.9,"fg":52.8,"fg3":27.8,"ft":55.4,"salary":5477000}}'::jsonb),
  ('25:nique clifford', 18, 'Nique Clifford', 'Nique Clifford', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Nique Clifford","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":75,"pts":8.6,"reb":3.8,"ast":2.4,"stl":0.9,"blk":0.3,"tov":1.5,"fg":41.8,"fg3":33.3,"ft":72.2,"salary":3263400}}'::jsonb),
  ('25:adam flagler', 25, 'Adam Flagler', 'Adam Flagler', 'PG', '{"is_starter":false,"roster_order":9,"player":{"name":"Adam Flagler","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('25:ben simmons', 25, 'Ben Simmons', 'Ben Simmons', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Ben Simmons","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2449421}}'::jsonb),
  ('25:daeqwon plowden', 25, 'Daeqwon Plowden', 'Daeqwon Plowden', 'SG', '{"is_starter":false,"roster_order":11,"player":{"name":"Daeqwon Plowden","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":32,"pts":10.8,"reb":3.0,"ast":1.3,"stl":0.7,"blk":0.2,"tov":0.8,"fg":43.0,"fg3":33.3,"ft":85.7,"salary":2449421}}'::jsonb),
  ('25:dylan cardwell', 25, 'Dylan Cardwell', 'Dylan Cardwell', 'C', '{"is_starter":false,"roster_order":12,"player":{"name":"Dylan Cardwell","pos":"C","contract_type":null,"stats_season":"2025-26","gp":44,"pts":5.4,"reb":7.5,"ast":1.4,"stl":0.7,"blk":1.5,"tov":0.9,"fg":58.7,"fg3":50.0,"ft":51.0,"salary":null}}'::jsonb),
  ('25:alex karaban', 25, 'Alex Karaban', 'Alex Karaban', 'SF', '{"is_starter":false,"roster_order":13,"player":{"name":"Alex Karaban","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":2948280}}'::jsonb),
  ('25:emanuel sharp', 25, 'Emanuel Sharp', 'Emanuel Sharp', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"Emanuel Sharp","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('25:maxime raynaud', 25, 'Maxime Raynaud', 'Maxime Raynaud', 'C', '{"is_starter":false,"roster_order":15,"player":{"name":"Maxime Raynaud","pos":"C","contract_type":null,"stats_season":"2025-26","gp":74,"pts":12.5,"reb":7.5,"ast":1.4,"stl":0.5,"blk":0.5,"tov":1.3,"fg":57.1,"fg3":32.4,"ft":78.6,"salary":2150917}}'::jsonb),
  ('26:kyrie irving', 26, 'Kyrie Irving', 'Kyrie Irving', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Kyrie Irving","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":39491282}}'::jsonb),
  ('26:max christie', 26, 'Max Christie', 'Max Christie', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Max Christie","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":77,"pts":12.3,"reb":3.2,"ast":2.0,"stl":0.6,"blk":0.4,"tov":1.2,"fg":44.1,"fg3":40.4,"ft":89.9,"salary":8285714}}'::jsonb),
  ('26:zaccharie risacher', 26, 'Zaccharie Risacher', 'Zaccharie Risacher', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Zaccharie Risacher","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":67,"pts":9.6,"reb":3.8,"ast":1.1,"stl":0.9,"blk":0.5,"tov":0.9,"fg":45.5,"fg3":36.8,"ft":64.4,"salary":13826040}}'::jsonb),
  ('26:cooper flagg', 26, 'Cooper Flagg', 'Cooper Flagg', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Cooper Flagg","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":70,"pts":21.0,"reb":6.7,"ast":4.5,"stl":1.2,"blk":0.9,"tov":2.3,"fg":46.8,"fg3":29.5,"ft":82.7,"salary":14517480}}'::jsonb),
  ('26:dereck lively ii', 26, 'Dereck Lively II', 'Dereck Lively II', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Dereck Lively II","pos":"C","contract_type":null,"stats_season":"2025-26","gp":7,"pts":4.3,"reb":5.3,"ast":1.9,"stl":0.6,"blk":1.6,"tov":1.4,"fg":61.1,"fg3":0.0,"ft":80.0,"salary":7239131}}'::jsonb),
  ('26:tarik biberovic', 26, 'Tarik Biberovic', 'Tarik Biberovic', 'SF', '{"is_starter":false,"roster_order":5,"player":{"name":"Tarik Biberovic","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3000000}}'::jsonb),
  ('26:vsevolod ishchenko', 26, 'Vsevolod Ishchenko', 'Vsevolod Ishchenko', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Vsevolod Ishchenko","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('26:john poulakidas', 26, 'John Poulakidas', 'John Poulakidas', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"John Poulakidas","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":13,"pts":8.8,"reb":2.3,"ast":0.8,"stl":0.5,"blk":0.3,"tov":0.3,"fg":42.9,"fg3":40.3,"ft":85.7,"salary":null}}'::jsonb),
  ('26:naji marshall', 26, 'Naji Marshall', 'Naji Marshall', 'SF', '{"is_starter":false,"roster_order":8,"player":{"name":"Naji Marshall","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":74,"pts":15.2,"reb":4.7,"ast":3.3,"stl":1.1,"blk":0.1,"tov":1.6,"fg":51.0,"fg3":29.1,"ft":76.0,"salary":9428571}}'::jsonb),
  ('26:dwight powell', 26, 'Dwight Powell', 'Dwight Powell', 'C', '{"is_starter":false,"roster_order":9,"player":{"name":"Dwight Powell","pos":"C","contract_type":null,"stats_season":"2025-26","gp":63,"pts":3.3,"reb":4.1,"ast":1.1,"stl":0.5,"blk":0.3,"tov":0.7,"fg":64.4,"fg3":28.6,"ft":69.6,"salary":null}}'::jsonb),
  ('26:marcus sasser', 26, 'Marcus Sasser', 'Marcus Sasser', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Marcus Sasser","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":38,"pts":5.2,"reb":1.0,"ast":2.0,"stl":0.5,"blk":0.1,"tov":0.8,"fg":39.0,"fg3":41.5,"ft":83.3,"salary":5198983}}'::jsonb),
  ('26:jett howard', 26, 'Jett Howard', 'Jett Howard', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Jett Howard","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":55,"pts":5.5,"reb":1.6,"ast":0.8,"stl":0.2,"blk":0.2,"tov":0.3,"fg":41.8,"fg3":37.2,"ft":94.9,"salary":null}}'::jsonb),
  ('26:morez johnson jr.', 26, 'Morez Johnson Jr.', 'Morez Johnson Jr.', 'PF', '{"is_starter":false,"roster_order":12,"player":{"name":"Morez Johnson Jr.","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":6754800}}'::jsonb),
  ('26:caleb martin', 26, 'Caleb Martin', 'Caleb Martin', 'SF', '{"is_starter":false,"roster_order":13,"player":{"name":"Caleb Martin","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":58,"pts":3.9,"reb":2.5,"ast":1.4,"stl":0.7,"blk":0.3,"tov":0.7,"fg":45.0,"fg3":35.1,"ft":60.7,"salary":10001493}}'::jsonb),
  ('26:daniel gafford', 26, 'Daniel Gafford', 'Daniel Gafford', 'C', '{"is_starter":false,"roster_order":14,"player":{"name":"Daniel Gafford","pos":"C","contract_type":null,"stats_season":"2025-26","gp":55,"pts":9.5,"reb":6.9,"ast":1.1,"stl":0.8,"blk":1.3,"tov":1.1,"fg":65.5,"fg3":0.0,"ft":68.3,"salary":17263584}}'::jsonb),
  ('26:p.j. washington', 26, 'P.J. Washington', 'P.J. Washington', 'PF', '{"is_starter":false,"roster_order":15,"player":{"name":"P.J. Washington","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":56,"pts":14.2,"reb":7.0,"ast":1.8,"stl":1.0,"blk":1.1,"tov":1.7,"fg":45.0,"fg3":32.5,"ft":68.7,"salary":19813044}}'::jsonb),
  ('26:moussa cisse', 26, 'Moussa Cisse', 'Moussa Cisse', 'C', '{"is_starter":false,"roster_order":16,"player":{"name":"Moussa Cisse","pos":"C","contract_type":null,"stats_season":"2025-26","gp":38,"pts":4.5,"reb":5.7,"ast":0.2,"stl":0.5,"blk":1.2,"tov":0.8,"fg":57.4,"fg3":0.0,"ft":46.9,"salary":2185116}}'::jsonb),
  ('26:tobi lawal', 26, 'Tobi Lawal', 'Tobi Lawal', 'SF', '{"is_starter":false,"roster_order":17,"player":{"name":"Tobi Lawal","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('26:santi aldama', 26, 'Santi Aldama', 'Santi Aldama', 'PF', '{"is_starter":false,"roster_order":18,"player":{"name":"Santi Aldama","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":43,"pts":14.0,"reb":6.7,"ast":2.9,"stl":0.9,"blk":0.7,"tov":1.3,"fg":47.9,"fg3":35.0,"ft":66.7,"salary":17007043}}'::jsonb),
  ('26:sergio de larrea', 26, 'Sergio de Larrea', 'Sergio de Larrea', 'PG', '{"is_starter":false,"roster_order":19,"player":{"name":"Sergio de Larrea","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3182280}}'::jsonb),
  ('27:fred vanvleet', 27, 'Fred VanVleet', 'Fred VanVleet', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Fred VanVleet","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":25000000}}'::jsonb),
  ('27:amen thompson', 27, 'Amen Thompson', 'Amen Thompson', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Amen Thompson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":79,"pts":18.3,"reb":7.8,"ast":5.3,"stl":1.5,"blk":0.6,"tov":2.4,"fg":53.4,"fg3":21.6,"ft":77.9,"salary":12258609}}'::jsonb),
  ('27:kevin durant', 27, 'Kevin Durant', 'Kevin Durant', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Kevin Durant","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":78,"pts":26.0,"reb":5.5,"ast":4.8,"stl":0.8,"blk":0.9,"tov":3.2,"fg":52.0,"fg3":41.3,"ft":87.4,"salary":43902439}}'::jsonb),
  ('27:jabari smith jr.', 27, 'Jabari Smith Jr.', 'Jabari Smith Jr.', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Jabari Smith Jr.","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":15.8,"reb":6.9,"ast":1.9,"stl":0.7,"blk":0.9,"tov":1.4,"fg":45.0,"fg3":36.3,"ft":77.5,"salary":23643411}}'::jsonb),
  ('27:alperen şengün', 27, 'Alperen Şengün', 'Alperen Şengün', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Alperen Şengün","pos":"C","contract_type":null,"stats_season":"2025-26","gp":72,"pts":20.4,"reb":8.9,"ast":6.2,"stl":1.2,"blk":1.1,"tov":3.2,"fg":51.9,"fg3":30.5,"ft":69.1,"salary":35642202}}'::jsonb),
  ('27:sean pedulla', 27, 'Sean Pedulla', 'Sean Pedulla', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Sean Pedulla","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":7,"pts":1.9,"reb":0.4,"ast":0.7,"stl":0.0,"blk":0.0,"tov":0.1,"fg":33.3,"fg3":30.0,"ft":0.0,"salary":null}}'::jsonb),
  ('27:bruce thornton', 27, 'Bruce Thornton', 'Bruce Thornton', 'PG', '{"is_starter":false,"roster_order":6,"player":{"name":"Bruce Thornton","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":1357763}}'::jsonb),
  ('27:rafael castro', 27, 'Rafael Castro', 'Rafael Castro', 'C', '{"is_starter":false,"roster_order":7,"player":{"name":"Rafael Castro","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('27:quadir copeland', 27, 'Quadir Copeland', 'Quadir Copeland', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Quadir Copeland","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('27:aaron holiday', 27, 'Aaron Holiday', 'Aaron Holiday', 'PG', '{"is_starter":false,"roster_order":9,"player":{"name":"Aaron Holiday","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":57,"pts":5.5,"reb":1.0,"ast":1.1,"stl":0.5,"blk":0.1,"tov":0.7,"fg":41.7,"fg3":39.4,"ft":85.4,"salary":null}}'::jsonb),
  ('27:julian phillips', 27, 'Julian Phillips', 'Julian Phillips', 'SF', '{"is_starter":false,"roster_order":10,"player":{"name":"Julian Phillips","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":48,"pts":2.9,"reb":1.0,"ast":0.2,"stl":0.5,"blk":0.1,"tov":0.2,"fg":42.1,"fg3":30.8,"ft":78.3,"salary":2537526}}'::jsonb),
  ('27:jae''sean tate', 27, 'Jae''Sean Tate', 'Jae''Sean Tate', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Jae''Sean Tate","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":46,"pts":2.8,"reb":1.6,"ast":0.5,"stl":0.2,"blk":0.1,"tov":0.3,"fg":51.4,"fg3":31.3,"ft":63.6,"salary":2449421}}'::jsonb),
  ('27:steven adams', 27, 'Steven Adams', 'Steven Adams', 'C', '{"is_starter":false,"roster_order":12,"player":{"name":"Steven Adams","pos":"C","contract_type":null,"stats_season":"2025-26","gp":32,"pts":5.8,"reb":8.6,"ast":1.5,"stl":0.7,"blk":0.6,"tov":1.1,"fg":50.4,"fg3":0.0,"ft":58.0,"salary":13000000}}'::jsonb),
  ('27:reed sheppard', 27, 'Reed Sheppard', 'Reed Sheppard', 'SG', '{"is_starter":false,"roster_order":13,"player":{"name":"Reed Sheppard","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":13.5,"reb":2.9,"ast":3.4,"stl":1.5,"blk":0.7,"tov":1.5,"fg":43.0,"fg3":39.4,"ft":80.2,"salary":11108880}}'::jsonb),
  ('27:tari eason', 27, 'Tari Eason', 'Tari Eason', 'SF', '{"is_starter":false,"roster_order":14,"player":{"name":"Tari Eason","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":60,"pts":10.5,"reb":6.3,"ast":1.5,"stl":1.2,"blk":0.5,"tov":1.4,"fg":41.6,"fg3":35.8,"ft":77.6,"salary":14051724}}'::jsonb),
  ('27:isaiah crawford', 27, 'Isaiah Crawford', 'Isaiah Crawford', 'SF', '{"is_starter":false,"roster_order":15,"player":{"name":"Isaiah Crawford","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":14,"pts":2.0,"reb":1.1,"ast":0.4,"stl":0.1,"blk":0.2,"tov":0.3,"fg":41.7,"fg3":23.1,"ft":83.3,"salary":2449421}}'::jsonb),
  ('27:clint capela', 27, 'Clint Capela', 'Clint Capela', 'C', '{"is_starter":false,"roster_order":16,"player":{"name":"Clint Capela","pos":"C","contract_type":null,"stats_season":"2025-26","gp":75,"pts":3.8,"reb":4.6,"ast":0.7,"stl":0.5,"blk":0.8,"tov":0.5,"fg":52.0,"fg3":50.0,"ft":57.7,"salary":7035000}}'::jsonb),
  ('27:bogdan bogdanović', 27, 'Bogdan Bogdanović', 'Bogdan Bogdanović', 'SG', '{"is_starter":false,"roster_order":17,"player":{"name":"Bogdan Bogdanović","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":23,"pts":7.4,"reb":2.6,"ast":2.2,"stl":0.4,"blk":0.1,"tov":1.2,"fg":38.8,"fg3":34.7,"ft":80.0,"salary":2449421}}'::jsonb),
  ('27:jeff green', 27, 'Jeff Green', 'Jeff Green', 'PF', '{"is_starter":false,"roster_order":18,"player":{"name":"Jeff Green","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":30,"pts":2.2,"reb":0.8,"ast":0.3,"stl":0.1,"blk":0.1,"tov":0.1,"fg":36.8,"fg3":27.3,"ft":100.0,"salary":null}}'::jsonb),
  ('27:oscar tshiebwe', 27, 'Oscar Tshiebwe', 'Oscar Tshiebwe', 'C', '{"is_starter":false,"roster_order":19,"player":{"name":"Oscar Tshiebwe","pos":"C","contract_type":null,"stats_season":"2025-26","gp":27,"pts":7.8,"reb":6.6,"ast":1.2,"stl":0.6,"blk":0.2,"tov":0.8,"fg":63.4,"fg3":0.0,"ft":55.1,"salary":2537526}}'::jsonb),
  ('27:marcus smart', 27, 'Marcus Smart', 'Marcus Smart', 'PG', '{"is_starter":false,"roster_order":20,"player":{"name":"Marcus Smart","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":62,"pts":9.3,"reb":2.8,"ast":3.0,"stl":1.4,"blk":0.4,"tov":1.5,"fg":39.5,"fg3":33.1,"ft":82.2,"salary":6064000}}'::jsonb),
  ('28:ty jerome', 28, 'Ty Jerome', 'Ty Jerome', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Ty Jerome","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":15,"pts":19.7,"reb":2.8,"ast":5.7,"stl":1.1,"blk":0.3,"tov":1.8,"fg":47.4,"fg3":42.0,"ft":87.5,"salary":9220050}}'::jsonb),
  ('28:jaylen wells', 28, 'Jaylen Wells', 'Jaylen Wells', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Jaylen Wells","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":12.5,"reb":3.2,"ast":1.6,"stl":0.9,"blk":0.1,"tov":1.1,"fg":43.1,"fg3":35.3,"ft":78.4,"salary":2296271}}'::jsonb),
  ('28:cedric coward', 28, 'Cedric Coward', 'Cedric Coward', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Cedric Coward","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":62,"pts":13.6,"reb":5.9,"ast":2.8,"stl":0.6,"blk":0.4,"tov":1.7,"fg":47.1,"fg3":33.8,"ft":84.3,"salary":6001080}}'::jsonb),
  ('28:cameron boozer', 28, 'Cameron Boozer', 'Cameron Boozer', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Cameron Boozer","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":11849760}}'::jsonb),
  ('28:zach edey', 28, 'Zach Edey', 'Zach Edey', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Zach Edey","pos":"C","contract_type":null,"stats_season":"2025-26","gp":11,"pts":13.6,"reb":11.1,"ast":1.1,"stl":0.6,"blk":1.9,"tov":2.4,"fg":63.3,"fg3":20.0,"ft":78.1,"salary":6332760}}'::jsonb),
  ('28:jahmai mashack', 28, 'Jahmai Mashack', 'Jahmai Mashack', 'SG', '{"is_starter":false,"roster_order":5,"player":{"name":"Jahmai Mashack","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":31,"pts":6.2,"reb":2.6,"ast":2.2,"stl":1.2,"blk":0.5,"tov":1.6,"fg":39.5,"fg3":25.3,"ft":54.3,"salary":null}}'::jsonb),
  ('28:richie saunders', 28, 'Richie Saunders', 'Richie Saunders', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Richie Saunders","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('28:scotty pippen jr.', 28, 'Scotty Pippen Jr.', 'Scotty Pippen Jr.', 'PG', '{"is_starter":false,"roster_order":7,"player":{"name":"Scotty Pippen Jr.","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":10,"pts":11.4,"reb":2.2,"ast":4.7,"stl":1.9,"blk":0.4,"tov":2.7,"fg":44.8,"fg3":31.3,"ft":78.3,"salary":2461462}}'::jsonb),
  ('28:walter clayton jr.', 28, 'Walter Clayton Jr.', 'Walter Clayton Jr.', 'PG', '{"is_starter":false,"roster_order":8,"player":{"name":"Walter Clayton Jr.","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":7.8,"reb":2.0,"ast":4.0,"stl":0.6,"blk":0.3,"tov":1.7,"fg":38.4,"fg3":30.7,"ft":90.1,"salary":4190520}}'::jsonb),
  ('28:jerami grant', 28, 'Jerami Grant', 'Jerami Grant', 'SF', '{"is_starter":false,"roster_order":9,"player":{"name":"Jerami Grant","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":57,"pts":18.6,"reb":3.5,"ast":2.1,"stl":0.7,"blk":0.6,"tov":2.1,"fg":45.3,"fg3":38.9,"ft":81.4,"salary":34206898}}'::jsonb),
  ('28:javon small', 28, 'Javon Small', 'Javon Small', 'PG', '{"is_starter":false,"roster_order":10,"player":{"name":"Javon Small","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":41,"pts":9.7,"reb":3.1,"ast":3.7,"stl":0.8,"blk":0.2,"tov":1.4,"fg":46.5,"fg3":42.3,"ft":82.9,"salary":null}}'::jsonb),
  ('28:micah peavy', 28, 'Micah Peavy', 'Micah Peavy', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Micah Peavy","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":61,"pts":4.3,"reb":1.9,"ast":1.0,"stl":0.7,"blk":0.1,"tov":0.3,"fg":38.5,"fg3":25.9,"ft":75.9,"salary":2150917}}'::jsonb),
  ('28:olivier-maxence prosper', 28, 'Olivier-Maxence Prosper', 'Olivier-Maxence Prosper', 'PF', '{"is_starter":false,"roster_order":12,"player":{"name":"Olivier-Maxence Prosper","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":53,"pts":10.0,"reb":3.5,"ast":1.0,"stl":0.8,"blk":0.2,"tov":0.9,"fg":54.9,"fg3":40.5,"ft":75.4,"salary":2497812}}'::jsonb),
  ('28:quinten post', 28, 'Quinten Post', 'Quinten Post', 'C', '{"is_starter":false,"roster_order":13,"player":{"name":"Quinten Post","pos":"C","contract_type":null,"stats_season":"2025-26","gp":67,"pts":7.7,"reb":4.0,"ast":1.4,"stl":0.4,"blk":0.5,"tov":0.8,"fg":44.0,"fg3":33.6,"ft":79.1,"salary":8285714}}'::jsonb),
  ('28:taylor hendricks', 28, 'Taylor Hendricks', 'Taylor Hendricks', 'PF', '{"is_starter":false,"roster_order":14,"player":{"name":"Taylor Hendricks","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":59,"pts":7.4,"reb":3.7,"ast":0.9,"stl":0.8,"blk":0.5,"tov":0.8,"fg":45.9,"fg3":34.2,"ft":68.1,"salary":7805900}}'::jsonb),
  ('28:jordan hawkins', 28, 'Jordan Hawkins', 'Jordan Hawkins', 'SG', '{"is_starter":false,"roster_order":15,"player":{"name":"Jordan Hawkins","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":51,"pts":5.1,"reb":1.7,"ast":0.8,"stl":0.3,"blk":0.2,"tov":0.7,"fg":36.6,"fg3":34.8,"ft":85.2,"salary":7021895}}'::jsonb),
  ('28:cam spencer', 28, 'Cam Spencer', 'Cam Spencer', 'SG', '{"is_starter":false,"roster_order":16,"player":{"name":"Cam Spencer","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":72,"pts":11.1,"reb":2.5,"ast":5.6,"stl":0.7,"blk":0.2,"tov":1.3,"fg":47.3,"fg3":44.9,"ft":94.0,"salary":2411090}}'::jsonb),
  ('28:kris murray', 28, 'Kris Murray', 'Kris Murray', 'PF', '{"is_starter":false,"roster_order":17,"player":{"name":"Kris Murray","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":57,"pts":5.8,"reb":3.6,"ast":1.4,"stl":0.9,"blk":0.4,"tov":0.8,"fg":46.7,"fg3":27.9,"ft":68.4,"salary":5315004}}'::jsonb),
  ('28:isaiah stewart', 28, 'Isaiah Stewart', 'Isaiah Stewart', 'C', '{"is_starter":false,"roster_order":18,"player":{"name":"Isaiah Stewart","pos":"C","contract_type":null,"stats_season":"2025-26","gp":58,"pts":10.0,"reb":5.0,"ast":1.1,"stl":0.3,"blk":1.6,"tov":1.2,"fg":55.0,"fg3":33.3,"ft":75.6,"salary":15000000}}'::jsonb),
  ('28:karim lopez', 28, 'Karim Lopez', 'Karim Lopez', 'SF', '{"is_starter":false,"roster_order":19,"player":{"name":"Karim Lopez","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3746760}}'::jsonb),
  ('28:gg jackson', 28, 'GG Jackson', 'GG Jackson', 'PF', '{"is_starter":false,"roster_order":20,"player":{"name":"GG Jackson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":55,"pts":12.5,"reb":4.3,"ast":1.5,"stl":0.6,"blk":0.8,"tov":1.5,"fg":49.6,"fg3":33.2,"ft":74.2,"salary":2406205}}'::jsonb),
  ('29:dejounte murray', 29, 'Dejounte Murray', 'Dejounte Murray', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"Dejounte Murray","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":14,"pts":16.7,"reb":5.4,"ast":6.4,"stl":1.6,"blk":0.2,"tov":3.4,"fg":48.4,"fg3":30.6,"ft":86.7,"salary":32785071}}'::jsonb),
  ('29:trey murphy iii', 29, 'Trey Murphy III', 'Trey Murphy III', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Trey Murphy III","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":66,"pts":21.5,"reb":5.7,"ast":3.8,"stl":1.5,"blk":0.4,"tov":1.8,"fg":47.0,"fg3":37.9,"ft":88.6,"salary":27000000}}'::jsonb),
  ('29:herb jones', 29, 'Herb Jones', 'Herb Jones', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Herb Jones","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":56,"pts":8.9,"reb":3.4,"ast":2.8,"stl":1.6,"blk":0.5,"tov":1.3,"fg":38.3,"fg3":30.9,"ft":80.6,"salary":14898786}}'::jsonb),
  ('29:zion williamson', 29, 'Zion Williamson', 'Zion Williamson', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Zion Williamson","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":62,"pts":21.0,"reb":5.7,"ast":3.2,"stl":1.0,"blk":0.5,"tov":2.0,"fg":60.0,"fg3":25.0,"ft":71.6,"salary":42166510}}'::jsonb),
  ('29:derik queen', 29, 'Derik Queen', 'Derik Queen', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Derik Queen","pos":"C","contract_type":null,"stats_season":"2025-26","gp":81,"pts":11.7,"reb":7.1,"ast":3.7,"stl":1.0,"blk":0.9,"tov":2.3,"fg":47.3,"fg3":26.1,"ft":79.5,"salary":5416080}}'::jsonb),
  ('29:jeremiah fears', 29, 'Jeremiah Fears', 'Jeremiah Fears', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Jeremiah Fears","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":82,"pts":14.3,"reb":3.7,"ast":3.4,"stl":1.2,"blk":0.4,"tov":2.2,"fg":43.4,"fg3":33.0,"ft":78.9,"salary":7896240}}'::jsonb),
  ('29:jordan poole', 29, 'Jordan Poole', 'Jordan Poole', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Jordan Poole","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":39,"pts":13.4,"reb":2.0,"ast":3.1,"stl":0.6,"blk":0.4,"tov":1.8,"fg":37.2,"fg3":33.3,"ft":86.0,"salary":34044642}}'::jsonb),
  ('29:kobe bufkin', 29, 'Kobe Bufkin', 'Kobe Bufkin', 'SG', '{"is_starter":false,"roster_order":7,"player":{"name":"Kobe Bufkin","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":16,"pts":2.9,"reb":0.8,"ast":0.6,"stl":0.1,"blk":0.2,"tov":0.3,"fg":30.0,"fg3":19.2,"ft":91.7,"salary":2449421}}'::jsonb),
  ('29:deandre jordan', 29, 'DeAndre Jordan', 'DeAndre Jordan', 'C', '{"is_starter":false,"roster_order":8,"player":{"name":"DeAndre Jordan","pos":"C","contract_type":null,"stats_season":"2025-26","gp":12,"pts":4.4,"reb":6.3,"ast":0.9,"stl":0.3,"blk":0.8,"tov":0.8,"fg":65.6,"fg3":0.0,"ft":64.7,"salary":3876529}}'::jsonb),
  ('29:aj johnson', 29, 'AJ Johnson', 'AJ Johnson', 'SG', '{"is_starter":false,"roster_order":9,"player":{"name":"AJ Johnson","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":48,"pts":3.3,"reb":1.1,"ast":1.0,"stl":0.2,"blk":0.1,"tov":0.6,"fg":32.4,"fg3":21.1,"ft":85.0,"salary":3237120}}'::jsonb),
  ('29:malik dia', 29, 'Malik Dia', 'Malik Dia', 'PF', '{"is_starter":false,"roster_order":10,"player":{"name":"Malik Dia","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('29:trendon watford', 29, 'Trendon Watford', 'Trendon Watford', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Trendon Watford","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":53,"pts":6.5,"reb":3.3,"ast":2.5,"stl":0.3,"blk":0.4,"tov":1.2,"fg":51.5,"fg3":20.0,"ft":77.9,"salary":2449421}}'::jsonb),
  ('29:bennedict mathurin', 29, 'Bennedict Mathurin', 'Bennedict Mathurin', 'SF', '{"is_starter":false,"roster_order":12,"player":{"name":"Bennedict Mathurin","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":54,"pts":17.6,"reb":5.4,"ast":2.4,"stl":0.8,"blk":0.2,"tov":2.2,"fg":43.0,"fg3":31.5,"ft":86.9,"salary":7804878}}'::jsonb),
  ('29:jaron pierre jr.', 29, 'Jaron Pierre Jr.', 'Jaron Pierre Jr.', 'SG', '{"is_starter":false,"roster_order":13,"player":{"name":"Jaron Pierre Jr.","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('29:bryce mcgowens', 29, 'Bryce McGowens', 'Bryce McGowens', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"Bryce McGowens","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":42,"pts":8.1,"reb":2.1,"ast":1.5,"stl":0.6,"blk":0.2,"tov":0.4,"fg":48.1,"fg3":40.9,"ft":77.9,"salary":2584539}}'::jsonb),
  ('29:karlo matković', 29, 'Karlo Matković', 'Karlo Matković', 'C', '{"is_starter":false,"roster_order":15,"player":{"name":"Karlo Matković","pos":"C","contract_type":null,"stats_season":"2025-26","gp":62,"pts":5.7,"reb":3.7,"ast":0.8,"stl":0.4,"blk":0.9,"tov":0.5,"fg":60.4,"fg3":42.2,"ft":73.2,"salary":2296271}}'::jsonb),
  ('29:yves missi', 29, 'Yves Missi', 'Yves Missi', 'C', '{"is_starter":false,"roster_order":16,"player":{"name":"Yves Missi","pos":"C","contract_type":null,"stats_season":"2025-26","gp":66,"pts":5.7,"reb":5.8,"ast":1.3,"stl":0.3,"blk":1.5,"tov":0.8,"fg":54.4,"fg3":0.0,"ft":55.9,"salary":3512760}}'::jsonb),
  ('29:caleb houstan', 29, 'Caleb Houstan', 'Caleb Houstan', 'SF', '{"is_starter":false,"roster_order":17,"player":{"name":"Caleb Houstan","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":18,"pts":2.3,"reb":0.6,"ast":0.2,"stl":0.1,"blk":0.1,"tov":0.2,"fg":53.8,"fg3":52.4,"ft":100.0,"salary":2625627}}'::jsonb),
  ('29:christian koloko', 29, 'Christian Koloko', 'Christian Koloko', 'C', '{"is_starter":false,"roster_order":18,"player":{"name":"Christian Koloko","pos":"C","contract_type":null,"stats_season":"2025-26","gp":27,"pts":2.7,"reb":3.0,"ast":0.7,"stl":0.5,"blk":0.9,"tov":0.6,"fg":41.9,"fg3":11.1,"ft":66.7,"salary":2625627}}'::jsonb),
  ('29:saddiq bey', 29, 'Saddiq Bey', 'Saddiq Bey', 'SF', '{"is_starter":false,"roster_order":19,"player":{"name":"Saddiq Bey","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":72,"pts":17.7,"reb":5.6,"ast":2.5,"stl":0.9,"blk":0.1,"tov":0.9,"fg":45.1,"fg3":36.7,"ft":84.1,"salary":6440678}}'::jsonb),
  ('30:de''aaron fox', 30, 'De''Aaron Fox', 'De''Aaron Fox', 'PG', '{"is_starter":true,"roster_order":0,"player":{"name":"De''Aaron Fox","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":72,"pts":18.6,"reb":3.8,"ast":6.2,"stl":1.2,"blk":0.3,"tov":2.3,"fg":48.6,"fg3":33.2,"ft":76.0,"salary":49400000}}'::jsonb),
  ('30:stephon castle', 30, 'Stephon Castle', 'Stephon Castle', 'SG', '{"is_starter":true,"roster_order":1,"player":{"name":"Stephon Castle","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":68,"pts":16.7,"reb":5.3,"ast":7.4,"stl":1.1,"blk":0.3,"tov":3.2,"fg":47.1,"fg3":33.2,"ft":73.4,"salary":10000000}}'::jsonb),
  ('30:devin vassell', 30, 'Devin Vassell', 'Devin Vassell', 'SF', '{"is_starter":true,"roster_order":2,"player":{"name":"Devin Vassell","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":67,"pts":13.9,"reb":4.0,"ast":2.5,"stl":0.9,"blk":0.4,"tov":0.9,"fg":43.7,"fg3":38.4,"ft":81.5,"salary":27000000}}'::jsonb),
  ('30:julian champagnie', 30, 'Julian Champagnie', 'Julian Champagnie', 'PF', '{"is_starter":true,"roster_order":3,"player":{"name":"Julian Champagnie","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":82,"pts":11.1,"reb":5.8,"ast":1.5,"stl":0.8,"blk":0.5,"tov":0.8,"fg":43.7,"fg3":38.1,"ft":84.4,"salary":15300000}}'::jsonb),
  ('30:victor wembanyama', 30, 'Victor Wembanyama', 'Victor Wembanyama', 'C', '{"is_starter":true,"roster_order":4,"player":{"name":"Victor Wembanyama","pos":"C","contract_type":null,"stats_season":"2025-26","gp":64,"pts":25.0,"reb":11.5,"ast":3.1,"stl":1.0,"blk":3.1,"tov":2.4,"fg":51.2,"fg3":34.9,"ft":82.7,"salary":16800000}}'::jsonb),
  ('30:jordan mclaughlin', 30, 'Jordan McLaughlin', 'Jordan McLaughlin', 'PG', '{"is_starter":false,"roster_order":5,"player":{"name":"Jordan McLaughlin","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":44,"pts":2.0,"reb":0.7,"ast":0.9,"stl":0.5,"blk":0.0,"tov":0.3,"fg":41.8,"fg3":42.5,"ft":85.7,"salary":2449421}}'::jsonb),
  ('30:dylan harper', 30, 'Dylan Harper', 'Dylan Harper', 'SG', '{"is_starter":false,"roster_order":6,"player":{"name":"Dylan Harper","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":69,"pts":11.8,"reb":3.4,"ast":3.9,"stl":0.8,"blk":0.3,"tov":1.4,"fg":50.5,"fg3":34.3,"ft":75.6,"salary":12900000}}'::jsonb),
  ('30:keldon johnson', 30, 'Keldon Johnson', 'Keldon Johnson', 'SF', '{"is_starter":false,"roster_order":7,"player":{"name":"Keldon Johnson","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":82,"pts":13.2,"reb":5.4,"ast":1.4,"stl":0.6,"blk":0.1,"tov":0.9,"fg":51.9,"fg3":36.3,"ft":79.4,"salary":17500000}}'::jsonb),
  ('30:taelon peter', 30, 'Taelon Peter', 'Taelon Peter', 'SG', '{"is_starter":false,"roster_order":8,"player":{"name":"Taelon Peter","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":38,"pts":4.5,"reb":1.6,"ast":1.1,"stl":0.7,"blk":0.1,"tov":0.7,"fg":38.0,"fg3":32.8,"ft":62.5,"salary":2185116}}'::jsonb),
  ('30:luke kornet', 30, 'Luke Kornet', 'Luke Kornet', 'C', '{"is_starter":false,"roster_order":9,"player":{"name":"Luke Kornet","pos":"C","contract_type":null,"stats_season":"2025-26","gp":68,"pts":6.5,"reb":6.1,"ast":1.9,"stl":0.5,"blk":1.0,"tov":0.4,"fg":64.3,"fg3":0.0,"ft":82.5,"salary":10400000}}'::jsonb),
  ('30:tarris reed jr.', 30, 'Tarris Reed Jr.', 'Tarris Reed Jr.', 'C', '{"is_starter":false,"roster_order":10,"player":{"name":"Tarris Reed Jr.","pos":"C","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3000000}}'::jsonb),
  ('30:carter bryant', 30, 'Carter Bryant', 'Carter Bryant', 'SF', '{"is_starter":false,"roster_order":11,"player":{"name":"Carter Bryant","pos":"SF","contract_type":null,"stats_season":"2025-26","gp":71,"pts":4.2,"reb":2.5,"ast":0.7,"stl":0.2,"blk":0.3,"tov":0.5,"fg":40.8,"fg3":33.5,"ft":71.4,"salary":5100000}}'::jsonb),
  ('30:jayden quaintance', 30, 'Jayden Quaintance', 'Jayden Quaintance', 'PF', '{"is_starter":false,"roster_order":12,"player":{"name":"Jayden Quaintance","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":3900000}}'::jsonb),
  ('30:tobias harris', 30, 'Tobias Harris', 'Tobias Harris', 'PF', '{"is_starter":false,"roster_order":13,"player":{"name":"Tobias Harris","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":63,"pts":13.3,"reb":5.1,"ast":2.5,"stl":0.9,"blk":0.4,"tov":1.0,"fg":46.9,"fg3":36.8,"ft":86.6,"salary":15000000}}'::jsonb),
  ('30:david jones garcia', 30, 'David Jones Garcia', 'David Jones Garcia', 'SG', '{"is_starter":false,"roster_order":14,"player":{"name":"David Jones Garcia","pos":"SG","contract_type":null,"stats_season":"2025-26","gp":11,"pts":2.9,"reb":1.2,"ast":1.6,"stl":0.5,"blk":0.1,"tov":0.5,"fg":52.0,"fg3":60.0,"ft":50.0,"salary":null}}'::jsonb),
  ('30:harrison barnes', 30, 'Harrison Barnes', 'Harrison Barnes', 'PF', '{"is_starter":false,"roster_order":15,"player":{"name":"Harrison Barnes","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":77,"pts":9.9,"reb":2.8,"ast":1.9,"stl":0.6,"blk":0.2,"tov":0.8,"fg":45.6,"fg3":38.8,"ft":82.9,"salary":8000000}}'::jsonb),
  ('30:maliq brown', 30, 'Maliq Brown', 'Maliq Brown', 'PF', '{"is_starter":false,"roster_order":16,"player":{"name":"Maliq Brown","pos":"PF","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('30:ja''kobi gillespie', 30, 'Ja''Kobi Gillespie', 'Ja''Kobi Gillespie', 'PG', '{"is_starter":false,"roster_order":17,"player":{"name":"Ja''Kobi Gillespie","pos":"PG","contract_type":null,"stats_season":"2025-26","gp":null,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"salary":null}}'::jsonb),
  ('30:emanuel miller', 30, 'Emanuel Miller', 'Emanuel Miller', 'F', '{"is_starter":false,"roster_order":18,"player":{"name":"Emanuel Miller","pos":"F","contract_type":null,"stats_season":"2025-26","gp":5,"pts":3.0,"reb":0.6,"ast":0.8,"stl":0.4,"blk":0.0,"tov":0.0,"fg":46.2,"fg3":33.3,"ft":50.0,"salary":0}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    metadata = EXCLUDED.metadata,
    is_active = true,
    updated_at = now();

INSERT INTO public.nba_draft_picks
  (team_id, pick_order, year, round, original_owner, is_swap, protection, details) VALUES
  (1, 0, 2027, 1, 'BOS', false, NULL, 'Own'),
  (1, 1, 2028, 1, 'BOS/SAN', true, 'Protected 1', '1 Own; 2-30 Own or SAN via SAN swap for BOS; BOS then has a complex swap right with PHL'),
  (1, 2, 2028, 1, 'LAC/PHI', true, 'LAC 17-30; PHI 1-8', 'LAC 17-30 or, by swap from BOS, more favorable of (i) less favorable of BOS and SAN and (ii) more favorable of PHL 1-8 and LAC 1-16; if PHL 9-30, then LAC 1-16. Least favorable of all goes to PHL.'),
  (1, 3, 2028, 2, 'BOS/SAN/NYK', false, '31-45 to SAN if BOS 1', '31-45 to SAN if BOS picks 1st in 2028; 46-60 to NYK (via ORL to PHX)'),
  (1, 4, 2028, 2, 'GSW/MIL/OKC', false, NULL, 'Most favorable of GSW, MIL and OKC (via GSW to POR to WAS to PHL; via MIL to BRK to HOU to OKC to PHL; via OKC to PHL)'),
  (1, 5, 2030, 1, 'BOS', false, NULL, 'Own'),
  (1, 6, 2030, 2, 'CHA', false, 'Protected 31-55', 'CHA 56-60'),
  (1, 7, 2030, 2, 'PHX/POR/WAS', false, NULL, 'Most favorable of PHX, POR and WAS (via PHX and POR to WAS to PHL)'),
  (1, 8, 2031, 1, 'BOS', false, NULL, 'Own'),
  (1, 9, 2031, 1, 'PHI', false, NULL, 'PHI'),
  (1, 10, 2031, 2, 'BOS/CLE', true, 'HOU 56-60', 'Less favorable of BOS and CLE then other to UTH (via CLE to ATL to BOS); HOU 56-60'),
  (1, 11, 2031, 2, 'HOU', false, 'Protected 56-60', 'HOU 56-60'),
  (1, 12, 2032, 1, 'BOS', false, 'Frozen through 2027-28', 'Frozen (through 2027-28)'),
  (1, 13, 2032, 2, 'BOS', false, NULL, 'Own'),
  (1, 14, 2033, 1, 'BOS', false, NULL, 'Own'),
  (1, 15, 2033, 2, 'BOS', false, NULL, 'Own'),
  (2, 0, 2027, 1, 'BRK/HOU', true, NULL, 'Own or HOU (via HOU swap for BRK)'),
  (2, 1, 2027, 1, 'NYK', false, NULL, 'NYK'),
  (2, 2, 2027, 2, 'BRK/DAL', true, NULL, 'More favorable of BRK and DAL to WAS, then other to MIL (via DAL to BRK to DET to MIL; via DET to WAS)'),
  (2, 3, 2028, 1, 'BRK/PHI/PHX/NYK', true, 'PHL 9-30 conditional', 'If (I) PHL 9-30 is third most favorable and (II) NYK is most or second most favorable of BRK, PHL 9-30, PHX and NYK, then most and third most favorable to BRK; or most/two most favorable to BRK in all other scenarios; least favorable of BRK, PHX and NYK to NYK if PHL 9-30 is less favorable than BRK and PHX; or second most favorable of BRK, PHX and NYK to NYK in all other scenarios. More favorable of (I) WAS and (II) least/less favorable of BRK, PHL 9-30 and PHX to WAS then least favorable of all to PHX (WAS can then swap with MIL).'),
  (2, 4, 2028, 2, 'BRK', false, NULL, 'Own'),
  (2, 5, 2028, 2, 'ATL', false, NULL, 'ATL (via GOS)'),
  (2, 6, 2028, 2, 'MEM', false, NULL, 'MEM (via PHX)'),
  (2, 7, 2028, 2, 'PHL', false, NULL, 'PHL 1-8 in 2028'),
  (2, 8, 2029, 1, 'BRK', false, NULL, 'Own'),
  (2, 9, 2029, 1, 'DAL/PHX/HOU', true, NULL, 'Least favorable of DAL, PHX and HOU (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX)'),
  (2, 10, 2029, 1, 'NYK', false, NULL, 'NYK'),
  (2, 11, 2029, 2, 'BRK', false, NULL, 'Own'),
  (2, 12, 2029, 2, 'DAL', false, NULL, 'DAL'),
  (2, 13, 2029, 2, 'GOS', false, NULL, 'GOS'),
  (2, 14, 2029, 2, 'MEM', false, NULL, 'MEM (via PHX)'),
  (2, 15, 2030, 1, 'BRK', false, NULL, 'Own'),
  (2, 16, 2030, 2, 'BRK', false, NULL, 'Own'),
  (2, 17, 2030, 2, 'BOS', false, NULL, 'BOS (via HOU)'),
  (2, 18, 2030, 2, 'DAL', false, NULL, 'DAL (via BOS to MEM)'),
  (2, 19, 2030, 2, 'LAL', false, NULL, 'LAL'),
  (2, 20, 2031, 1, 'BRK', false, NULL, 'Own'),
  (2, 21, 2031, 1, 'NYK', false, NULL, 'NYK'),
  (2, 22, 2031, 2, 'BRK', false, NULL, 'Own'),
  (2, 23, 2031, 2, 'LAL', false, NULL, 'LAL'),
  (2, 24, 2032, 1, 'BRK', false, NULL, 'Own'),
  (2, 25, 2032, 1, 'DEN', false, NULL, 'DEN'),
  (2, 26, 2032, 2, 'BRK', false, NULL, 'Own'),
  (2, 27, 2032, 2, 'DEN', false, NULL, 'DEN'),
  (2, 28, 2032, 2, 'MIA', false, NULL, 'MIA'),
  (2, 29, 2032, 2, 'TOR', false, NULL, 'TOR'),
  (2, 30, 2033, 1, 'BRK', false, NULL, 'Own'),
  (2, 31, 2033, 2, 'BRK', false, NULL, 'Own'),
  (3, 0, 2027, 2, 'NYK', false, NULL, 'Own'),
  (3, 1, 2027, 2, 'OKC/HOU/IND/MIA', true, NULL, 'Third most favorable of OKC, HOU, IND and MIA (via HOU to DET to OKC)'),
  (3, 2, 2027, 2, 'WAS', false, NULL, 'WAS (via HOU to OKC)'),
  (3, 3, 2028, 1, 'NYK/BRK/PHX', true, 'PHL 9-30 conditional', 'Least favorable of NYK, BRK and PHX if NYK and / or if PHL 9-30 is less favorable than BRK and PHX; or second most favorable of NYK, BRK and PHX in all other scenarios; If (I) PHL 9-30 is third most favorable and (II) NYK is most or second most favorable of NYK, BRK, PHL 9-30 and PHX, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios (via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)'),
  (3, 4, 2028, 2, 'BOS', false, 'Protected 1-45', 'BOS 46-60 (via ORL to PHX; Own to DET)'),
  (3, 5, 2028, 2, 'IND/PHX', true, NULL, 'Less favorable of IND and PHX (via IND)'),
  (3, 6, 2029, 2, 'PHX', false, NULL, 'PHX (Two most favorable of NYK, DET and MIL to DET then other to CHI via MIL to BRK to DET; via NYK to DET; via DET to MEM; via MEM to DET; via SAC to CHI)'),
  (3, 7, 2029, 2, 'SAC', false, NULL, 'SAC (via WAS to HOU)'),
  (3, 8, 2030, 1, 'NYK', false, NULL, 'Own'),
  (3, 9, 2030, 2, 'PHL', false, NULL, 'PHL (via DAL; Own to ATL via POR)'),
  (3, 10, 2032, 1, 'NYK', false, NULL, 'Own'),
  (3, 11, 2032, 2, 'NYK', false, NULL, 'Own'),
  (3, 12, 2032, 2, 'DAL', false, NULL, 'DAL'),
  (3, 13, 2033, 1, 'NYK', false, NULL, 'Own'),
  (3, 14, 2033, 2, 'NYK', false, NULL, 'Own'),
  (3, 15, 2033, 2, 'PHX', false, NULL, 'PHX'),
  (4, 0, 2027, 1, 'PHI', false, NULL, 'Own'),
  (4, 1, 2027, 2, 'PHI/GOS/PHX/OKC/HOU/IND/MIA', true, NULL, 'Most favorable of (I) PHI, (II) more favorable of GOS and PHX, and (III) most favorable of OKC, HOU, IND and MIA; second most favorable of these to WAS (via WAS; via HOU to DET to OKC; via IND and MIA to OKC; via OKC to PHL)'),
  (4, 2, 2027, 2, 'PHI/GOS/PHX/OKC/HOU/IND/MIA', true, NULL, 'Least favorable of (I) PHI, (II) more favorable of GOS and PHX, and (III) most favorable of OKC, HOU, IND and MIA; second most favorable of these to WAS (via WAS; via HOU to DET to OKC; via IND and MIA to OKC; via OKC to PHL)'),
  (4, 3, 2028, 1, 'PHI/LAC/BOS/SAN', true, 'Protected 1-8', '1-8 Own if LAC 17-30; or [via swap from BOS] least favorable of (I) PHL 1-8, LAC 1-16, BOS and SAN or (II) LAC 1-16, BOS and SAN; more favorable of (I) more favorable of PHL 1-8 and LAC 1-16 [or (i) LAC 1-16 if PHL 9-30] and (II) less favorable of BOS and SAN to BOS (via SAN swap for BOS; via BOS swap of BOS or SAN for PHL or LAC)'),
  (4, 4, 2028, 2, 'PHI', false, 'Conditional', 'Own if PHL 9-30 in 2028; To BRK if PHL 1-8 in 2028'),
  (4, 5, 2028, 2, 'DET', false, 'Protected 1-55', 'DET 56-60'),
  (4, 6, 2028, 2, 'GOS/MIL/OKC', true, NULL, 'Second most favorable of GOS, MIL and OKC (via GOS to POR to WAS; via MIL to BRK to HOU to OKC; most favorable to BOS)'),
  (4, 7, 2028, 2, 'GOS/MIL/OKC', true, NULL, 'Least favorable of GOS, MIL and OKC (via GOS to POR to WAS; via MIL to BRK to HOU to OKC; most favorable to BOS)'),
  (4, 8, 2029, 1, 'PHI/LAC', true, 'Protected 1-3 (LAC)', 'Own or swap for LAC 4-30'),
  (4, 9, 2029, 2, 'PHI', false, NULL, 'Own'),
  (4, 10, 2030, 1, 'PHI', false, NULL, 'Own'),
  (4, 11, 2030, 2, 'PHX/POR/WAS', true, NULL, 'Less favorable of (i) more favorable of PHX and POR and (ii) WAS (via PHX and POR to WAS; Own to NYK via DAL)'),
  (4, 12, 2031, 2, 'PHI', false, NULL, 'Own (Own 1st to BOS)'),
  (4, 13, 2032, 1, 'PHI', false, NULL, 'Own'),
  (4, 14, 2032, 2, 'PHI/MEM/UTH', true, NULL, 'Less favorable of PHL and MEM; less favorable of (I) more favorable of PHL and MEM and (II) UTH to WAS then most favorable of all to MEM (via MEM swap for PHL; via UTH to WAS; via MEM swap of MEM or PHL for UTH)'),
  (4, 15, 2033, 1, 'PHI', false, NULL, 'Own'),
  (4, 16, 2033, 2, 'PHI', false, NULL, 'Own'),
  (5, 0, 2027, 1, 'TOR/LAC/DEN/OKC', true, NULL, 'Least / less favorable of TOR, LAC, DEN 6-30 and OKC; more favorable of (I) TOR and (II) least / less favorable of LAC, DEN 6-30 and OKC to LAC (via OKC swap of OKC or DEN for LAC; via LAC swap of LAC, DEN or OKC for TOR)'),
  (5, 1, 2027, 2, 'TOR', false, NULL, 'Own'),
  (5, 2, 2028, 1, 'TOR', false, NULL, 'Own'),
  (5, 3, 2028, 2, 'TOR', false, NULL, 'Own'),
  (5, 4, 2029, 1, 'TOR', false, NULL, 'Own'),
  (5, 5, 2029, 2, 'TOR', false, NULL, 'Own'),
  (5, 6, 2030, 1, 'TOR', false, NULL, 'Own'),
  (5, 7, 2032, 1, 'TOR', false, NULL, 'Own'),
  (6, 0, 2027, 1, 'CHI', false, NULL, 'Own'),
  (6, 1, 2027, 2, 'CLE', false, NULL, 'CLE (via ATL to MIN)'),
  (6, 2, 2028, 1, 'CHI', false, NULL, 'Own'),
  (6, 3, 2028, 2, 'CHI/IND/PHX', true, NULL, 'Most favorable of CHI, IND and PHX; less favorable of (I) CHI and (II) more favorable of IND and PHX to IND (via PHX to IND; via CHI swap for IND or PHX)'),
  (6, 4, 2029, 1, 'CHI', false, NULL, 'Own'),
  (6, 5, 2029, 2, 'CHI', false, NULL, 'Own'),
  (6, 6, 2029, 2, 'DET/MIL/NYK', true, NULL, 'Least favorable of DET, MIL and NYK (via MIL to BRK to DET; via NYK to DET; via SAC to CHI)'),
  (6, 7, 2030, 1, 'CHI', false, NULL, 'Own'),
  (6, 8, 2030, 2, 'CHI/IND', true, NULL, 'Own or swap for IND'),
  (6, 9, 2031, 1, 'CHI', false, NULL, 'Own'),
  (6, 10, 2031, 2, 'CHI', false, NULL, 'Own'),
  (6, 11, 2031, 2, 'DEN', false, NULL, 'DEN (via PHX to CHA)'),
  (6, 12, 2031, 2, 'MIN/GOS', true, NULL, 'More favorable of MIN and GOS (via MIN swap for GOS)'),
  (6, 13, 2031, 2, 'NYK', false, NULL, 'NYK (via CHA)'),
  (6, 14, 2032, 1, 'CHI', false, NULL, 'Own'),
  (6, 15, 2032, 2, 'CHI', false, NULL, 'Own'),
  (6, 16, 2032, 2, 'PHX/HOU', true, NULL, 'More favorable of PHX and HOU (via PHX to MIN)'),
  (6, 17, 2033, 1, 'CHI', false, NULL, 'Own'),
  (6, 18, 2033, 2, 'CHI', false, NULL, 'Own'),
  (8, 0, 2027, 1, 'DET', false, NULL, 'Own'),
  (8, 1, 2027, 2, 'DET', false, NULL, 'Own'),
  (8, 2, 2028, 1, 'DET', false, NULL, 'Own'),
  (8, 3, 2028, 2, 'DET', false, 'Protected 31-55', '31-55 Own; 56-60 to PHL'),
  (8, 4, 2028, 2, 'CHA/LAC', true, NULL, 'Less favorable of CHA and LAC (via CHA to DAL; least / less favorable of these to UTH)'),
  (8, 5, 2028, 2, 'NYK', false, NULL, 'NYK (least / less favorable of these to UTH)'),
  (8, 6, 2028, 2, 'MIA', false, 'Conditional', 'MIA if DAL conveys 1st round pick to CHA in 2027 (via SAN to DAL; least / less favorable of these to UTH)'),
  (8, 7, 2029, 1, 'DET', false, NULL, 'Own'),
  (8, 8, 2029, 2, 'DET/MIL/NYK', true, NULL, 'Most favorable of DET, MIL and NYK (via MIL to BRK to DET; via NYK to DET; via SAC to CHI)'),
  (8, 9, 2029, 2, 'DET/MIL/NYK', true, NULL, 'Second most favorable of DET, MIL and NYK then other to CHI (via MIL to BRK to DET; via NYK to DET; via DET to MEM; via MEM to DET; via SAC to CHI)'),
  (8, 10, 2030, 1, 'DET', false, NULL, 'Own'),
  (8, 11, 2030, 2, 'DET', false, NULL, 'Own'),
  (8, 12, 2031, 1, 'DET', false, NULL, 'Own'),
  (8, 13, 2031, 2, 'DAL', false, NULL, 'DAL (via PHL to DET to MEM)'),
  (8, 14, 2031, 2, 'GOS/MIN', true, NULL, 'Less favorable of GOS and MIN (via MIN swap for GOS)'),
  (8, 15, 2032, 1, 'DET', false, NULL, 'Own'),
  (8, 16, 2032, 2, 'DET', false, NULL, 'Own (via MEM)'),
  (8, 17, 2033, 1, 'DET', false, NULL, 'Own'),
  (8, 18, 2033, 2, 'DET', false, 'Heavily protected', 'Own (DET heavily protected and unspecified 2nd round pick to LAC)'),
  (9, 0, 2027, 1, 'IND', false, NULL, 'Own'),
  (9, 1, 2027, 2, 'UTH', false, NULL, 'UTH (via CLE)'),
  (9, 2, 2028, 1, 'IND', false, NULL, 'Own'),
  (9, 3, 2028, 2, 'IND/PHX/CHI', true, NULL, 'Less favorable of (i) more favorable of IND and PHX and (ii) CHI then most favorable of all to CHI; less favorable of IND and PHX to NYK (via PHX to IND; via CHI swap for IND or PHX)'),
  (9, 4, 2029, 2, 'IND/WAS', true, NULL, 'More favorable of IND and WAS then other to POR (via IND to NYK)'),
  (9, 5, 2030, 1, 'IND', false, NULL, 'Own'),
  (9, 6, 2030, 2, 'IND/CHI', true, NULL, 'Own or CHI (via CHI swap for IND)'),
  (9, 7, 2031, 1, 'IND', false, NULL, 'Own'),
  (9, 8, 2031, 2, 'IND/MIA/MEM', true, NULL, 'Least favorable of IND, MIA and MEM; more favorable of IND and MIA to WAS; more favorable of (i) MEM and (ii) less favorable of IND and MIA to MEM (via MIA swap for IND; via UTH to WAS; via MEM swap for IND or MIA)'),
  (9, 9, 2032, 1, 'IND', false, NULL, 'Own'),
  (9, 10, 2032, 2, 'IND', false, NULL, 'Own'),
  (9, 11, 2033, 1, 'IND', false, NULL, 'Own'),
  (9, 12, 2033, 2, 'IND', false, NULL, 'Own'),
  (10, 0, 2027, 2, 'MIL', false, NULL, 'Own (via PHL to DET)'),
  (10, 1, 2027, 2, 'BRK/DAL', true, NULL, 'Less favorable of BRK and DAL (via DAL to BRK to DET to MIL)'),
  (10, 2, 2028, 1, 'MIL/POR/WAS/BRK/PHL/PHX', true, 'PHL 9-30 conditional', 'Less favorable of (I) less favorable of MIL and POR and (II) more favorable of (a) WAS and (b) least / less favorable of BRK, PHL 9-30 and PHX then more favorable of (I) and (II) to WAS (via POR swap for MIL; via BRK swap of BRK or PHL for PHX; via WAS swap for PHX, BRK or PHL; via WAS swap of WAS, BRK, PHL or PHX for MIL or POR)'),
  (10, 3, 2030, 1, 'MIL/POR/MIA', true, NULL, 'More favorable of (I) less favorable MIL and POR and (II) MIA then least favorable of all to MIA; more favorable of MIL and POR to POR (via POR swap for MIL; via MIL swap of MIL or POR for MIA)'),
  (10, 4, 2031, 1, 'MIL', false, NULL, 'Own'),
  (10, 5, 2031, 1, 'MIA', false, NULL, 'MIA'),
  (10, 6, 2032, 1, 'MIL', false, NULL, 'Own'),
  (10, 7, 2033, 1, 'MIL', false, NULL, 'Own'),
  (10, 8, 2033, 1, 'MIA', false, NULL, 'MIA'),
  (10, 9, 2033, 2, 'MIL', false, NULL, 'Own'),
  (10, 10, 2033, 2, 'MIA', false, NULL, 'MIA'),
  (11, 0, 2027, 1, 'MIA', false, 'Protected 1-14', '1-14 Own; 15-30 to CHA'),
  (11, 1, 2027, 2, 'MIA/OKC/HOU/IND/SAN', true, NULL, 'Least favorable of MIA, OKC, HOU, IND and SAN; most favorable of MIA, OKC, HOU and IND to PHL; second most favorable to NOP and third most favorable to NYK; more favorable of (I) SAN and (II) least favorable of MIA, OKC, HOU and IND to SAN (via MIA and IND to OKC to UTH to SAN to MIA; via HOU to DET to OKC to NYK to NOP; via OKC to PHL)'),
  (11, 2, 2028, 1, 'MIA', false, 'Conditional', 'To CHA if not already settled; Own if settled in 2027'),
  (11, 3, 2029, 1, 'MIA', false, NULL, 'Own'),
  (11, 4, 2030, 1, 'MIA/MIL/POR', true, NULL, 'Least favorable of MIA, MIL and POR; more favorable of (I) MIA and (ii) less favorable MIL and POR to MIL (via POR swap for MIL; via MIL swap of MIL or POR for MIA)'),
  (11, 5, 2032, 1, 'MIA', false, NULL, 'Own'),
  (13, 0, 2027, 1, 'CHA', false, NULL, 'Own'),
  (13, 1, 2027, 1, 'DAL', false, 'Protected 1-2', 'DAL 3-30'),
  (13, 2, 2027, 1, 'MIA', false, 'Protected 1-14', 'MIA 15-30'),
  (13, 3, 2027, 2, 'MEM', false, NULL, 'MEM (via LAC to HOU)'),
  (13, 4, 2027, 2, 'POR/NOP', true, NULL, 'More favorable of POR and NOP (via POR)'),
  (13, 5, 2028, 1, 'CHA/MIN', true, NULL, 'Own or swap for MIN'),
  (13, 6, 2028, 1, 'MIA', false, 'Conditional', 'MIA if not already settled'),
  (13, 7, 2028, 2, 'CHA/LAC', true, NULL, 'More favorable of CHA and LAC then other to DET [DET may convey to UTH] (via CHA to DAL)'),
  (13, 8, 2028, 2, 'HOU', false, NULL, 'HOU'),
  (13, 9, 2028, 2, 'MIA', false, 'Conditional', 'MIA if DAL does not convey 1st round pick to CHA in 2027 (via SAN to DAL)'),
  (13, 10, 2028, 2, 'ORL', false, NULL, 'ORL'),
  (13, 11, 2029, 1, 'CHA', false, NULL, 'Own'),
  (13, 12, 2029, 1, 'UTH/CLE/MIN', true, 'Protected 1-5 (MIN)', 'Least / less favorable of UTH, CLE and MIN 6-30 (via UTH to PHX); CHA will also have a complex swap right with MIN and PHX will receive a least favorable pick'),
  (13, 13, 2029, 2, 'CHA', false, NULL, 'Own'),
  (13, 14, 2029, 2, 'ATL/MIA', true, NULL, 'More favorable of ATL and MIA (via OKC)'),
  (13, 15, 2029, 2, 'DEN', false, 'Conditional', 'DEN if DEN has conveyed a first potential 1st round pick to OKC by 2029'),
  (13, 16, 2029, 2, 'MIN', false, 'Conditional', 'MIN if MIN conveys 1st round pick to UTH in 2029'),
  (13, 17, 2030, 1, 'CHA', true, NULL, 'Own; CHA will have a complex swap right with MIN, receiving MIN, SAN or DAL'),
  (13, 18, 2030, 2, 'CHA', false, 'Protected 31-55', '31-55 Own; 56-60 to BOS'),
  (13, 19, 2030, 2, 'UTH/LAC', true, NULL, 'More favorable of UTH and LAC (via UTH)'),
  (13, 20, 2031, 1, 'CHA', false, NULL, 'Own'),
  (13, 21, 2031, 2, 'CHA', false, NULL, 'Own'),
  (13, 22, 2031, 2, 'MIL', false, NULL, 'MIL'),
  (13, 23, 2031, 2, 'PHX', false, NULL, 'PHX'),
  (13, 24, 2032, 1, 'CHA', false, NULL, 'Own'),
  (13, 25, 2032, 2, 'CHA', false, NULL, 'Own'),
  (13, 26, 2032, 2, 'MIL', false, NULL, 'MIL'),
  (13, 27, 2032, 2, 'MIN', false, NULL, 'MIN'),
  (13, 28, 2033, 1, 'CHA', false, NULL, 'Own'),
  (13, 29, 2033, 1, 'MIN', false, NULL, 'MIN'),
  (13, 30, 2033, 1, 'PHX', false, NULL, 'PHX'),
  (13, 31, 2033, 2, 'CHA', false, NULL, 'Own'),
  (13, 32, 2033, 2, 'HOU', false, NULL, 'HOU'),
  (13, 33, 2033, 2, 'MIN', false, NULL, 'MIN'),
  (15, 0, 2027, 1, 'WAS', false, 'Protected 1', 'Own (cannot be 1)'),
  (15, 1, 2027, 2, 'BRK/DAL', true, NULL, 'More favorable of BRK and DAL (via DAL to BRK to DET to WAS)'),
  (15, 2, 2027, 2, 'GOS/PHX', true, NULL, 'Less favorable of GOS and PHX'),
  (15, 3, 2027, 2, 'PHL/GOS/PHX/OKC/HOU/IND/MIA', true, NULL, 'Second most favorable of (i) PHL (via LAC), (ii) more favorable of GOS and PHX (via WAS to LAC) and (iii) most favorable of OKC, HOU, IND and MIA (via HOU to DET to OKC to LAC; via IND and MIA to OKC to LAC)'),
  (15, 4, 2028, 1, 'WAS/BRK/PHL/PHX/MIL/POR', true, 'PHL 9-30 conditional', 'More favorable of (I) more favorable of (a) WAS and (b) least / less favorable of BRK, PHL 9-30 and PHX and (II) less favorable of MIL and POR then less favorable of (I) and (II) to MIL; least favorable of WAS, PHL 9-30, BRK and PHX to PHX (via POR swap for MIL; via BRK swap of BRK or PHL for PHX; via WAS swap for PHX, BRK or PHL; via WAS swap of WAS, BRK, PHL or PHX for MIL or POR)'),
  (15, 5, 2028, 2, 'WAS/LAL', true, NULL, 'Less favorable of WAS and LAL then other to ORL (via WAS to LAL to ORL; via LAL to WAS)'),
  (15, 6, 2028, 2, 'DEN', false, 'Protected 1-33', 'DEN 34-60 (via SAN to SAC)'),
  (15, 7, 2029, 1, 'WAS', false, NULL, 'Own'),
  (15, 8, 2029, 1, 'POR/BOS/MIL', true, NULL, 'Second most favorable of POR, BOS and MIL (via BOS to POR; via MIL to POR; via POR to WAS)'),
  (15, 9, 2030, 1, 'WAS/PHX/MEM', true, NULL, 'More favorable of WAS and PHX; more favorable of (I) MEM and (II) less favorable of WAS and PHX to MEM then least favorable of all to PHX (via WAS swap for PHX; via MEM swap for WAS or PHX)'),
  (15, 10, 2030, 2, 'PHX/POR', true, NULL, 'Less favorable of PHX and POR (Less favorable of WAS and more favorable of PHX and POR to PHL then most favorable to BOS via PHX and POR to WAS to PHL)'),
  (15, 11, 2031, 1, 'WAS', false, NULL, 'Own'),
  (15, 12, 2031, 2, 'MIA/IND', true, NULL, 'More favorable of MIA and IND (via MIA swap for IND; via UTH; Own to LAL)'),
  (15, 13, 2032, 1, 'WAS', false, NULL, 'Own'),
  (15, 14, 2032, 2, 'UTH/MEM/PHL', true, NULL, 'Less favorable of (i) UTH and (ii) more favorable of MEM and PHL (via MEM swap for PHL; via MEM swap of MEM or PHL for UTH; via UTH to WAS; Own to LAL)'),
  (15, 15, 2033, 1, 'WAS', false, NULL, 'Own'),
  (15, 16, 2033, 2, 'DAL', false, NULL, 'DAL (Own to MEM)'),
  (16, 0, 2027, 1, 'DEN', true, 'Protected 1-5', '1-5 Own; two most / more favorable of DEN 6-30, OKC and LAC to OKC; more favorable of (I) least / less favorable of DEN 6-30, OKC and LAC and (II) TOR to LAC then least favorable of all to TOR (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR)'),
  (16, 1, 2028, 1, 'DEN', false, 'Protected 1-5', '1-5 Own; 6-30 to OKC if not already settled'),
  (16, 2, 2028, 2, 'DEN', false, 'Protected 31-33', '31-33 Own; 34-60 to WAS (via SAN to SAC)'),
  (16, 3, 2028, 2, 'MIN', false, NULL, 'MIN (via SAN)'),
  (16, 4, 2029, 1, 'DEN', false, 'Protected 1-5', '1-5 Own; 6-30 to OKC if not already settled; or 1-5 Own; 6-30 to OKC if DEN conveys a first potential 1st round pick to OKC in 2027'),
  (16, 5, 2030, 1, 'DEN', false, 'Protected 1-5', '1-5 Own; 6-30 to OKC if not already settled and if DEN has conveyed a first potential 1st round pick to OKC by 2028'),
  (16, 6, 2031, 1, 'DEN', false, NULL, 'Own'),
  (16, 7, 2031, 1, 'CLE', false, NULL, 'CLE'),
  (16, 8, 2031, 2, 'SAC', false, NULL, 'SAC (via SAN)'),
  (16, 9, 2032, 2, 'SAC', false, NULL, 'SAC (via CLE)'),
  (16, 10, 2033, 1, 'DEN', false, NULL, 'Own'),
  (16, 11, 2033, 2, 'DEN', false, NULL, 'Own'),
  (17, 0, 2028, 1, 'MIN/CHA', true, NULL, 'Own or CHA (via CHA swap for MIN)'),
  (17, 1, 2029, 1, 'MIN', true, 'Protected 1-5', '1-5 Own; most / two most favorable of MIN 6-30, CLE and UTH to UTH then other to CHA (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN); CHA will also have a complex swap right with MIN and PHX will receive a least favorable pick'),
  (17, 2, 2030, 1, 'MIN/SAN/DAL', true, 'Protected 1', '1 Own; less favorable of (I) MIN 2-30 and (II) more favorable of SAN and DAL then most / more favorable of all to SAN [MIN may convey to CHA] (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN); CHA will have a complex swap right with MIN, receiving MIN, SAN or DAL'),
  (17, 3, 2030, 2, 'MEM', false, 'Protected 1-50', 'MEM 51-60 (Own to OKC via DET)'),
  (17, 4, 2032, 1, 'MIN', false, 'Frozen through 2027-28', 'Frozen (through 2027-28)'),
  (18, 0, 2027, 1, 'OKC/DEN/LAC', true, 'DEN 6-30 conditional', 'Most favorable of OKC, DEN 6-30 and LAC (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR)'),
  (18, 1, 2027, 1, 'OKC/DEN/LAC', true, 'DEN 6-30 conditional', 'Second most favorable of OKC, DEN 6-30 and LAC (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR)'),
  (18, 2, 2027, 1, 'SAN', false, 'Protected 1-16', 'SAN 17-30 (via SAC)'),
  (18, 3, 2027, 2, 'CHI', false, NULL, 'CHI (via WAS to NOP to WAS to DAL)'),
  (18, 4, 2027, 2, 'CHA', false, 'SAN 1-16 conditional', 'CHA if SAN 1-16 in 2027 (via SAC)'),
  (18, 5, 2027, 2, 'SAC', false, 'SAN 1-16 conditional', 'SAC if SAN 1-16 in 2027'),
  (18, 6, 2028, 1, 'OKC/DAL', true, NULL, 'Own or swap for DAL'),
  (18, 7, 2028, 1, 'DEN', false, 'Protected 1-5', 'DEN 6-30 if not already settled'),
  (18, 8, 2028, 2, 'UTH', false, NULL, 'UTH (Most favorable of OKC, GOS and MIL to BOS then others to PHL via OKC to PHL; GOS to POR to WAS to PHL; via MIL to BRK to HOU to OKC to PHL)'),
  (18, 9, 2029, 1, 'OKC', false, NULL, 'Own'),
  (18, 10, 2029, 1, 'DEN', false, 'Protected 1-5', 'DEN 6-30 if not already settled; or DEN 6-30 if DEN conveys a first potential 1st round pick to OKC in 2027'),
  (18, 11, 2029, 2, 'OKC', false, NULL, 'Own'),
  (18, 12, 2029, 2, 'ATL/MIA', true, NULL, 'Less favorable of ATL and MIA'),
  (18, 13, 2029, 2, 'BOS', false, NULL, 'BOS'),
  (18, 14, 2029, 2, 'DEN', false, 'Conditional', 'DEN if DEN has not conveyed a first potential 1st round pick to OKC by 2029'),
  (18, 15, 2030, 1, 'OKC', false, NULL, 'Own'),
  (18, 16, 2030, 1, 'DEN', false, 'Protected 1-5', 'DEN 6-30 if not already settled and if DEN has conveyed a first potential 1st round pick to OKC by 2028'),
  (18, 17, 2030, 2, 'OKC', false, NULL, 'Own'),
  (18, 18, 2030, 2, 'ATL', false, NULL, 'ATL'),
  (18, 19, 2030, 2, 'DEN/HOU/MIA', true, NULL, 'Second most favorable of DEN, HOU and MIA (via DEN to CHA to OKC or DEN to OKC)'),
  (18, 20, 2030, 2, 'DEN/HOU/MIA', true, NULL, 'Least favorable of DEN, HOU and MIA (via DEN to CHA to OKC or DEN to OKC)'),
  (18, 21, 2030, 2, 'MIN', false, NULL, 'MIN (via DET)'),
  (18, 22, 2031, 1, 'OKC', false, NULL, 'Own'),
  (18, 23, 2031, 2, 'OKC', false, NULL, 'Own'),
  (18, 24, 2031, 2, 'ATL/HOU', true, NULL, 'More favorable of ATL and HOU 31-55 [or ATL if HOU 56-60] (via ATL swap for HOU)'),
  (18, 25, 2031, 2, 'DET', false, NULL, 'DET'),
  (18, 26, 2031, 2, 'NOP/ORL', true, NULL, 'Less favorable of NOP and ORL (via ORL swap for NOP)'),
  (18, 27, 2032, 1, 'OKC', false, NULL, 'Own'),
  (18, 28, 2032, 2, 'OKC', false, NULL, 'Own'),
  (18, 29, 2032, 2, 'ATL', false, NULL, 'ATL (via LAL to ATL; via LAL to ATL)'),
  (18, 30, 2032, 2, 'LAL', false, NULL, 'LAL (via ATL; via ATL)'),
  (18, 31, 2033, 1, 'OKC', false, NULL, 'Own'),
  (19, 0, 2027, 1, 'POR', false, NULL, 'Own'),
  (19, 1, 2027, 2, 'POR/NOP', true, 'Protected 56-60', 'Less favorable of POR and NOP then other to CHA [POR may convey to HOU]; then less favorable of POR and NOP to HOU if 56-60 (via POR to NOP to CHA; via POR to BOS to HOU)'),
  (19, 2, 2027, 2, 'MIN', false, NULL, 'MIN (via HOU to OKC to NYK)'),
  (19, 3, 2028, 1, 'POR/MIL', true, NULL, 'Own or swap for MIL [WAS then has a complex swap right with MIL]'),
  (19, 4, 2028, 1, 'ORL', false, NULL, 'ORL (via MEM)'),
  (19, 5, 2028, 2, 'POR', false, NULL, 'Own'),
  (19, 6, 2028, 2, 'SAC', false, NULL, 'SAC (via CHI to SAC to MEM)'),
  (19, 7, 2029, 1, 'POR/BOS/MIL', true, NULL, 'Most favorable of POR, BOS and MIL (via BOS to POR; via MIL to POR; via POR to WAS)'),
  (19, 8, 2029, 1, 'POR/BOS/MIL', true, NULL, 'Least favorable of POR, BOS and MIL (via BOS to POR; via MIL to POR; via POR to WAS)'),
  (19, 9, 2029, 2, 'IND/WAS', true, NULL, 'Less favorable of IND and WAS (via IND to NYK; Own to MEM via PHL to IND)'),
  (19, 10, 2030, 1, 'POR/MIL/MIA', true, NULL, 'Own or swap for MIL; more favorable of (I) less favorable MIL and POR and (II) MIA to MIL then least favorable of all to MIA (via POR swap for MIL; via MIL swap of MIL or POR for MIA)'),
  (19, 11, 2031, 1, 'POR', false, NULL, 'Own'),
  (19, 12, 2031, 2, 'POR', false, NULL, 'Own'),
  (19, 13, 2032, 1, 'POR', false, NULL, 'Own'),
  (19, 14, 2032, 2, 'POR', false, NULL, 'Own'),
  (19, 15, 2033, 1, 'POR', false, NULL, 'Own'),
  (19, 16, 2033, 2, 'POR', false, NULL, 'Own'),
  (20, 0, 2027, 1, 'UTH/CLE/MIN', true, 'Protected 1-5', 'Second most favorable of UTH (cannot be 1-5), CLE and MIN; most favorable to MEM and least favorable to PHX (via UTH)'),
  (20, 1, 2027, 2, 'BOS/ORL', true, NULL, 'More favorable of BOS and ORL (via BOS to ORL to BOS)'),
  (20, 2, 2027, 2, 'DEN', false, NULL, 'DEN (via CLE to CHI to BOS)'),
  (20, 3, 2027, 2, 'LAC', false, NULL, 'LAC (via ATL to LAC)'),
  (20, 4, 2028, 1, 'UTH/CLE/LAL', true, NULL, 'Most favorable of UTH, CLE and LAL; less favorable of (I) more favorable of UTH and CLE and (II) LAL to LAL; less favorable of UTH and CLE to CLE [CLE may convey UTH to ATL] (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL)'),
  (20, 5, 2028, 2, 'CLE', false, NULL, 'CLE'),
  (20, 6, 2028, 2, 'DET/CHA/LAC/MIA/NYK', true, NULL, 'Least / less favorable of (i) DET 31-55, (ii) less favorable of CHA and LAC (via CHA to DAL), (iii) MIA if DAL conveys 1st round pick to CHA in 2027 (via SAN to DAL) and (iv) NYK'),
  (20, 7, 2029, 1, 'UTH/CLE/MIN', true, 'Protected 1-5 (MIN)', 'Most / two most favorable of UTH, CLE and MIN 6-30 to UTH; least / less favorable to CHA (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN)'),
  (20, 8, 2029, 1, 'UTH/CLE/MIN', true, 'Protected 1-5 (MIN)', 'Second most favorable of UTH, CLE and MIN 6-30 to UTH (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN)'),
  (20, 9, 2029, 2, 'UTH', false, NULL, 'Own'),
  (20, 10, 2029, 2, 'MIN', false, 'Conditional', 'MIN if MIN does not convey 1st round pick to UTH in 2029'),
  (20, 11, 2030, 1, 'UTH/LAL', true, NULL, 'Own or swap for LAL'),
  (20, 12, 2030, 2, 'UTH/LAC', true, NULL, 'Less favorable of UTH and LAC then other to CHA (via LAC to UTH)'),
  (20, 13, 2031, 1, 'UTH', false, NULL, 'Own'),
  (20, 14, 2031, 1, 'LAL', false, NULL, 'LAL'),
  (20, 15, 2031, 2, 'UTH', false, NULL, 'Own'),
  (20, 16, 2031, 2, 'BOS/CLE', true, NULL, 'More favorable of BOS and CLE (via CLE to ATL to BOS)'),
  (20, 17, 2032, 1, 'UTH', false, NULL, 'Own'),
  (20, 18, 2032, 2, 'CLE', false, NULL, 'CLE (Less favorable of UTH and more favorable of MEM and PHL to WAS then most favorable to MEM)'),
  (20, 19, 2033, 1, 'UTH', false, NULL, 'Own'),
  (20, 20, 2033, 1, 'LAL', false, NULL, 'LAL'),
  (20, 21, 2033, 2, 'UTH', false, NULL, 'Own'),
  (21, 0, 2027, 1, 'GSW', false, NULL, 'Own'),
  (21, 1, 2028, 1, 'GSW', false, NULL, 'Own'),
  (21, 2, 2029, 1, 'GSW', false, NULL, 'Own'),
  (21, 3, 2030, 1, 'GSW', false, 'Protected 1-20', '1-20 Own; 21-30 to MEM (via WAS to DAL)'),
  (21, 4, 2030, 2, 'GSW', false, 'Conditional', 'Own; To MEM if GOS does not convey 1st round pick to MEM in 2030 (via WAS to DAL)'),
  (21, 5, 2031, 1, 'GSW', false, NULL, 'Own'),
  (21, 6, 2032, 1, 'GSW', false, NULL, 'Own'),
  (21, 7, 2032, 2, 'GSW', false, 'Protected 31-50', '31-50 Own; 51-60 to MEM'),
  (21, 8, 2033, 1, 'GSW', false, NULL, 'Own'),
  (21, 9, 2033, 2, 'GSW', false, NULL, 'Own'),
  (22, 0, 2027, 1, 'LAC/DEN/OKC/TOR', true, NULL, 'More favorable of (i) least / less favorable of LAC, DEN 6-30 and OKC and (ii) TOR then least favorable of all to TOR; two most / more favorable of LAC, DEN 6-30 and OKC to OKC (via OKC swap of OKC or DEN for LAC; via LAC swap of LAC, DEN or OKC for TOR)'),
  (22, 1, 2028, 2, 'DAL', false, NULL, 'DAL (via SAC to IND)'),
  (22, 2, 2029, 1, 'LAC/PHL', true, 'Protected 1-3', '1-3 Own; 4-30 Own or PHL (via PHL swap for LAC); Forfeited by LAC: IND'),
  (22, 3, 2030, 2, 'TOR', false, NULL, 'TOR (More favorable of LAC and UTH to CHA then other to LAC via LAC to UTH)'),
  (22, 4, 2031, 1, 'TOR', false, NULL, 'TOR (Own forfeited)'),
  (22, 5, 2031, 2, 'LAC', false, NULL, 'Own'),
  (22, 6, 2032, 2, 'LAC', false, NULL, 'Own'),
  (22, 7, 2033, 1, 'TOR', false, NULL, 'TOR (Own forfeited)'),
  (22, 8, 2033, 2, 'LAC', false, NULL, 'Own'),
  (22, 9, 2033, 2, 'TOR', false, NULL, 'TOR (DET heavily protected and unspecified 2nd round pick to LAC)'),
  (23, 0, 2027, 1, 'LAL', false, 'Protected 1-4', '1-4 Own; 5-30 to MEM (via UTH)'),
  (23, 1, 2028, 1, 'LAL/UTH/CLE', true, NULL, 'Less favorable of (i) LAL and (ii) more favorable of UTH and CLE then most favorable of all to UTH (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL)'),
  (23, 2, 2030, 1, 'LAL/UTH', true, NULL, 'Own or UTH (via UTH swap for LAL)'),
  (23, 3, 2031, 2, 'WAS', false, NULL, 'WAS (Own to BRK)'),
  (23, 4, 2032, 1, 'LAL', false, NULL, 'Own'),
  (23, 5, 2032, 2, 'WAS', false, NULL, 'WAS (Own to OKC via ATL)'),
  (23, 6, 2033, 2, 'LAL', false, NULL, 'Own'),
  (24, 0, 2027, 1, 'UTH/CLE/MIN', true, 'Protected 1-5 (UTH)', 'Least favorable of UTH (cannot be 1-5), CLE and MIN (via UTH; Own to HOU via BRK)'),
  (24, 1, 2027, 2, 'BOS/ORL', true, NULL, 'Less favorable of BOS and ORL (via BOS to ORL to CHA)'),
  (24, 2, 2028, 1, 'PHX/PHI/WAS/BRK/NYK', true, 'PHL 9-30 conditional', 'Least favorable of PHX, PHL 9-30, WAS and BRK; more favorable of (I) WAS and (II) least / less favorable of PHX, PHL 9-30 and BRK to WAS [WAS can then swap with MIL]; If (I) PHL 9-30 is third most favorable and (II) NYK is most or second most favorable of PHX, PHL 9-30, BRK and NYK, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios; least favorable of PHX, BRK and NYK to NYK if NYK and / or if PHL 9-30 is less favorable than PHX and BRK; or second most favorable of PHX, BRK and NYK to NYK in all other scenarios (via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)'),
  (24, 3, 2029, 1, 'CHA/MIN/CLE/UTH', true, NULL, 'PHX will receive a least favorable pick from a complex CHA-MIN conveyance, including CHA''s swap right'),
  (24, 4, 2030, 1, 'PHX/WAS/MEM', true, NULL, 'Least favorable of PHX, WAS and MEM; more favorable of (I) MEM and (II) less favorable of PHX and WAS to MEM; more favorable of PHX and WAS to WAS (via WAS swap for PHX; via MEM swap for PHX or WAS)'),
  (24, 5, 2032, 1, 'PHX', false, 'Frozen through 2027-28', 'Frozen (through 2027-28)'),
  (24, 6, 2032, 2, 'PHX/HOU', true, NULL, 'Less favorable of PHX and HOU then other to CHI (via PHX to MIN)'),
  (25, 0, 2027, 1, 'SAC', false, NULL, 'Own'),
  (25, 1, 2027, 1, 'SAN', false, 'Protected 17-30', 'SAN 1-16'),
  (25, 2, 2027, 2, 'SAC', false, 'SAN 1-16 conditional', 'Own (To OKC if SAN 1-16 in 2027; Own if SAN 17-30 in 2027)'),
  (25, 3, 2027, 2, 'CHA', false, 'SAN 17-30 conditional', 'CHA if SAN 17-30 in 2027 (via NYK to ATL to SAN)'),
  (25, 4, 2028, 1, 'SAC', false, NULL, 'Own'),
  (25, 5, 2029, 1, 'SAC', false, NULL, 'Own'),
  (25, 6, 2030, 1, 'SAC', false, NULL, 'Own'),
  (25, 7, 2031, 1, 'SAC/SAN', true, NULL, 'Own or SAN (via SAN swap for SAC)'),
  (25, 8, 2031, 1, 'MIN', false, NULL, 'MIN (via SAN)'),
  (25, 9, 2032, 1, 'SAC', false, NULL, 'Own'),
  (25, 10, 2033, 1, 'SAC', false, NULL, 'Own'),
  (26, 0, 2027, 1, 'DAL', false, 'Protected 1-2', '1-2 Own; 3-30 to CHA'),
  (26, 1, 2027, 2, 'ATL', false, 'Protected 56-60', 'ATL 56-60'),
  (26, 2, 2028, 1, 'DAL/OKC', true, NULL, 'Own or OKC (via OKC swap for DAL)'),
  (26, 3, 2029, 1, 'LAL', false, NULL, 'LAL'),
  (26, 4, 2030, 1, 'DAL/SAN/MIN', true, NULL, 'Own or SAN (via SAN swap for DAL); less favorable of (I) MIN 2-30 and (II) more favorable of DAL and SAN [or MIN if MIN not conveyable] to MIN then most / more favorable of all to SAN [MIN may convey to CHA] (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN)'),
  (26, 5, 2031, 1, 'DAL', false, NULL, 'Own'),
  (26, 6, 2032, 1, 'DAL', false, NULL, 'Own'),
  (26, 7, 2033, 1, 'DAL', false, NULL, 'Own'),
  (27, 0, 2027, 1, 'HOU/BRK', true, NULL, 'Own or swap for BRK'),
  (27, 1, 2027, 1, 'PHX', false, NULL, 'PHX (via BRK)'),
  (27, 2, 2027, 2, 'POR/NOP', true, 'Protected 56-60', 'Less favorable of POR and NOP if 56-60 (via POR to BOS)'),
  (27, 3, 2028, 1, 'HOU', false, NULL, 'Own'),
  (27, 4, 2029, 1, 'HOU/DAL/PHX', true, NULL, 'Most favorable of HOU, DAL and PHX (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX)'),
  (27, 5, 2029, 1, 'HOU/DAL/PHX', true, NULL, 'Second most favorable of HOU, DAL and PHX then other to BRK (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX)'),
  (27, 6, 2030, 1, 'HOU', false, NULL, 'Own'),
  (27, 7, 2031, 1, 'HOU', false, NULL, 'Own'),
  (27, 8, 2031, 2, 'HOU/ATL', true, 'Protected 31-55', 'Less favorable of HOU 31-55 and ATL then other [or ATL if HOU 56-60] to OKC (via ATL swap for HOU); 56-60 to BOS'),
  (27, 9, 2032, 1, 'HOU', false, NULL, 'Own'),
  (27, 10, 2033, 1, 'HOU', false, NULL, 'Own'),
  (28, 0, 2027, 1, 'MEM', false, NULL, 'Own'),
  (28, 1, 2027, 1, 'LAL', false, 'Protected 1-4', 'LAL 5-30 (via UTH)'),
  (28, 2, 2027, 1, 'UTH/CLE/MIN', true, 'Protected 1-5 (UTH)', 'Most favorable of UTH (cannot be 1-5), CLE and MIN (via UTH)'),
  (28, 3, 2027, 2, 'LAL', false, 'Conditional', 'LAL if LAL does not convey 1st round pick to MEM in 2027 (via UTH)'),
  (28, 4, 2028, 1, 'MEM', false, NULL, 'Own'),
  (28, 5, 2029, 1, 'MEM/ORL', true, 'Protected 1-2 (ORL)', 'Own or swap for ORL 3-30'),
  (28, 6, 2029, 2, 'HOU', false, NULL, 'HOU (via OKC to WAS to DAL)'),
  (28, 7, 2029, 2, 'LAL', false, NULL, 'LAL (via WAS)'),
  (28, 8, 2029, 2, 'ORL', false, 'Conditional', 'ORL if ORL 1-2 in 2029'),
  (28, 9, 2029, 2, 'POR', false, NULL, 'POR (via PHL to IND)'),
  (28, 10, 2030, 1, 'MEM/PHX/WAS', true, NULL, 'More favorable of (I) MEM and (II) less favorable of PHX and WAS then least favorable of all to PHX (via WAS swap for PHX; via MEM swap for PHX or WAS)'),
  (28, 11, 2030, 1, 'GOS', false, 'Protected 1-20', 'GOS 21-30 (via WAS to DAL)'),
  (28, 12, 2030, 1, 'ORL', false, NULL, 'ORL'),
  (28, 13, 2030, 2, 'MEM', false, 'Protected 31-50', '31-50 Own; 51-60 to MIN'),
  (28, 14, 2030, 2, 'DEN/HOU/MIA', true, NULL, 'Most favorable of DEN, HOU and MIA (via DEN to CHA to OKC or DEN to OKC; via OKC to MEM)'),
  (28, 15, 2030, 2, 'GOS', false, 'Conditional', 'GOS if GOS does not convey 1st round pick to MEM in 2030 (via WAS to DAL)'),
  (28, 16, 2031, 1, 'MEM', false, NULL, 'Own'),
  (28, 17, 2031, 1, 'PHX', false, NULL, 'PHX (via UTH)'),
  (28, 18, 2031, 2, 'MEM/IND/MIA', true, NULL, 'More favorable of (I) MEM and (II) less favorable of IND and MIA then least favorable of all to IND (via MIA swap for IND; via MEM swap for IND or MIA)'),
  (28, 19, 2032, 1, 'MEM', false, NULL, 'Own'),
  (28, 20, 2032, 2, 'MEM/PHL/UTH', true, NULL, 'Most favorable of MEM, PHL and UTH; less favorable of (I) more favorable of MEM and PHL and (II) UTH to WAS; less favorable of MEM and PHL to PHL (via MEM swap for PHL; via UTH to WAS; via MEM swap of MEM or PHL for UTH)'),
  (28, 21, 2032, 2, 'GOS', false, 'Protected 1-50', 'GOS 51-60'),
  (28, 22, 2033, 1, 'MEM', false, NULL, 'Own'),
  (28, 23, 2033, 2, 'MEM', false, NULL, 'Own'),
  (28, 24, 2033, 2, 'OKC', false, NULL, 'OKC'),
  (28, 25, 2033, 2, 'WAS', false, NULL, 'WAS (NOP unspecified 2nd round pick to MEM; NOP unspecified 2nd round pick swap to MEM)'),
  (29, 0, 2027, 1, 'NOP/MIL', true, NULL, 'More favorable of NOP and MIL then other to ATL if 5-30 or NOP and MIL if both 1-4 (via NOP)'),
  (29, 1, 2027, 1, 'NOP/MIL', false, 'Protected 1-4 (MIL & NOP)', 'Less favorable of NOP and MIL if both 1-4 (via NOP)'),
  (29, 2, 2027, 2, 'OKC/HOU/IND/MIA', true, NULL, 'Second most favorable of OKC, HOU, IND and MIA (via HOU to DET to OKC to NYK)'),
  (29, 3, 2028, 1, 'NOP', false, NULL, 'Own'),
  (29, 4, 2029, 1, 'NOP', false, NULL, 'Own'),
  (29, 5, 2030, 1, 'NOP', false, NULL, 'Own'),
  (29, 6, 2030, 2, 'NOP/ORL', true, NULL, 'Own or ORL (via ORL swap for NOP)'),
  (29, 7, 2031, 1, 'NOP', false, NULL, 'Own'),
  (29, 8, 2031, 2, 'TOR', false, NULL, 'TOR (More favorable of NOP and ORL to ORL then other to OKC via ORL swap for NOP)'),
  (29, 9, 2032, 1, 'NOP', false, NULL, 'Own'),
  (29, 10, 2032, 2, 'NOP', false, NULL, 'Own'),
  (29, 11, 2033, 1, 'NOP', false, NULL, 'Own'),
  (29, 12, 2033, 2, 'NOP', false, NULL, 'Own (NOP unspecified 2nd round pick and pick swap to MEM)'),
  (30, 0, 2027, 1, 'ATL', false, NULL, 'ATL (1-16 to SAC; 17-30 to OKC via SAC)'),
  (30, 1, 2027, 2, 'SAN/OKC/HOU/IND/MIA', true, NULL, 'More favorable of (I) SAN and (II) least favorable of OKC, HOU, IND and MIA then least favorable of all to MIA (via HOU to DET to OKC; via MIA to OKC to UTH to SAN to MIA)'),
  (30, 2, 2028, 1, 'SAN/BOS', true, 'Protected 1 (BOS)', 'Own or swap for BOS 2-30 [BOS then has a complex swap right with PHL]'),
  (30, 3, 2028, 2, 'SAN', false, NULL, 'Own'),
  (30, 4, 2028, 2, 'BOS', false, 'Conditional', 'BOS 31-45 if BOS 1 in 2028'),
  (30, 5, 2028, 2, 'NOP', false, NULL, 'NOP'),
  (30, 6, 2029, 1, 'SAN', false, NULL, 'Own'),
  (30, 7, 2029, 2, 'SAN', false, NULL, 'Own'),
  (30, 8, 2029, 2, 'LAC', false, NULL, 'LAC (via PHL)'),
  (30, 9, 2029, 2, 'NOP', false, NULL, 'NOP'),
  (30, 10, 2030, 1, 'SAN/DAL/MIN', true, 'MIN 1 protected', 'Most / more favorable of SAN, DAL and MIN 2-30; less favorable of (I) more favorable of SAN and DAL and (II) MIN 2-30 [or MIN if MIN not conveyable] to MIN [MIN may convey to CHA]; less favorable of SAN and DAL to DAL (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN)'),
  (30, 11, 2030, 2, 'SAN', false, NULL, 'Own'),
  (30, 12, 2030, 2, 'CLE', false, NULL, 'CLE'),
  (30, 13, 2030, 2, 'SAC', false, NULL, 'SAC (via IND)'),
  (30, 14, 2031, 1, 'SAN/SAC', true, NULL, 'Own or swap for SAC'),
  (30, 15, 2031, 2, 'SAN', false, NULL, 'Own'),
  (30, 16, 2032, 1, 'SAN', false, NULL, 'Own'),
  (30, 17, 2032, 2, 'SAN', false, NULL, 'Own'),
  (30, 18, 2033, 1, 'SAN', false, NULL, 'Own'),
  (30, 19, 2033, 2, 'SAN', false, NULL, 'Own')
ON CONFLICT (team_id, pick_order) DO UPDATE
SET year = EXCLUDED.year,
    round = EXCLUDED.round,
    original_owner = EXCLUDED.original_owner,
    is_swap = EXCLUDED.is_swap,
    protection = EXCLUDED.protection,
    details = EXCLUDED.details;


COMMIT;

-- BEGIN NBA 2026-27 SNAPSHOT AS OF 2026-11-11 PH
-- NBA Hub roster and player-stat snapshot.
-- Stats: ESPN final 2026-27 regular-season box scores through November 10, 2026 (US).
-- This cutoff is November 11, 2026 in the Philippines (UTC+8).
-- Roster source: ESPN team rosters timestamped 2026-11-15T12:01:36Z to 2026-11-15T12:01:36Z;
-- post-cutoff NBA player-movement feed signings are reversed.
-- NBA Player Movement confirms Nique Clifford moved from Sacramento to Oklahoma City on November 8, 2026.
BEGIN;
ALTER TABLE public.nba_players
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS nba_players_active_team_idx
  ON public.nba_players (is_active, team_id);
UPDATE public.nba_players SET is_active = false;

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Derrick White'
    , full_name = 'Derrick White'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":12.2,"reb":3.1,"ast":5.1,"stl":1.3,"blk":0.5,"tov":2.3,"fg":43.4,"fg3":32.1,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '1:derrick white';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Baylor Scheierman'
    , full_name = 'Baylor Scheierman'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":5.8,"reb":3.7,"ast":1.3,"stl":0.6,"blk":0.0,"tov":0.8,"fg":44.2,"fg3":45.2,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '1:baylor scheierman';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Paul George'
    , full_name = 'Paul George'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":22.0,"reb":5.2,"ast":3.8,"stl":2.1,"blk":0.4,"tov":2.9,"fg":48.8,"fg3":44.0,"ft":82.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '1:paul george';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Jayson Tatum'
    , full_name = 'Jayson Tatum'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":26.5,"reb":6.0,"ast":7.4,"stl":0.7,"blk":0.7,"tov":2.9,"fg":42.5,"fg3":32.4,"ft":89.5}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '1:jayson tatum';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Mitchell Robinson'
    , full_name = 'Mitchell Robinson'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":6.0,"reb":5.7,"ast":0.8,"stl":0.8,"blk":0.8,"tov":0.7,"fg":62.8,"fg3":null,"ft":33.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '1:mitchell robinson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Payton Pritchard'
    , full_name = 'Payton Pritchard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":13.3,"reb":3.5,"ast":3.9,"stl":0.8,"blk":0.2,"tov":1.2,"fg":41.4,"fg3":37.3,"ft":86.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '1:payton pritchard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Ron Harper Jr.'
    , full_name = 'Ron Harper Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":1.3,"reb":0.5,"ast":0.5,"stl":0.2,"blk":0.0,"tov":0.7,"fg":25.0,"fg3":25.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '1:ron harper jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Jordan Walsh'
    , full_name = 'Jordan Walsh'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":4.4,"reb":3.5,"ast":0.7,"stl":0.6,"blk":0.1,"tov":0.6,"fg":38.3,"fg3":27.6,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '1:jordan walsh';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Hugo Gonzalez'
    , full_name = 'Hugo Gonzalez'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":4.4,"reb":2.1,"ast":0.6,"stl":0.6,"blk":0.3,"tov":0.5,"fg":45.9,"fg3":23.8,"ft":69.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '1:hugo gonzález';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Sam Hauser'
    , full_name = 'Sam Hauser'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.1,"reb":3.1,"ast":1.2,"stl":0.2,"blk":0.1,"tov":0.1,"fg":47.1,"fg3":43.1,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '1:sam hauser';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Mike Conley'
    , full_name = 'Mike Conley'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":3.0,"reb":0.8,"ast":0.5,"stl":0.5,"blk":0.2,"tov":0.5,"fg":66.7,"fg3":66.7,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '1:mike conley';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Luka Garza'
    , full_name = 'Luka Garza'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.5,"reb":3.5,"ast":1.4,"stl":0.4,"blk":0.4,"tov":0.6,"fg":45.1,"fg3":52.0,"ft":61.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '1:luka garza';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Amari Williams'
    , full_name = 'Amari Williams'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '1:amari williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Neemias Queta'
    , full_name = 'Neemias Queta'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":9.0,"reb":6.2,"ast":1.7,"stl":0.2,"blk":1.2,"tov":1.0,"fg":55.9,"fg3":66.7,"ft":61.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '1:neemias queta';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Chris Cenac Jr.'
    , full_name = 'Chris Cenac Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":2.7,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.7,"fg":75.0,"fg3":50.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '1:chris cenac jr.';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '1:tucker devries';

UPDATE public.nba_players
SET is_active = true
    , team_id = 1
    , name = 'Dillon Mitchell'
    , full_name = 'Dillon Mitchell'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '1:dillon mitchell';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '1:milos uzan';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Egor Demin'
    , full_name = 'Egor Demin'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":7.8,"reb":2.2,"ast":2.8,"stl":1.0,"blk":0.0,"tov":2.0,"fg":31.0,"fg3":28.6,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '2:egor dëmin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Michael Porter Jr.'
    , full_name = 'Michael Porter Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":21.5,"reb":7.7,"ast":1.1,"stl":1.3,"blk":0.4,"tov":2.2,"fg":45.2,"fg3":37.2,"ft":72.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '2:michael porter jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Julius Randle'
    , full_name = 'Julius Randle'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":20.0,"reb":6.7,"ast":5.0,"stl":0.8,"blk":0.2,"tov":4.0,"fg":44.8,"fg3":34.1,"ft":79.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '2:julius randle';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Day''Ron Sharpe'
    , full_name = 'Day''Ron Sharpe'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.5,"reb":7.1,"ast":4.0,"stl":0.7,"blk":1.2,"tov":2.1,"fg":49.1,"fg3":27.3,"ft":72.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '2:day''ron sharpe';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Moritz Wagner'
    , full_name = 'Moritz Wagner'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":10.4,"reb":3.2,"ast":1.0,"stl":0.7,"blk":0.1,"tov":0.9,"fg":55.4,"fg3":57.9,"ft":77.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '2:moritz wagner';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Josh Minott'
    , full_name = 'Josh Minott'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":6.2,"reb":2.6,"ast":0.6,"stl":0.8,"blk":0.2,"tov":0.2,"fg":39.3,"fg3":23.8,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '2:josh minott';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Mikel Brown Jr.'
    , full_name = 'Mikel Brown Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":12.9,"reb":2.1,"ast":3.9,"stl":0.7,"blk":0.1,"tov":2.1,"fg":34.6,"fg3":31.1,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '2:mikel brown jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Danny Wolf'
    , full_name = 'Danny Wolf'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":9.8,"reb":5.2,"ast":1.8,"stl":0.2,"blk":0.0,"tov":1.4,"fg":46.9,"fg3":45.5,"ft":69.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '2:danny wolf';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Drake Powell'
    , full_name = 'Drake Powell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":0.7,"reb":1.3,"ast":2.0,"stl":0.0,"blk":0.0,"tov":1.0,"fg":50.0,"fg3":0.0,"ft":0.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '2:drake powell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Joshua Jefferson'
    , full_name = 'Joshua Jefferson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '2:joshua jefferson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Nolan Traore'
    , full_name = 'Nolan Traore'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":12.9,"reb":2.0,"ast":2.6,"stl":1.4,"blk":0.5,"tov":1.6,"fg":51.6,"fg3":46.2,"ft":68.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '2:nolan traore';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Keon Ellis'
    , full_name = 'Keon Ellis'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":4.3,"reb":1.7,"ast":2.0,"stl":1.2,"blk":1.0,"tov":0.7,"fg":33.3,"fg3":27.6,"ft":25.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '2:keon ellis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Terance Mann'
    , full_name = 'Terance Mann'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":0.4,"reb":1.2,"ast":1.2,"stl":0.8,"blk":0.2,"tov":0.2,"fg":10.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '2:terance mann';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Grant Nelson'
    , full_name = 'Grant Nelson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '2:grant nelson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Noah Clowney'
    , full_name = 'Noah Clowney'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":5.0,"reb":4.5,"ast":0.7,"stl":0.3,"blk":0.4,"tov":0.8,"fg":37.2,"fg3":26.1,"ft":70.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '2:noah clowney';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Chaney Johnson'
    , full_name = 'Chaney Johnson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":4.8,"reb":2.5,"ast":1.0,"stl":0.7,"blk":0.3,"tov":1.3,"fg":34.0,"fg3":30.4,"ft":90.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '2:chaney johnson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Tyler Bilodeau'
    , full_name = 'Tyler Bilodeau'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '2:tyler bilodeau';

UPDATE public.nba_players
SET is_active = true
    , team_id = 2
    , name = 'Ben Saraf'
    , full_name = 'Ben Saraf'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":2.0,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":100.0,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '2:ben saraf';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Jalen Brunson'
    , full_name = 'Jalen Brunson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":25.9,"reb":3.1,"ast":5.2,"stl":0.6,"blk":0.3,"tov":1.6,"fg":42.0,"fg3":36.6,"ft":78.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '3:jalen brunson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Josh Hart'
    , full_name = 'Josh Hart'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":8.6,"reb":7.3,"ast":3.9,"stl":2.1,"blk":0.3,"tov":2.0,"fg":38.6,"fg3":34.2,"ft":60.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '3:josh hart';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Mikal Bridges'
    , full_name = 'Mikal Bridges'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":6.3,"reb":3.4,"ast":2.1,"stl":1.0,"blk":0.6,"tov":0.7,"fg":32.9,"fg3":26.5,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '3:mikal bridges';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'OG Anunoby'
    , full_name = 'OG Anunoby'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":16.7,"reb":5.3,"ast":2.4,"stl":1.0,"blk":0.5,"tov":2.0,"fg":39.2,"fg3":33.3,"ft":87.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '3:og anunoby';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Karl-Anthony Towns'
    , full_name = 'Karl-Anthony Towns'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":20.9,"reb":13.8,"ast":3.1,"stl":0.8,"blk":0.5,"tov":3.4,"fg":54.3,"fg3":39.6,"ft":75.5}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '3:karl-anthony towns';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '3:jack kayil';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Tyler Nickel'
    , full_name = 'Tyler Nickel'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '3:tyler nickel';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Andre Drummond'
    , full_name = 'Andre Drummond'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":4.7,"reb":8.4,"ast":1.2,"stl":0.3,"blk":0.5,"tov":0.7,"fg":43.5,"fg3":0.0,"ft":58.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '3:andre drummond';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Jordan Clarkson'
    , full_name = 'Jordan Clarkson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":6.0,"reb":1.8,"ast":0.6,"stl":0.2,"blk":0.2,"tov":0.2,"fg":52.3,"fg3":60.0,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '3:jordan clarkson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Miles McBride'
    , full_name = 'Miles McBride'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":6.8,"reb":1.5,"ast":1.1,"stl":0.8,"blk":0.3,"tov":0.4,"fg":42.6,"fg3":42.9,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '3:miles mcbride';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Pacome Dadiet'
    , full_name = 'Pacome Dadiet'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":4.0,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":55.6,"fg3":25.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '3:pacôme dadiet';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Jose Alvarado'
    , full_name = 'Jose Alvarado'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.0,"reb":1.2,"ast":1.6,"stl":0.6,"blk":0.2,"tov":1.4,"fg":26.7,"fg3":25.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '3:jose alvarado';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Kevin McCullar Jr.'
    , full_name = 'Kevin McCullar Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '3:kevin mccullar jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Tyler Kolek'
    , full_name = 'Tyler Kolek'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":3.4,"reb":1.9,"ast":5.0,"stl":0.5,"blk":0.1,"tov":0.6,"fg":40.0,"fg3":33.3,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '3:tyler kolek';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Landry Shamet'
    , full_name = 'Landry Shamet'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":9.4,"reb":1.6,"ast":1.9,"stl":0.3,"blk":0.2,"tov":1.0,"fg":44.3,"fg3":41.5,"ft":71.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '3:landry shamet';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Mohamed Diawara'
    , full_name = 'Mohamed Diawara'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":3.0,"reb":2.6,"ast":2.0,"stl":0.0,"blk":0.4,"tov":0.6,"fg":31.2,"fg3":16.7,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '3:mohamed diawara';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Tony Bradley'
    , full_name = 'Tony Bradley'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":1.6,"reb":2.2,"ast":0.0,"stl":0.2,"blk":0.2,"tov":0.4,"fg":60.0,"fg3":null,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '3:tony bradley';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Tyrese Maxey'
    , full_name = 'Tyrese Maxey'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":26.7,"reb":3.5,"ast":5.3,"stl":1.2,"blk":0.6,"tov":2.0,"fg":49.1,"fg3":36.0,"ft":86.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '4:tyrese maxey';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Jaylen Brown'
    , full_name = 'Jaylen Brown'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":21.5,"reb":6.5,"ast":3.8,"stl":1.3,"blk":0.5,"tov":2.3,"fg":47.6,"fg3":38.2,"ft":70.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '4:jaylen brown';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'VJ Edgecombe'
    , full_name = 'VJ Edgecombe'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":12.7,"reb":6.3,"ast":3.1,"stl":1.5,"blk":0.5,"tov":1.1,"fg":45.2,"fg3":35.8,"ft":69.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '4:vj edgecombe';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'LeBron James'
    , full_name = 'LeBron James'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":15.1,"reb":7.2,"ast":6.5,"stl":1.3,"blk":0.7,"tov":2.7,"fg":43.2,"fg3":23.7,"ft":70.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '4:lebron james';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Joel Embiid'
    , full_name = 'Joel Embiid'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":17.7,"reb":9.3,"ast":3.8,"stl":0.7,"blk":0.7,"tov":3.0,"fg":37.0,"fg3":12.1,"ft":89.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '4:joel embiid';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Labaron Philon Jr.'
    , full_name = 'Labaron Philon Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":2.4,"reb":1.0,"ast":0.7,"stl":0.0,"blk":0.0,"tov":0.6,"fg":35.3,"fg3":25.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '4:labaron philon jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Caleb Love'
    , full_name = 'Caleb Love'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '4:caleb love';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Kentavious Caldwell-Pope'
    , full_name = 'Kentavious Caldwell-Pope'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":5.2,"reb":2.4,"ast":1.4,"stl":0.8,"blk":0.4,"tov":0.4,"fg":44.7,"fg3":45.5,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '4:kentavious caldwell-pope';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Justin Edwards'
    , full_name = 'Justin Edwards'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":1.0,"reb":0.6,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.4,"fg":50.0,"fg3":50.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '4:justin edwards';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '4:marjon beauchamp';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Rayan Rupert'
    , full_name = 'Rayan Rupert'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":1.0,"reb":1.5,"ast":0.5,"stl":0.5,"blk":0.0,"tov":0.0,"fg":33.3,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '4:rayan rupert';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Anfernee Simons'
    , full_name = 'Anfernee Simons'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":9.7,"reb":2.2,"ast":1.2,"stl":0.5,"blk":0.2,"tov":0.6,"fg":39.8,"fg3":39.1,"ft":84.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '4:anfernee simons';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '4:tyrese martin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Dominick Barlow'
    , full_name = 'Dominick Barlow'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '4:dominick barlow';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Adem Bona'
    , full_name = 'Adem Bona'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":2.1,"reb":3.9,"ast":0.8,"stl":0.4,"blk":1.0,"tov":0.9,"fg":38.1,"fg3":0.0,"ft":42.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '4:adem bona';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Dean Wade'
    , full_name = 'Dean Wade'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":3.7,"reb":3.7,"ast":1.7,"stl":1.3,"blk":0.4,"tov":0.3,"fg":43.3,"fg3":35.0,"ft":57.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '4:dean wade';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Jabari Walker'
    , full_name = 'Jabari Walker'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":4.9,"reb":3.8,"ast":0.5,"stl":0.1,"blk":0.0,"tov":0.1,"fg":53.6,"fg3":25.0,"ft":58.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '4:jabari walker';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Ariel Hukporti'
    , full_name = 'Ariel Hukporti'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '4:ariel hukporti';

UPDATE public.nba_players
SET is_active = true
    , team_id = 4
    , name = 'Tacko Fall'
    , full_name = 'Tacko Fall'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '4:tacko fall';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '4:jameer nelson jr.';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '4:saint thomas';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '4:duke miles';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '4:dillon jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Immanuel Quickley'
    , full_name = 'Immanuel Quickley'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":17.4,"reb":3.5,"ast":5.8,"stl":1.1,"blk":0.0,"tov":1.0,"fg":40.9,"fg3":33.3,"ft":84.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '5:immanuel quickley';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'RJ Barrett'
    , full_name = 'RJ Barrett'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":21.3,"reb":5.8,"ast":3.7,"stl":0.4,"blk":0.5,"tov":1.7,"fg":45.7,"fg3":27.8,"ft":61.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '5:rj barrett';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Kawhi Leonard'
    , full_name = 'Kawhi Leonard'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":19.5,"reb":7.5,"ast":1.5,"stl":3.5,"blk":0.5,"tov":2.0,"fg":32.4,"fg3":28.6,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '5:kawhi leonard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Scottie Barnes'
    , full_name = 'Scottie Barnes'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":23.5,"reb":7.6,"ast":5.1,"stl":2.2,"blk":0.6,"tov":4.0,"fg":47.5,"fg3":15.4,"ft":68.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '5:scottie barnes';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Jakob Poeltl'
    , full_name = 'Jakob Poeltl'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":8.5,"reb":6.5,"ast":1.2,"stl":0.9,"blk":0.9,"tov":1.0,"fg":64.6,"fg3":null,"ft":60.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '5:jakob poeltl';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Kyle Anderson'
    , full_name = 'Kyle Anderson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":1.7,"reb":1.1,"ast":1.3,"stl":0.4,"blk":0.4,"tov":0.4,"fg":54.5,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '5:kyle anderson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '5:trey jemison iii';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '5:chucky hepburn';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Nate Bittle'
    , full_name = 'Nate Bittle'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '5:nate bittle';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Jaden Bradley'
    , full_name = 'Jaden Bradley'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":1.8,"reb":0.6,"ast":1.0,"stl":0.5,"blk":0.0,"tov":0.6,"fg":42.9,"fg3":null,"ft":88.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '5:jaden bradley';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '5:a.j. lawson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Ja''Kobe Walter'
    , full_name = 'Ja''Kobe Walter'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":11.0,"reb":4.2,"ast":2.2,"stl":1.2,"blk":0.4,"tov":0.8,"fg":38.7,"fg3":32.8,"ft":65.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '5:ja''kobe walter';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Malachi Smith'
    , full_name = 'Malachi Smith'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '5:malachi smith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Allen Graves'
    , full_name = 'Allen Graves'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":4.2,"reb":2.4,"ast":0.8,"stl":0.5,"blk":0.5,"tov":0.1,"fg":40.5,"fg3":22.2,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '5:allen graves';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Jamal Shead'
    , full_name = 'Jamal Shead'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.4,"reb":2.2,"ast":7.0,"stl":1.5,"blk":0.2,"tov":2.1,"fg":36.4,"fg3":27.3,"ft":89.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '5:jamal shead';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Collin Murray-Boyles'
    , full_name = 'Collin Murray-Boyles'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":10.7,"reb":5.0,"ast":1.3,"stl":1.2,"blk":0.6,"tov":1.6,"fg":50.7,"fg3":31.2,"ft":89.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '5:collin murray-boyles';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Trayce Jackson-Davis'
    , full_name = 'Trayce Jackson-Davis'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":3.1,"reb":2.7,"ast":0.4,"stl":0.8,"blk":0.3,"tov":0.2,"fg":70.6,"fg3":null,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '5:trayce jackson-davis';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '5:andre jackson jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Alijah Martin'
    , full_name = 'Alijah Martin'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":5.8,"reb":1.7,"ast":1.1,"stl":0.4,"blk":0.2,"tov":1.2,"fg":65.5,"fg3":53.3,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '5:alijah martin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 5
    , name = 'Jamison Battle'
    , full_name = 'Jamison Battle'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":9.1,"reb":1.5,"ast":0.5,"stl":0.5,"blk":0.0,"tov":0.5,"fg":46.9,"fg3":42.9,"ft":76.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '5:jamison battle';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Josh Giddey'
    , full_name = 'Josh Giddey'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":10.3,"reb":4.9,"ast":8.4,"stl":0.6,"blk":0.3,"tov":2.8,"fg":41.7,"fg3":28.1,"ft":70.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '6:josh giddey';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Norman Powell'
    , full_name = 'Norman Powell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":19.2,"reb":2.5,"ast":1.6,"stl":1.6,"blk":0.0,"tov":1.8,"fg":39.8,"fg3":30.9,"ft":79.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '6:norman powell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Matas Buzelis'
    , full_name = 'Matas Buzelis'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":13.6,"reb":4.4,"ast":2.0,"stl":0.4,"blk":0.7,"tov":2.4,"fg":43.0,"fg3":29.5,"ft":83.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '6:matas buzelis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Patrick Williams'
    , full_name = 'Patrick Williams'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":5.5,"reb":1.5,"ast":2.5,"stl":0.5,"blk":0.5,"tov":0.5,"fg":30.8,"fg3":12.5,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '6:patrick williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Nic Claxton'
    , full_name = 'Nic Claxton'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":4.0,"reb":4.0,"ast":4.0,"stl":0.0,"blk":2.0,"tov":1.0,"fg":66.7,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '6:nic claxton';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Caleb Wilson'
    , full_name = 'Caleb Wilson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":19.3,"reb":6.3,"ast":2.1,"stl":1.9,"blk":1.0,"tov":2.8,"fg":40.6,"fg3":30.4,"ft":71.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '6:caleb wilson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Buddy Hield'
    , full_name = 'Buddy Hield'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":5.6,"reb":1.8,"ast":1.6,"stl":0.5,"blk":0.1,"tov":1.0,"fg":48.6,"fg3":38.1,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '6:buddy hield';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Leonard Miller'
    , full_name = 'Leonard Miller'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":7.1,"reb":4.1,"ast":1.0,"stl":0.2,"blk":0.6,"tov":0.9,"fg":43.4,"fg3":18.5,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '6:leonard miller';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Zach Collins'
    , full_name = 'Zach Collins'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":1.5,"reb":2.3,"ast":0.7,"stl":0.3,"blk":0.0,"tov":0.3,"fg":26.7,"fg3":0.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '6:zach collins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Noa Essengue'
    , full_name = 'Noa Essengue'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":5.2,"reb":3.5,"ast":0.4,"stl":0.4,"blk":0.2,"tov":0.9,"fg":37.8,"fg3":17.6,"ft":55.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '6:noa essengue';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Jalen Smith'
    , full_name = 'Jalen Smith'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":11.7,"reb":7.8,"ast":1.8,"stl":0.3,"blk":1.2,"tov":0.7,"fg":49.4,"fg3":29.5,"ft":71.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '6:jalen smith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Tre Jones'
    , full_name = 'Tre Jones'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":10.3,"reb":2.7,"ast":2.9,"stl":1.1,"blk":0.1,"tov":0.9,"fg":49.2,"fg3":37.5,"ft":77.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '6:tre jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Isaac Okoro'
    , full_name = 'Isaac Okoro'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":5.8,"reb":1.3,"ast":1.1,"stl":0.4,"blk":0.3,"tov":0.7,"fg":37.8,"fg3":15.8,"ft":84.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '6:isaac okoro';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Dailyn Swain'
    , full_name = 'Dailyn Swain'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":2.5,"reb":1.5,"ast":1.5,"stl":1.0,"blk":0.0,"tov":2.0,"fg":40.0,"fg3":0.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '6:dailyn swain';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Tobe Awaka'
    , full_name = 'Tobe Awaka'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":2.0,"reb":5.2,"ast":0.8,"stl":0.2,"blk":0.8,"tov":0.5,"fg":75.0,"fg3":null,"ft":33.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '6:tobe awaka';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Jaylin Sellers'
    , full_name = 'Jaylin Sellers'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":4.6,"reb":0.8,"ast":1.0,"stl":0.4,"blk":0.2,"tov":0.8,"fg":33.3,"fg3":37.5,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '6:jaylin sellers';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'James Harden'
    , full_name = 'James Harden'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":15.3,"reb":4.8,"ast":5.7,"stl":0.7,"blk":0.5,"tov":3.0,"fg":36.4,"fg3":35.5,"ft":84.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '7:james harden';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Donovan Mitchell'
    , full_name = 'Donovan Mitchell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":22.8,"reb":4.8,"ast":5.5,"stl":1.3,"blk":0.5,"tov":3.0,"fg":48.0,"fg3":38.5,"ft":77.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '7:donovan mitchell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Peyton Watson'
    , full_name = 'Peyton Watson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":11.4,"reb":4.6,"ast":2.7,"stl":0.9,"blk":1.4,"tov":1.8,"fg":40.6,"fg3":21.6,"ft":70.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '7:peyton watson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Evan Mobley'
    , full_name = 'Evan Mobley'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":17.5,"reb":7.5,"ast":3.6,"stl":0.6,"blk":1.1,"tov":1.6,"fg":55.8,"fg3":50.0,"ft":63.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '7:evan mobley';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Jarrett Allen'
    , full_name = 'Jarrett Allen'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":13.1,"reb":7.7,"ast":1.2,"stl":0.6,"blk":1.4,"tov":0.9,"fg":64.8,"fg3":75.0,"ft":67.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '7:jarrett allen';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Thomas Bryant'
    , full_name = 'Thomas Bryant'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":8.7,"reb":2.2,"ast":0.2,"stl":0.2,"blk":0.3,"tov":0.2,"fg":50.0,"fg3":44.4,"ft":82.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '7:thomas bryant';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Sam Merrill'
    , full_name = 'Sam Merrill'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":7.7,"reb":3.4,"ast":1.9,"stl":1.0,"blk":0.1,"tov":0.3,"fg":38.6,"fg3":32.6,"ft":91.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '7:sam merrill';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Craig Porter Jr.'
    , full_name = 'Craig Porter Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":1.6,"reb":1.7,"ast":1.3,"stl":0.3,"blk":0.2,"tov":0.7,"fg":54.5,"fg3":25.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '7:craig porter jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Riley Minix'
    , full_name = 'Riley Minix'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":3.3,"reb":2.7,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":36.4,"fg3":25.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '7:riley minix';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Meleek Thomas'
    , full_name = 'Meleek Thomas'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":13.0,"reb":2.6,"ast":1.2,"stl":1.1,"blk":0.4,"tov":1.0,"fg":47.0,"fg3":47.8,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '7:meleek thomas';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Khalifa Diop'
    , full_name = 'Khalifa Diop'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '7:khalifa diop';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Jaylon Tyson'
    , full_name = 'Jaylon Tyson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":7.8,"reb":3.6,"ast":2.8,"stl":0.6,"blk":0.4,"tov":1.2,"fg":41.0,"fg3":22.7,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '7:jaylon tyson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":2.3,"reb":1.7,"ast":0.3,"stl":0.7,"blk":0.0,"tov":0.0,"fg":30.0,"fg3":0.0,"ft":50.0}'::jsonb, true)
    , updated_at = now()
WHERE id = '7:tristan enaruna';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Tyrese Proctor'
    , full_name = 'Tyrese Proctor'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":6.0,"reb":2.8,"ast":2.3,"stl":0.5,"blk":0.0,"tov":0.4,"fg":48.8,"fg3":52.4,"ft":77.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '7:tyrese proctor';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Mario Hezonja'
    , full_name = 'Mario Hezonja'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.5,"reb":5.9,"ast":1.6,"stl":0.6,"blk":0.2,"tov":1.0,"fg":42.7,"fg3":28.6,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '7:mario hezonja';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Tre Mann'
    , full_name = 'Tre Mann'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":0.8,"reb":0.0,"ast":0.4,"stl":0.6,"blk":0.4,"tov":0.2,"fg":25.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '7:tre mann';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Nae''Qwan Tomlin'
    , full_name = 'Nae''Qwan Tomlin'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '7:nae''qwan tomlin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Ernest Udeh Jr.'
    , full_name = 'Ernest Udeh Jr.'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '7:ernest udeh, jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Cade Cunningham'
    , full_name = 'Cade Cunningham'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":22.3,"reb":5.2,"ast":7.6,"stl":1.6,"blk":0.9,"tov":3.5,"fg":46.2,"fg3":29.2,"ft":80.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '8:cade cunningham';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Duncan Robinson'
    , full_name = 'Duncan Robinson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":18.6,"reb":1.8,"ast":2.3,"stl":1.5,"blk":0.2,"tov":1.0,"fg":46.6,"fg3":45.7,"ft":82.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '8:duncan robinson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Ausar Thompson'
    , full_name = 'Ausar Thompson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":9.3,"reb":8.4,"ast":4.4,"stl":1.1,"blk":0.6,"tov":2.6,"fg":48.6,"fg3":0.0,"ft":69.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '8:ausar thompson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'John Collins'
    , full_name = 'John Collins'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":10.7,"reb":6.1,"ast":0.8,"stl":0.6,"blk":1.0,"tov":0.8,"fg":50.0,"fg3":38.5,"ft":69.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '8:john collins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Jalen Duren'
    , full_name = 'Jalen Duren'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":13.0,"reb":7.5,"ast":2.0,"stl":1.0,"blk":1.0,"tov":1.0,"fg":58.8,"fg3":null,"ft":85.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '8:jalen duren';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Ugonna Onyenso'
    , full_name = 'Ugonna Onyenso'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '8:ugonna onyenso';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Ebuka Okorie'
    , full_name = 'Ebuka Okorie'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.2,"reb":0.4,"ast":0.6,"stl":0.2,"blk":0.0,"tov":0.4,"fg":33.3,"fg3":0.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '8:ebuka okorie';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Isaac Jones'
    , full_name = 'Isaac Jones'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":0.5,"reb":1.2,"ast":0.2,"stl":0.0,"blk":0.5,"tov":0.2,"fg":50.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '8:isaac jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Ronald Holland II'
    , full_name = 'Ronald Holland II'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":5.2,"reb":3.4,"ast":1.7,"stl":0.6,"blk":0.8,"tov":1.0,"fg":36.7,"fg3":30.4,"ft":69.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '8:ronald holland ii';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Paul Reed'
    , full_name = 'Paul Reed'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":11.4,"reb":7.4,"ast":2.1,"stl":1.1,"blk":0.9,"tov":1.9,"fg":56.5,"fg3":62.5,"ft":68.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '8:paul reed';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Isaiah Joe'
    , full_name = 'Isaiah Joe'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":7.3,"reb":1.7,"ast":1.0,"stl":0.3,"blk":0.3,"tov":0.7,"fg":36.8,"fg3":23.1,"ft":62.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '8:isaiah joe';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Taurean Prince'
    , full_name = 'Taurean Prince'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":2.0,"reb":1.0,"ast":0.0,"stl":1.0,"blk":0.0,"tov":0.0,"fg":33.3,"fg3":33.3,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '8:taurean prince';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '8:wendell moore jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Elijah Harkless'
    , full_name = 'Elijah Harkless'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '8:elijah harkless';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":3.2,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":71.4,"fg3":60.0,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '8:chaz lanier';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Daniss Jenkins'
    , full_name = 'Daniss Jenkins'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":12.7,"reb":3.6,"ast":4.7,"stl":0.8,"blk":0.1,"tov":1.6,"fg":45.2,"fg3":42.9,"ft":91.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '8:daniss jenkins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Kevin Huerter'
    , full_name = 'Kevin Huerter'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":8.8,"reb":2.5,"ast":2.3,"stl":0.9,"blk":1.0,"tov":0.8,"fg":44.0,"fg3":35.6,"ft":60.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '8:kevin huerter';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Javonte Green'
    , full_name = 'Javonte Green'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":6.2,"reb":2.4,"ast":0.6,"stl":0.7,"blk":0.4,"tov":0.0,"fg":38.8,"fg3":29.7,"ft":92.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '8:javonte green';

UPDATE public.nba_players
SET is_active = true
    , team_id = 8
    , name = 'Tolu Smith'
    , full_name = 'Tolu Smith'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":0.9,"reb":1.6,"ast":0.1,"stl":0.1,"blk":0.3,"tov":0.3,"fg":40.0,"fg3":null,"ft":33.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '8:tolu smith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Tyrese Haliburton'
    , full_name = 'Tyrese Haliburton'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":21.8,"reb":4.5,"ast":9.5,"stl":1.2,"blk":0.8,"tov":2.2,"fg":51.6,"fg3":37.0,"ft":86.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '9:tyrese haliburton';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Andrew Nembhard'
    , full_name = 'Andrew Nembhard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":17.1,"reb":2.1,"ast":7.6,"stl":0.6,"blk":0.2,"tov":2.3,"fg":45.6,"fg3":41.2,"ft":87.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '9:andrew nembhard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Aaron Nesmith'
    , full_name = 'Aaron Nesmith'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":12.8,"reb":2.3,"ast":1.8,"stl":0.9,"blk":0.3,"tov":1.7,"fg":38.1,"fg3":32.1,"ft":79.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '9:aaron nesmith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Pascal Siakam'
    , full_name = 'Pascal Siakam'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":22.2,"reb":6.8,"ast":4.3,"stl":1.0,"blk":0.1,"tov":2.1,"fg":52.1,"fg3":35.4,"ft":67.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '9:pascal siakam';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Ivica Zubac'
    , full_name = 'Ivica Zubac'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":9.0,"reb":7.7,"ast":1.8,"stl":0.0,"blk":0.5,"tov":1.7,"fg":56.8,"fg3":null,"ft":66.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '9:ivica zubac';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Obi Toppin'
    , full_name = 'Obi Toppin'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":13.4,"reb":5.0,"ast":1.6,"stl":0.2,"blk":0.2,"tov":0.8,"fg":51.9,"fg3":35.9,"ft":72.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '9:obi toppin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Braden Smith'
    , full_name = 'Braden Smith'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":4.3,"reb":0.7,"ast":2.7,"stl":1.1,"blk":0.4,"tov":1.1,"fg":44.8,"fg3":28.6,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '9:braden smith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Jarace Walker'
    , full_name = 'Jarace Walker'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":7.4,"reb":5.7,"ast":1.8,"stl":0.5,"blk":0.5,"tov":1.5,"fg":36.7,"fg3":31.0,"ft":58.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '9:jarace walker';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'T.J. McConnell'
    , full_name = 'T.J. McConnell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":4.0,"reb":1.0,"ast":2.0,"stl":0.5,"blk":0.5,"tov":2.5,"fg":57.1,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '9:t.j. mcconnell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Kelly Oubre Jr.'
    , full_name = 'Kelly Oubre Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":9.1,"reb":2.3,"ast":1.4,"stl":0.2,"blk":0.8,"tov":0.8,"fg":44.3,"fg3":24.2,"ft":70.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '9:kelly oubre jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Johnny Furphy'
    , full_name = 'Johnny Furphy'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '9:johnny furphy';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Jalen Slawson'
    , full_name = 'Jalen Slawson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":3.8,"reb":3.1,"ast":1.1,"stl":0.9,"blk":0.8,"tov":1.0,"fg":45.5,"fg3":20.0,"ft":70.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '9:jalen slawson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Larry Nance Jr.'
    , full_name = 'Larry Nance Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":4.6,"reb":2.8,"ast":0.6,"stl":1.0,"blk":0.2,"tov":0.7,"fg":43.2,"fg3":38.5,"ft":57.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '9:larry nance jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Kobe Brown'
    , full_name = 'Kobe Brown'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":5.6,"reb":2.8,"ast":1.2,"stl":0.2,"blk":0.0,"tov":0.6,"fg":45.5,"fg3":27.3,"ft":83.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '9:kobe brown';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Ben Sheppard'
    , full_name = 'Ben Sheppard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":3.0,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":33.3,"fg3":50.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '9:ben sheppard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Quenton Jackson'
    , full_name = 'Quenton Jackson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":10.0,"reb":3.6,"ast":2.6,"stl":1.4,"blk":0.3,"tov":1.3,"fg":48.8,"fg3":35.3,"ft":90.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '9:quenton jackson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 9
    , name = 'Jay Huff'
    , full_name = 'Jay Huff'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":7.1,"reb":3.8,"ast":1.0,"stl":0.0,"blk":0.8,"tov":0.7,"fg":49.0,"fg3":28.6,"ft":88.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '9:jay huff';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '9:ethan thompson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '9:taelon peter';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Ryan Rollins'
    , full_name = 'Ryan Rollins'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":11.0,"reb":4.5,"ast":4.1,"stl":0.7,"blk":0.4,"tov":2.1,"fg":39.8,"fg3":37.3,"ft":66.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '10:ryan rollins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Tyler Herro'
    , full_name = 'Tyler Herro'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":21.4,"reb":4.6,"ast":4.3,"stl":0.9,"blk":0.1,"tov":2.1,"fg":45.5,"fg3":39.7,"ft":77.5}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '10:tyler herro';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Jaime Jaquez Jr.'
    , full_name = 'Jaime Jaquez Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":15.3,"reb":5.7,"ast":2.7,"stl":0.5,"blk":0.1,"tov":2.0,"fg":48.1,"fg3":42.2,"ft":73.5}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '10:jaime jaquez jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Kyle Kuzma'
    , full_name = 'Kyle Kuzma'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":11.0,"reb":5.7,"ast":2.7,"stl":0.9,"blk":0.3,"tov":1.6,"fg":47.5,"fg3":33.3,"ft":58.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '10:kyle kuzma';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Myles Turner'
    , full_name = 'Myles Turner'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.7,"reb":5.5,"ast":2.7,"stl":0.5,"blk":2.4,"tov":2.0,"fg":32.9,"fg3":25.5,"ft":83.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '10:myles turner';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '10:malique lewis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Nate Ament'
    , full_name = 'Nate Ament'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":8.0,"reb":2.4,"ast":0.4,"stl":0.6,"blk":0.2,"tov":0.8,"fg":48.2,"fg3":40.0,"ft":57.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '10:nate ament';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Brayden Burries'
    , full_name = 'Brayden Burries'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":9.8,"reb":5.3,"ast":2.3,"stl":0.5,"blk":0.2,"tov":1.0,"fg":42.5,"fg3":22.5,"ft":73.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '10:brayden burries';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Jericho Sims'
    , full_name = 'Jericho Sims'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":0.6,"reb":0.7,"ast":0.1,"stl":0.0,"blk":0.0,"tov":0.1,"fg":50.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '10:jericho sims';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Gary Trent Jr.'
    , full_name = 'Gary Trent Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":3.7,"reb":0.3,"ast":0.3,"stl":0.3,"blk":0.0,"tov":0.3,"fg":44.4,"fg3":42.9,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '10:gary trent jr.';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '10:kevin porter jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Kam Jones'
    , full_name = 'Kam Jones'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '10:kam jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Caris LeVert'
    , full_name = 'Caris LeVert'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '10:caris levert';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Kel''el Ware'
    , full_name = 'Kel''el Ware'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.5,"reb":6.6,"ast":0.7,"stl":0.5,"blk":0.9,"tov":1.5,"fg":39.3,"fg3":20.0,"ft":78.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '10:kel''el ware';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '10:john butler jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'AJ Green'
    , full_name = 'AJ Green'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.8,"reb":1.7,"ast":1.4,"stl":0.2,"blk":0.2,"tov":0.7,"fg":42.4,"fg3":42.3,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '10:aj green';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Ousmane Dieng'
    , full_name = 'Ousmane Dieng'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":3.8,"reb":1.2,"ast":0.8,"stl":0.1,"blk":0.0,"tov":0.2,"fg":39.3,"fg3":31.2,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '10:ousmane dieng';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Bogoljub Markovic'
    , full_name = 'Bogoljub Markovic'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":1.0,"reb":1.5,"ast":0.5,"stl":0.0,"blk":0.0,"tov":0.0,"fg":100.0,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '10:bogoljub markovic';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Kasparas Jakucionis'
    , full_name = 'Kasparas Jakucionis'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.8,"reb":2.3,"ast":3.5,"stl":0.5,"blk":0.1,"tov":1.8,"fg":40.4,"fg3":23.3,"ft":84.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '10:kasparas jakučionis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Cormac Ryan'
    , full_name = 'Cormac Ryan'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '10:cormac ryan';

UPDATE public.nba_players
SET is_active = true
    , team_id = 10
    , name = 'Pete Nance'
    , full_name = 'Pete Nance'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '10:pete nance';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Davion Mitchell'
    , full_name = 'Davion Mitchell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":16.5,"reb":2.0,"ast":8.5,"stl":1.3,"blk":0.5,"tov":2.5,"fg":49.6,"fg3":40.3,"ft":69.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '11:davion mitchell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Tim Hardaway Jr.'
    , full_name = 'Tim Hardaway Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":4.6,"reb":1.3,"ast":0.6,"stl":0.2,"blk":0.4,"tov":0.7,"fg":26.9,"fg3":23.7,"ft":69.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '11:tim hardaway jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Andrew Wiggins'
    , full_name = 'Andrew Wiggins'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.7,"reb":2.8,"ast":1.5,"stl":0.5,"blk":0.7,"tov":1.1,"fg":42.2,"fg3":33.3,"ft":71.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '11:andrew wiggins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Giannis Antetokounmpo'
    , full_name = 'Giannis Antetokounmpo'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":27.7,"reb":12.6,"ast":5.2,"stl":0.9,"blk":1.0,"tov":3.4,"fg":56.7,"fg3":22.2,"ft":61.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '11:giannis antetokounmpo';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Bam Adebayo'
    , full_name = 'Bam Adebayo'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":17.8,"reb":8.4,"ast":3.3,"stl":2.2,"blk":0.7,"tov":1.6,"fg":50.7,"fg3":17.1,"ft":75.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '11:bam adebayo';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '11:j''vonne hadley';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Simone Fontecchio'
    , full_name = 'Simone Fontecchio'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":1.2,"reb":0.4,"ast":0.0,"stl":0.0,"blk":0.2,"tov":0.0,"fg":20.0,"fg3":12.5,"ft":33.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '11:simone fontecchio';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '11:trevor keels';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Ryan Conwell'
    , full_name = 'Ryan Conwell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":4.2,"reb":1.2,"ast":1.2,"stl":0.7,"blk":0.0,"tov":0.3,"fg":34.3,"fg3":34.6,"ft":83.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '11:ryan conwell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Nikola Jovic'
    , full_name = 'Nikola Jovic'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":2.4,"reb":2.6,"ast":1.0,"stl":0.3,"blk":0.4,"tov":0.4,"fg":30.0,"fg3":10.0,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '11:nikola jović';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Nick Richards'
    , full_name = 'Nick Richards'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":1.4,"reb":0.4,"ast":0.2,"stl":0.0,"blk":0.0,"tov":0.2,"fg":100.0,"fg3":100.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '11:nick richards';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Pelle Larsson'
    , full_name = 'Pelle Larsson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":11.4,"reb":3.5,"ast":3.5,"stl":1.3,"blk":0.1,"tov":1.9,"fg":46.8,"fg3":46.9,"ft":90.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '11:pelle larsson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Klay Thompson'
    , full_name = 'Klay Thompson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":14.4,"reb":1.5,"ast":1.9,"stl":0.2,"blk":0.7,"tov":1.1,"fg":42.9,"fg3":40.8,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '11:klay thompson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Dru Smith'
    , full_name = 'Dru Smith'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":2.5,"reb":1.0,"ast":1.3,"stl":0.5,"blk":0.0,"tov":0.8,"fg":44.4,"fg3":50.0,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '11:dru smith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Myron Gardner'
    , full_name = 'Myron Gardner'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":1.3,"reb":1.0,"ast":0.3,"stl":0.0,"blk":0.2,"tov":0.3,"fg":50.0,"fg3":0.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '11:myron gardner';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Keshad Johnson'
    , full_name = 'Keshad Johnson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '11:keshad johnson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '11:jahmir young';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Tre Donaldson'
    , full_name = 'Tre Donaldson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '11:tre donaldson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 11
    , name = 'Vladislav Goldin'
    , full_name = 'Vladislav Goldin'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '11:vladislav goldin';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '11:bobby portis jr.';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '11:bez mbeng';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'CJ McCollum'
    , full_name = 'CJ McCollum'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":13.6,"reb":2.8,"ast":3.9,"stl":1.0,"blk":0.5,"tov":2.2,"fg":41.4,"fg3":35.5,"ft":84.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '12:c.j. mccollum';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Nickeil Alexander-Walker'
    , full_name = 'Nickeil Alexander-Walker'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":21.9,"reb":3.2,"ast":2.6,"stl":1.4,"blk":0.3,"tov":2.0,"fg":41.7,"fg3":37.3,"ft":86.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '12:nickeil alexander-walker';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Dyson Daniels'
    , full_name = 'Dyson Daniels'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":9.8,"reb":7.1,"ast":5.8,"stl":3.0,"blk":0.3,"tov":1.2,"fg":48.1,"fg3":12.5,"ft":57.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '12:dyson daniels';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Jalen Johnson'
    , full_name = 'Jalen Johnson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":19.2,"reb":8.6,"ast":7.2,"stl":1.0,"blk":0.6,"tov":3.2,"fg":44.9,"fg3":20.5,"ft":82.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '12:jalen johnson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Onyeka Okongwu'
    , full_name = 'Onyeka Okongwu'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":13.7,"reb":8.1,"ast":2.8,"stl":0.9,"blk":0.8,"tov":1.0,"fg":49.2,"fg3":32.7,"ft":73.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '12:onyeka okongwu';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Keshon Gilbert'
    , full_name = 'Keshon Gilbert'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '12:keshon gilbert';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'RayJ Dennis'
    , full_name = 'RayJ Dennis'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":4.0,"reb":2.0,"ast":2.0,"stl":0.0,"blk":1.0,"tov":0.0,"fg":50.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '12:rayj dennis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Kingston Flemings'
    , full_name = 'Kingston Flemings'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.5,"reb":2.6,"ast":4.4,"stl":0.7,"blk":0.4,"tov":2.3,"fg":52.1,"fg3":42.9,"ft":72.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '12:kingston flemings';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Dorian Finney-Smith'
    , full_name = 'Dorian Finney-Smith'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":1.0,"reb":0.7,"ast":0.3,"stl":0.0,"blk":0.0,"tov":0.3,"fg":33.3,"fg3":33.3,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '12:dorian finney-smith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Ryan Nembhard'
    , full_name = 'Ryan Nembhard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":3.0,"reb":0.3,"ast":0.7,"stl":0.0,"blk":0.0,"tov":0.3,"fg":60.0,"fg3":100.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '12:ryan nembhard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Henri Veesaar'
    , full_name = 'Henri Veesaar'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '12:henri veesaar';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Asa Newell'
    , full_name = 'Asa Newell'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":3.6,"reb":2.6,"ast":1.0,"stl":0.2,"blk":0.2,"tov":0.8,"fg":46.7,"fg3":25.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '12:asa newell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Mouhamed Gueye'
    , full_name = 'Mouhamed Gueye'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '12:mouhamed gueye';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Zuby Ejiofor'
    , full_name = 'Zuby Ejiofor'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":4.9,"reb":3.0,"ast":1.3,"stl":0.4,"blk":0.3,"tov":0.7,"fg":58.3,"fg3":44.4,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '12:zuby ejiofor';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Aaron Wiggins'
    , full_name = 'Aaron Wiggins'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":14.9,"reb":3.7,"ast":2.4,"stl":0.9,"blk":0.3,"tov":1.3,"fg":46.3,"fg3":41.9,"ft":63.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '12:aaron wiggins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Jalen Wilson'
    , full_name = 'Jalen Wilson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '12:jalen wilson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Corey Kispert'
    , full_name = 'Corey Kispert'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":7.7,"reb":0.7,"ast":0.7,"stl":0.2,"blk":0.0,"tov":0.5,"fg":63.0,"fg3":55.6,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '12:corey kispert';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Jock Landale'
    , full_name = 'Jock Landale'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":6.1,"reb":4.9,"ast":1.9,"stl":0.1,"blk":0.5,"tov":1.2,"fg":46.3,"fg3":22.2,"ft":58.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '12:jock landale';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":12.3,"reb":5.5,"ast":2.7,"stl":1.1,"blk":0.8,"tov":1.1,"fg":43.6,"fg3":40.8,"ft":52.8}'::jsonb, true)
    , updated_at = now()
WHERE id = '12:jonathan kuminga';

UPDATE public.nba_players
SET is_active = true
    , team_id = 12
    , name = 'Luguentz Dort'
    , full_name = 'Luguentz Dort'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":9.3,"reb":3.2,"ast":1.8,"stl":0.9,"blk":0.2,"tov":0.7,"fg":36.6,"fg3":35.0,"ft":77.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '12:luguentz dort';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Coby White'
    , full_name = 'Coby White'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":7.0,"reb":2.0,"ast":3.8,"stl":0.0,"blk":0.2,"tov":2.8,"fg":23.7,"fg3":10.0,"ft":88.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '13:coby white';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Kon Knueppel'
    , full_name = 'Kon Knueppel'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":3.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":2.0,"fg":0.0,"fg3":0.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '13:kon knueppel';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Brandon Miller'
    , full_name = 'Brandon Miller'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":20.6,"reb":5.0,"ast":2.2,"stl":1.1,"blk":0.7,"tov":2.3,"fg":35.6,"fg3":26.0,"ft":86.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '13:brandon miller';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Naz Reid'
    , full_name = 'Naz Reid'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":17.4,"reb":8.5,"ast":2.1,"stl":0.7,"blk":0.5,"tov":2.6,"fg":41.1,"fg3":36.5,"ft":64.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '13:naz reid';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Moussa Diabate'
    , full_name = 'Moussa Diabate'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":8.9,"reb":9.1,"ast":2.0,"stl":1.6,"blk":0.9,"tov":1.8,"fg":63.5,"fg3":null,"ft":73.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '13:moussa diabaté';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Michael Ajayi'
    , full_name = 'Michael Ajayi'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '13:michael ajayi';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Kylan Boswell'
    , full_name = 'Kylan Boswell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '13:kylan boswell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Royce O''Neale'
    , full_name = 'Royce O''Neale'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":5.2,"reb":3.1,"ast":0.7,"stl":0.7,"blk":0.2,"tov":0.4,"fg":35.2,"fg3":29.2,"ft":83.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '13:royce o''neale';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Grant Williams'
    , full_name = 'Grant Williams'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '13:grant williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Sion James'
    , full_name = 'Sion James'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.3,"reb":3.1,"ast":2.6,"stl":0.8,"blk":0.0,"tov":0.8,"fg":33.8,"fg3":26.9,"ft":77.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '13:sion james';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Christian Anderson'
    , full_name = 'Christian Anderson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":3.4,"reb":1.6,"ast":1.7,"stl":0.3,"blk":0.3,"tov":1.9,"fg":31.8,"fg3":19.2,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '13:christian anderson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Grayson Allen'
    , full_name = 'Grayson Allen'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":15.3,"reb":2.8,"ast":3.0,"stl":0.7,"blk":0.4,"tov":2.4,"fg":46.2,"fg3":46.9,"ft":91.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '13:grayson allen';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Dennis Schroder'
    , full_name = 'Dennis Schroder'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":10.2,"reb":3.6,"ast":4.9,"stl":0.8,"blk":0.1,"tov":3.2,"fg":36.4,"fg3":20.0,"ft":87.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '13:dennis schröder';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Ryan Kalkbrenner'
    , full_name = 'Ryan Kalkbrenner'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":4.8,"reb":5.4,"ast":1.5,"stl":0.4,"blk":1.3,"tov":1.3,"fg":72.4,"fg3":null,"ft":91.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '13:ryan kalkbrenner';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '13:antonio reeves';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'PJ Hall'
    , full_name = 'PJ Hall'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":0.0,"reb":1.0,"ast":1.5,"stl":0.0,"blk":0.5,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '13:pj hall';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '13:pat connaughton';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '13:bez mbeng';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Hannes Steinbach'
    , full_name = 'Hannes Steinbach'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.8,"reb":4.2,"ast":0.4,"stl":0.0,"blk":0.6,"tov":0.8,"fg":43.8,"fg3":null,"ft":0.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '13:hannes steinbach';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '13:xavier tillman';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Tidjane Salaun'
    , full_name = 'Tidjane Salaun'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":6.9,"reb":3.4,"ast":0.1,"stl":0.6,"blk":0.2,"tov":0.4,"fg":46.0,"fg3":40.0,"ft":69.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '13:tidjane salaün';

UPDATE public.nba_players
SET is_active = true
    , team_id = 13
    , name = 'Liam McNeeley'
    , full_name = 'Liam McNeeley'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":3.8,"reb":1.7,"ast":0.8,"stl":0.2,"blk":0.0,"tov":0.8,"fg":29.2,"fg3":25.0,"ft":85.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '13:liam mcneeley';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '13:mouhamadou gueye';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Jalen Suggs'
    , full_name = 'Jalen Suggs'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":8.0,"reb":5.0,"ast":5.7,"stl":2.0,"blk":0.3,"tov":3.0,"fg":35.7,"fg3":11.1,"ft":75.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '14:jalen suggs';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Desmond Bane'
    , full_name = 'Desmond Bane'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":17.2,"reb":4.1,"ast":2.4,"stl":0.8,"blk":0.7,"tov":2.6,"fg":37.1,"fg3":36.0,"ft":80.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '14:desmond bane';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Franz Wagner'
    , full_name = 'Franz Wagner'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":22.0,"reb":6.4,"ast":8.6,"stl":1.4,"blk":0.0,"tov":4.4,"fg":44.5,"fg3":22.9,"ft":81.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '14:franz wagner';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Paolo Banchero'
    , full_name = 'Paolo Banchero'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":24.5,"reb":6.5,"ast":7.5,"stl":1.0,"blk":0.0,"tov":4.0,"fg":69.6,"fg3":50.0,"ft":70.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '14:paolo banchero';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Wendell Carter Jr.'
    , full_name = 'Wendell Carter Jr.'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":14.1,"reb":9.7,"ast":1.0,"stl":1.1,"blk":0.9,"tov":1.7,"fg":61.0,"fg3":44.0,"ft":73.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '14:wendell carter jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Anthony Black'
    , full_name = 'Anthony Black'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":17.1,"reb":5.9,"ast":5.1,"stl":2.0,"blk":0.7,"tov":2.9,"fg":48.8,"fg3":42.4,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '14:anthony black';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Jonathan Isaac'
    , full_name = 'Jonathan Isaac'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '14:jonathan isaac';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Jevon Carter'
    , full_name = 'Jevon Carter'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":3.3,"reb":0.5,"ast":1.3,"stl":0.5,"blk":0.0,"tov":0.3,"fg":30.4,"fg3":31.6,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '14:jevon carter';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '14:jd davison';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '14:malaki branham';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Jamal Cain'
    , full_name = 'Jamal Cain'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.0,"reb":3.1,"ast":0.4,"stl":0.4,"blk":0.1,"tov":1.3,"fg":41.4,"fg3":29.7,"ft":91.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '14:jamal cain';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Nikola Vucevic'
    , full_name = 'Nikola Vucevic'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":2.7,"reb":2.6,"ast":1.2,"stl":0.0,"blk":0.5,"tov":0.4,"fg":37.9,"fg3":25.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '14:nikola vučević';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Jase Richardson'
    , full_name = 'Jase Richardson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":5.9,"reb":2.0,"ast":2.5,"stl":0.7,"blk":0.5,"tov":0.8,"fg":32.9,"fg3":23.3,"ft":85.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '14:jase richardson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Colin Castleton'
    , full_name = 'Colin Castleton'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":3.0,"reb":1.3,"ast":0.7,"stl":0.0,"blk":0.3,"tov":0.3,"fg":66.7,"fg3":null,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '14:colin castleton';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Tristan da Silva'
    , full_name = 'Tristan da Silva'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":15.1,"reb":3.7,"ast":1.7,"stl":0.3,"blk":0.3,"tov":1.4,"fg":45.5,"fg3":40.0,"ft":40.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '14:tristan da silva';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Izaiyah Nelson'
    , full_name = 'Izaiyah Nelson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '14:izaiyah nelson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Alex Morales'
    , full_name = 'Alex Morales'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":1.7,"reb":2.1,"ast":0.3,"stl":0.4,"blk":0.0,"tov":0.4,"fg":45.5,"fg3":20.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '14:alex morales';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Goga Bitadze'
    , full_name = 'Goga Bitadze'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":3.5,"reb":3.2,"ast":0.6,"stl":0.1,"blk":0.4,"tov":0.4,"fg":56.2,"fg3":null,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '14:goga bitadze';

UPDATE public.nba_players
SET is_active = true
    , team_id = 14
    , name = 'Noah Penda'
    , full_name = 'Noah Penda'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '14:noah penda';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Trae Young'
    , full_name = 'Trae Young'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":18.5,"reb":3.2,"ast":8.7,"stl":1.2,"blk":0.2,"tov":3.4,"fg":39.3,"fg3":28.8,"ft":82.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '15:trae young';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Kyshawn George'
    , full_name = 'Kyshawn George'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":17.9,"reb":4.4,"ast":4.9,"stl":0.5,"blk":1.4,"tov":3.1,"fg":48.7,"fg3":36.9,"ft":79.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '15:kyshawn george';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Bilal Coulibaly'
    , full_name = 'Bilal Coulibaly'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.2,"reb":3.7,"ast":0.7,"stl":1.2,"blk":1.0,"tov":0.7,"fg":47.5,"fg3":16.7,"ft":75.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '15:bilal coulibaly';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Alex Sarr'
    , full_name = 'Alex Sarr'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":9.9,"reb":7.2,"ast":1.8,"stl":1.1,"blk":1.0,"tov":1.2,"fg":48.8,"fg3":19.4,"ft":78.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '15:alex sarr';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Anthony Davis'
    , full_name = 'Anthony Davis'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":25.7,"reb":9.7,"ast":2.0,"stl":1.3,"blk":1.0,"tov":2.1,"fg":53.3,"fg3":37.5,"ft":84.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '15:anthony davis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Felix Okpara'
    , full_name = 'Felix Okpara'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":1.0,"reb":0.7,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":50.0,"fg3":null,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '15:felix okpara';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Tristan Vukcevic'
    , full_name = 'Tristan Vukcevic'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '15:tristan vukcevic';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'AJ Dybantsa'
    , full_name = 'AJ Dybantsa'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":16.7,"reb":6.1,"ast":2.1,"stl":1.1,"blk":0.3,"tov":2.1,"fg":43.3,"fg3":27.3,"ft":77.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '15:aj dybantsa';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Jamir Watkins'
    , full_name = 'Jamir Watkins'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '15:jamir watkins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Deandre Ayton'
    , full_name = 'Deandre Ayton'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":5.0,"reb":5.1,"ast":0.9,"stl":0.2,"blk":0.4,"tov":0.5,"fg":66.7,"fg3":null,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '15:deandre ayton';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Bub Carrington'
    , full_name = 'Bub Carrington'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":5.5,"reb":1.9,"ast":2.2,"stl":0.7,"blk":0.2,"tov":0.6,"fg":39.6,"fg3":48.6,"ft":85.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '15:bub carrington';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Justin Champagnie'
    , full_name = 'Justin Champagnie'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":7.2,"reb":7.5,"ast":1.2,"stl":0.5,"blk":0.5,"tov":0.0,"fg":60.0,"fg3":28.6,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '15:justin champagnie';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Tre Johnson'
    , full_name = 'Tre Johnson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":8.8,"reb":1.8,"ast":0.8,"stl":0.5,"blk":0.1,"tov":0.8,"fg":35.1,"fg3":24.5,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '15:tre johnson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '15:sharife cooper';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Anthony Gill'
    , full_name = 'Anthony Gill'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":0.3,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '15:anthony gill';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Khris Middleton'
    , full_name = 'Khris Middleton'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.4,"reb":1.6,"ast":0.4,"stl":0.4,"blk":0.0,"tov":1.2,"fg":33.3,"fg3":20.0,"ft":83.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '15:khris middleton';

UPDATE public.nba_players
SET is_active = true
    , team_id = 15
    , name = 'Will Riley'
    , full_name = 'Will Riley'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":1.8,"reb":0.2,"ast":0.3,"stl":0.0,"blk":0.1,"tov":0.2,"fg":40.0,"fg3":12.5,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '15:will riley';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Jamal Murray'
    , full_name = 'Jamal Murray'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":25.8,"reb":5.1,"ast":5.7,"stl":1.0,"blk":0.8,"tov":2.4,"fg":49.3,"fg3":50.7,"ft":85.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '16:jamal murray';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Christian Braun'
    , full_name = 'Christian Braun'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":12.4,"reb":4.0,"ast":2.2,"stl":2.1,"blk":0.1,"tov":1.3,"fg":50.0,"fg3":34.1,"ft":75.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '16:christian braun';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'DeMar DeRozan'
    , full_name = 'DeMar DeRozan'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":10.2,"reb":2.1,"ast":2.9,"stl":0.8,"blk":0.1,"tov":1.1,"fg":40.6,"fg3":16.7,"ft":82.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '16:demar derozan';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Aaron Gordon'
    , full_name = 'Aaron Gordon'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":11.2,"reb":5.2,"ast":2.1,"stl":1.0,"blk":0.3,"tov":1.4,"fg":39.5,"fg3":27.8,"ft":79.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '16:aaron gordon';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Nikola Jokic'
    , full_name = 'Nikola Jokic'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":23.1,"reb":10.8,"ast":9.1,"stl":1.9,"blk":1.2,"tov":3.2,"fg":48.8,"fg3":22.5,"ft":89.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '16:nikola jokić';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Trevon Brazile'
    , full_name = 'Trevon Brazile'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":7.1,"reb":5.7,"ast":0.6,"stl":0.7,"blk":0.4,"tov":0.7,"fg":54.3,"fg3":31.8,"ft":53.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '16:trevon brazile';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Bryce Hopkins'
    , full_name = 'Bryce Hopkins'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":5.4,"reb":2.0,"ast":0.4,"stl":0.3,"blk":0.0,"tov":0.7,"fg":63.6,"fg3":40.0,"ft":72.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '16:bryce hopkins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Alpha Diallo'
    , full_name = 'Alpha Diallo'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":1.0,"reb":0.8,"ast":0.5,"stl":0.2,"blk":0.0,"tov":0.8,"fg":33.3,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '16:alpha diallo';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '16:curtis jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Julian Strawther'
    , full_name = 'Julian Strawther'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '16:julian strawther';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Tyus Jones'
    , full_name = 'Tyus Jones'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":2.8,"reb":0.6,"ast":1.8,"stl":0.7,"blk":0.1,"tov":0.3,"fg":36.4,"fg3":27.3,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '16:tyus jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'DaRon Holmes II'
    , full_name = 'DaRon Holmes II'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":0.8,"reb":0.2,"ast":0.5,"stl":0.2,"blk":0.0,"tov":0.2,"fg":33.3,"fg3":33.3,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '16:daron holmes ii';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '16:lonnie walker iv';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Spencer Jones'
    , full_name = 'Spencer Jones'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":6.5,"reb":3.0,"ast":0.5,"stl":0.0,"blk":1.0,"tov":0.0,"fg":55.6,"fg3":60.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '16:spencer jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Zeke Nnaji'
    , full_name = 'Zeke Nnaji'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":3.5,"reb":0.5,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":100.0,"fg3":100.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '16:zeke nnaji';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Cameron Johnson'
    , full_name = 'Cameron Johnson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":10.3,"reb":3.8,"ast":1.7,"stl":1.2,"blk":0.0,"tov":1.5,"fg":46.9,"fg3":40.0,"ft":57.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '16:cameron johnson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '16:kj simpson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 16
    , name = 'Marvin Bagley III'
    , full_name = 'Marvin Bagley III'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":6.0,"reb":3.4,"ast":0.6,"stl":0.2,"blk":0.4,"tov":0.6,"fg":57.6,"fg3":0.0,"ft":72.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '16:marvin bagley iii';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '16:david roddy';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'LaMelo Ball'
    , full_name = 'LaMelo Ball'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":18.3,"reb":3.3,"ast":6.0,"stl":1.7,"blk":0.1,"tov":4.0,"fg":44.9,"fg3":38.5,"ft":80.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '17:lamelo ball';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Anthony Edwards'
    , full_name = 'Anthony Edwards'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":33.2,"reb":4.8,"ast":3.5,"stl":2.0,"blk":0.8,"tov":3.5,"fg":48.1,"fg3":40.0,"ft":75.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '17:anthony edwards';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Jaden McDaniels'
    , full_name = 'Jaden McDaniels'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":17.0,"reb":6.1,"ast":3.6,"stl":0.9,"blk":0.8,"tov":2.0,"fg":51.3,"fg3":32.7,"ft":81.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '17:jaden mcdaniels';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Jonathan Kuminga'
    , full_name = 'Jonathan Kuminga'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":12.3,"reb":5.5,"ast":2.7,"stl":1.1,"blk":0.8,"tov":1.1,"fg":43.6,"fg3":40.8,"ft":52.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '17:jonathan kuminga';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Rudy Gobert'
    , full_name = 'Rudy Gobert'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.8,"reb":12.1,"ast":1.4,"stl":0.3,"blk":0.9,"tov":1.2,"fg":50.0,"fg3":0.0,"ft":41.5}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '17:rudy gobert';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Donte DiVincenzo'
    , full_name = 'Donte DiVincenzo'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '17:donte divincenzo';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '17:terance shannon jr';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Cody Williams'
    , full_name = 'Cody Williams'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":0.0,"reb":0.2,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '17:cody williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Jaylen Clark'
    , full_name = 'Jaylen Clark'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":4.7,"reb":1.9,"ast":0.7,"stl":0.9,"blk":0.2,"tov":0.5,"fg":40.5,"fg3":38.1,"ft":64.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '17:jaylen clark';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Bones Hyland'
    , full_name = 'Bones Hyland'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.5,"reb":1.3,"ast":2.5,"stl":0.7,"blk":0.5,"tov":0.7,"fg":44.0,"fg3":34.0,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '17:bones hyland';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Ayo Dosunmu'
    , full_name = 'Ayo Dosunmu'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":18.1,"reb":4.9,"ast":4.0,"stl":1.3,"blk":0.5,"tov":2.3,"fg":52.1,"fg3":46.7,"ft":89.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '17:ayo dosunmu';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '17:trey kaufman-renn';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Zyon Pullin'
    , full_name = 'Zyon Pullin'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":2.0,"reb":0.5,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":100.0,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '17:zyon pullin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Joan Beringer'
    , full_name = 'Joan Beringer'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":5.6,"reb":6.2,"ast":0.6,"stl":0.3,"blk":0.8,"tov":0.6,"fg":58.1,"fg3":null,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '17:joan beringer';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '17:enrique freeman';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Isaiah Evans'
    , full_name = 'Isaiah Evans'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":0.0,"reb":0.2,"ast":0.4,"stl":0.0,"blk":0.0,"tov":0.2,"fg":0.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '17:isaiah evans';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Trey Lyles'
    , full_name = 'Trey Lyles'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.4,"reb":4.3,"ast":0.9,"stl":0.5,"blk":0.3,"tov":0.5,"fg":47.1,"fg3":32.4,"ft":61.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '17:trey lyles';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Rocco Zikarsky'
    , full_name = 'Rocco Zikarsky'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":1.0,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '17:rocco zikarsky';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '17:john konchar';

UPDATE public.nba_players
SET is_active = true
    , team_id = 17
    , name = 'Terrence Shannon Jr.'
    , full_name = 'Terrence Shannon Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":11.1,"reb":3.5,"ast":2.6,"stl":0.4,"blk":0.1,"tov":1.2,"fg":39.4,"fg3":36.1,"ft":72.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '17:terrence shannon jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Shai Gilgeous-Alexander'
    , full_name = 'Shai Gilgeous-Alexander'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":29.5,"reb":4.3,"ast":4.7,"stl":0.9,"blk":1.1,"tov":2.2,"fg":45.3,"fg3":37.0,"ft":86.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '18:shai gilgeous-alexander';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Cason Wallace'
    , full_name = 'Cason Wallace'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":6.3,"reb":2.7,"ast":1.3,"stl":2.3,"blk":0.0,"tov":1.0,"fg":40.0,"fg3":30.0,"ft":null}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '18:cason wallace';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Jalen Williams'
    , full_name = 'Jalen Williams'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":13.7,"reb":4.7,"ast":3.3,"stl":1.3,"blk":0.7,"tov":1.3,"fg":38.5,"fg3":33.3,"ft":80.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '18:jalen williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Chet Holmgren'
    , full_name = 'Chet Holmgren'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":12.0,"reb":9.3,"ast":1.3,"stl":0.7,"blk":3.0,"tov":1.7,"fg":40.7,"fg3":33.3,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '18:chet holmgren';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Isaiah Hartenstein'
    , full_name = 'Isaiah Hartenstein'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.9,"reb":10.0,"ast":3.5,"stl":1.1,"blk":0.4,"tov":1.4,"fg":44.9,"fg3":0.0,"ft":82.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '18:isaiah hartenstein';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Josh Dix'
    , full_name = 'Josh Dix'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":2.7,"reb":1.2,"ast":0.3,"stl":0.3,"blk":0.2,"tov":0.3,"fg":33.3,"fg3":16.7,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '18:josh dix';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Jared McCain'
    , full_name = 'Jared McCain'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":12.9,"reb":3.4,"ast":1.8,"stl":0.9,"blk":0.3,"tov":1.7,"fg":42.6,"fg3":32.8,"ft":85.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '18:jared mccain';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Jaylin Williams'
    , full_name = 'Jaylin Williams'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":2.9,"reb":4.0,"ast":1.6,"stl":0.4,"blk":0.0,"tov":0.6,"fg":20.0,"fg3":20.8,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '18:jaylin williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Alex Caruso'
    , full_name = 'Alex Caruso'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":6.8,"reb":4.2,"ast":3.0,"stl":0.8,"blk":0.5,"tov":0.8,"fg":47.2,"fg3":44.0,"ft":90.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '18:alex caruso';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Thomas Sorber'
    , full_name = 'Thomas Sorber'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '18:thomas sorber';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '18:otega oweh';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Bennett Stirtz'
    , full_name = 'Bennett Stirtz'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.1,"reb":1.2,"ast":1.2,"stl":0.5,"blk":0.1,"tov":0.5,"fg":49.2,"fg3":46.2,"ft":91.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '18:bennett stirtz';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Aday Mara'
    , full_name = 'Aday Mara'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.3,"reb":6.3,"ast":1.4,"stl":0.1,"blk":1.8,"tov":1.5,"fg":61.5,"fg3":100.0,"ft":55.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '18:aday mara';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Brooks Barnhizer'
    , full_name = 'Brooks Barnhizer'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":1.2,"reb":1.1,"ast":0.9,"stl":0.2,"blk":0.1,"tov":0.2,"fg":42.9,"fg3":0.0,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '18:brooks barnhizer';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Ajay Mitchell'
    , full_name = 'Ajay Mitchell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":18.5,"reb":3.6,"ast":3.3,"stl":1.2,"blk":0.4,"tov":1.5,"fg":52.3,"fg3":26.5,"ft":84.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '18:ajay mitchell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Kenrich Williams'
    , full_name = 'Kenrich Williams'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.5,"reb":3.6,"ast":1.1,"stl":0.1,"blk":0.1,"tov":0.4,"fg":46.3,"fg3":48.4,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '18:kenrich williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Nikola Topic'
    , full_name = 'Nikola Topic'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '18:nikola topić';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Damian Lillard'
    , full_name = 'Damian Lillard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":20.0,"reb":3.2,"ast":4.3,"stl":0.8,"blk":0.1,"tov":2.1,"fg":43.4,"fg3":34.9,"ft":85.5}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '19:damian lillard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Ja Morant'
    , full_name = 'Ja Morant'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":15.8,"reb":2.5,"ast":5.5,"stl":1.0,"blk":0.0,"tov":1.2,"fg":54.2,"fg3":42.9,"ft":83.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '19:ja morant';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Deni Avdija'
    , full_name = 'Deni Avdija'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":22.5,"reb":6.4,"ast":6.5,"stl":0.9,"blk":0.1,"tov":3.0,"fg":47.7,"fg3":34.7,"ft":67.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '19:deni avdija';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '19:jeremy sochan';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Donovan Clingan'
    , full_name = 'Donovan Clingan'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":11.4,"reb":10.3,"ast":1.5,"stl":0.3,"blk":2.1,"tov":1.4,"fg":57.7,"fg3":45.8,"ft":65.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '19:donovan clingan';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Jayson Kent'
    , full_name = 'Jayson Kent'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":2.0,"reb":1.0,"ast":0.5,"stl":1.5,"blk":0.0,"tov":1.5,"fg":20.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '19:jayson kent';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Scoot Henderson'
    , full_name = 'Scoot Henderson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":8.7,"reb":2.1,"ast":1.5,"stl":0.6,"blk":0.1,"tov":2.4,"fg":31.7,"fg3":22.0,"ft":81.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '19:scoot henderson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Chris Youngblood'
    , full_name = 'Chris Youngblood'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":6.0,"reb":1.3,"ast":1.0,"stl":0.5,"blk":0.2,"tov":0.8,"fg":37.0,"fg3":34.8,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '19:chris youngblood';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Jrue Holiday'
    , full_name = 'Jrue Holiday'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":12.8,"reb":3.3,"ast":3.8,"stl":0.9,"blk":0.2,"tov":1.3,"fg":51.2,"fg3":41.8,"ft":86.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '19:jrue holiday';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'John Tonje'
    , full_name = 'John Tonje'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":5.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":50.0,"fg3":50.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '19:john tonje';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Micah Potter'
    , full_name = 'Micah Potter'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":3.0,"reb":2.2,"ast":0.2,"stl":0.2,"blk":0.2,"tov":0.7,"fg":50.0,"fg3":33.3,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '19:micah potter';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Branden Carlson'
    , full_name = 'Branden Carlson'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.0,"reb":2.2,"ast":0.4,"stl":0.0,"blk":0.8,"tov":0.6,"fg":50.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '19:branden carlson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Yang Hansen'
    , full_name = 'Yang Hansen'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":4.0,"reb":3.0,"ast":0.4,"stl":0.3,"blk":0.1,"tov":1.0,"fg":47.1,"fg3":55.6,"ft":87.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '19:yang hansen';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Shaedon Sharpe'
    , full_name = 'Shaedon Sharpe'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '19:shaedon sharpe';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Vit Krejci'
    , full_name = 'Vit Krejci'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":2.7,"reb":1.6,"ast":1.1,"stl":0.4,"blk":0.0,"tov":0.3,"fg":30.0,"fg3":20.0,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '19:vít krejčí';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Toumani Camara'
    , full_name = 'Toumani Camara'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":13.0,"reb":3.3,"ast":1.3,"stl":0.7,"blk":0.2,"tov":1.2,"fg":50.0,"fg3":43.5,"ft":71.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '19:toumani camara';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Robert Williams III'
    , full_name = 'Robert Williams III'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":7.2,"reb":6.5,"ast":1.0,"stl":0.9,"blk":1.1,"tov":0.9,"fg":66.7,"fg3":null,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '19:robert williams iii';

UPDATE public.nba_players
SET is_active = true
    , team_id = 19
    , name = 'Sidy Cissoko'
    , full_name = 'Sidy Cissoko'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.2,"reb":3.7,"ast":2.2,"stl":0.5,"blk":0.3,"tov":0.5,"fg":44.0,"fg3":32.4,"ft":70.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '19:sidy cissoko';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Keyonte George'
    , full_name = 'Keyonte George'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":21.1,"reb":4.3,"ast":6.4,"stl":1.0,"blk":0.2,"tov":3.7,"fg":44.9,"fg3":30.5,"ft":79.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '20:keyonte george';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Josh Green'
    , full_name = 'Josh Green'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":3.7,"reb":1.8,"ast":1.1,"stl":0.3,"blk":0.1,"tov":0.4,"fg":37.5,"fg3":27.8,"ft":66.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '20:josh green';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Lauri Markkanen'
    , full_name = 'Lauri Markkanen'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":18.0,"reb":6.8,"ast":2.0,"stl":0.6,"blk":0.6,"tov":1.5,"fg":38.9,"fg3":39.7,"ft":84.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '20:lauri markkanen';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Jaren Jackson Jr.'
    , full_name = 'Jaren Jackson Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":16.2,"reb":5.0,"ast":2.0,"stl":0.2,"blk":1.2,"tov":3.0,"fg":50.0,"fg3":35.7,"ft":76.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '20:jaren jackson jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Jusuf Nurkic'
    , full_name = 'Jusuf Nurkic'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '20:jusuf nurkić';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '20:hayden gray';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Kyle Filipowski'
    , full_name = 'Kyle Filipowski'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":3.1,"reb":1.8,"ast":0.5,"stl":0.4,"blk":0.0,"tov":1.0,"fg":40.0,"fg3":33.3,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '20:kyle filipowski';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '20:blake hinson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '20:tamar bates';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Isaiah Collier'
    , full_name = 'Isaiah Collier'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":7.2,"reb":3.5,"ast":4.2,"stl":0.4,"blk":0.0,"tov":2.1,"fg":44.3,"fg3":33.3,"ft":56.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '20:isaiah collier';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Svi Mykhailiuk'
    , full_name = 'Svi Mykhailiuk'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":3.6,"reb":1.7,"ast":1.0,"stl":0.7,"blk":0.0,"tov":0.5,"fg":28.6,"fg3":20.6,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '20:svi mykhailiuk';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Jaxson Hayes'
    , full_name = 'Jaxson Hayes'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":8.3,"reb":5.9,"ast":1.8,"stl":0.9,"blk":1.6,"tov":1.5,"fg":62.7,"fg3":0.0,"ft":76.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '20:jaxson hayes';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Mo Bamba'
    , full_name = 'Mo Bamba'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":7.6,"reb":6.1,"ast":0.6,"stl":0.3,"blk":1.9,"tov":0.6,"fg":73.3,"fg3":null,"ft":69.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '20:mo bamba';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Ace Bailey'
    , full_name = 'Ace Bailey'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":12.9,"reb":6.5,"ast":1.9,"stl":0.6,"blk":1.2,"tov":1.9,"fg":47.7,"fg3":25.9,"ft":71.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '20:ace bailey';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Josh Okogie'
    , full_name = 'Josh Okogie'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":3.7,"reb":3.3,"ast":1.2,"stl":0.6,"blk":0.2,"tov":1.0,"fg":27.8,"fg3":31.2,"ft":92.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '20:josh okogie';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '20:darron peterson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Trey Alexander'
    , full_name = 'Trey Alexander'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '20:trey alexander';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Brice Sensabaugh'
    , full_name = 'Brice Sensabaugh'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":7.1,"reb":2.9,"ast":1.4,"stl":0.5,"blk":0.2,"tov":1.3,"fg":36.6,"fg3":39.5,"ft":91.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '20:brice sensabaugh';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Harrison Ingram'
    , full_name = 'Harrison Ingram'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '20:harrison ingram';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Darryn Peterson'
    , full_name = 'Darryn Peterson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":15.7,"reb":4.0,"ast":3.8,"stl":1.2,"blk":0.7,"tov":1.8,"fg":41.1,"fg3":37.7,"ft":86.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '20:darryn peterson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":0.0,"reb":0.2,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '20:cody williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Stephen Curry'
    , full_name = 'Stephen Curry'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":30.6,"reb":4.1,"ast":4.3,"stl":1.0,"blk":0.1,"tov":1.8,"fg":50.3,"fg3":45.7,"ft":98.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '21:stephen curry';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Brandin Podziemski'
    , full_name = 'Brandin Podziemski'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":16.8,"reb":5.0,"ast":4.2,"stl":1.2,"blk":0.6,"tov":1.3,"fg":48.2,"fg3":40.3,"ft":66.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '21:brandin podziemski';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '21:jimmy butler';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Draymond Green'
    , full_name = 'Draymond Green'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":2.8,"reb":4.9,"ast":7.6,"stl":1.0,"blk":0.9,"tov":3.1,"fg":37.0,"fg3":20.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '21:draymond green';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Kristaps Porzingis'
    , full_name = 'Kristaps Porzingis'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '21:kristaps porziņģis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Gary Payton II'
    , full_name = 'Gary Payton II'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":5.0,"reb":1.6,"ast":0.4,"stl":0.8,"blk":0.0,"tov":0.8,"fg":46.8,"fg3":22.2,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '21:gary payton ii';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Yaxel Lendeborg'
    , full_name = 'Yaxel Lendeborg'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":21.4,"reb":7.2,"ast":4.0,"stl":1.0,"blk":0.7,"tov":3.4,"fg":52.3,"fg3":44.3,"ft":75.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '21:yaxel lendeborg';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Will Richard'
    , full_name = 'Will Richard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":5.1,"reb":1.8,"ast":1.0,"stl":0.4,"blk":0.3,"tov":0.4,"fg":47.5,"fg3":42.9,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '21:will richard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Moses Moody'
    , full_name = 'Moses Moody'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '21:moses moody';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'De''Anthony Melton'
    , full_name = 'De''Anthony Melton'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":10.0,"reb":4.3,"ast":2.2,"stl":1.5,"blk":0.4,"tov":1.4,"fg":41.0,"fg3":42.9,"ft":81.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '21:de''anthony melton';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Brandon Williams'
    , full_name = 'Brandon Williams'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":10.4,"reb":2.1,"ast":2.3,"stl":0.9,"blk":0.4,"tov":1.5,"fg":41.2,"fg3":30.4,"ft":86.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '21:brandon williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Gui Santos'
    , full_name = 'Gui Santos'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":6.1,"reb":4.0,"ast":1.5,"stl":0.5,"blk":0.4,"tov":0.8,"fg":44.4,"fg3":30.8,"ft":65.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '21:gui santos';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'LJ Cryer'
    , full_name = 'LJ Cryer'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":4.0,"reb":0.3,"ast":1.3,"stl":0.0,"blk":0.0,"tov":0.3,"fg":40.0,"fg3":43.8,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '21:lj cryer';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '21:nate williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Al Horford'
    , full_name = 'Al Horford'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":5.0,"reb":4.0,"ast":1.9,"stl":0.4,"blk":1.0,"tov":0.7,"fg":43.6,"fg3":40.7,"ft":0.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '21:al horford';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":1.0,"reb":3.0,"ast":0.5,"stl":0.5,"blk":0.0,"tov":1.0,"fg":33.3,"fg3":0.0,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '21:dalen terry';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '21:alex toohey';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '21:lajae jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Charles Bassey'
    , full_name = 'Charles Bassey'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":7.7,"reb":5.7,"ast":0.6,"stl":0.1,"blk":1.0,"tov":0.8,"fg":65.9,"fg3":0.0,"ft":88.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '21:charles bassey';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '21:seth curry';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Georges Niang'
    , full_name = 'Georges Niang'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.3,"reb":2.9,"ast":1.6,"stl":0.6,"blk":0.2,"tov":1.3,"fg":48.6,"fg3":35.7,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '21:georges niang';

UPDATE public.nba_players
SET is_active = true
    , team_id = 21
    , name = 'Malevy Leons'
    , full_name = 'Malevy Leons'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":0.4,"reb":1.0,"ast":0.0,"stl":0.4,"blk":0.2,"tov":0.2,"fg":14.3,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '21:malevy leons';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Kris Dunn'
    , full_name = 'Kris Dunn'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":8.5,"reb":4.0,"ast":4.3,"stl":2.3,"blk":0.5,"tov":1.7,"fg":49.2,"fg3":41.7,"ft":88.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '22:kris dunn';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Darius Garland'
    , full_name = 'Darius Garland'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":20.4,"reb":1.8,"ast":6.9,"stl":0.6,"blk":0.0,"tov":5.0,"fg":46.7,"fg3":35.3,"ft":82.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '22:darius garland';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Brandon Ingram'
    , full_name = 'Brandon Ingram'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '22:brandon ingram';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Rui Hachimura'
    , full_name = 'Rui Hachimura'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":14.4,"reb":5.9,"ast":1.6,"stl":1.1,"blk":0.1,"tov":1.8,"fg":38.7,"fg3":36.7,"ft":68.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '22:rui hachimura';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Brook Lopez'
    , full_name = 'Brook Lopez'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":13.6,"reb":5.2,"ast":1.0,"stl":0.4,"blk":0.9,"tov":1.0,"fg":57.0,"fg3":43.3,"ft":65.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '22:brook lopez';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Gradey Dick'
    , full_name = 'Gradey Dick'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.3,"reb":3.0,"ast":0.7,"stl":0.7,"blk":0.2,"tov":0.8,"fg":50.9,"fg3":42.1,"ft":84.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '22:gradey dick';

UPDATE public.nba_players
SET is_active = true
    , team_id = 7
    , name = 'Norchad Omier'
    , full_name = 'Norchad Omier'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":0.0,"reb":2.5,"ast":1.5,"stl":0.0,"blk":0.0,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '22:norchad omier';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Baba Miller'
    , full_name = 'Baba Miller'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":4.6,"reb":2.7,"ast":1.0,"stl":0.6,"blk":0.8,"tov":0.9,"fg":59.1,"fg3":40.0,"ft":81.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '22:baba miller';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Nick Martinelli'
    , full_name = 'Nick Martinelli'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":3.4,"reb":1.4,"ast":0.4,"stl":0.0,"blk":0.0,"tov":0.4,"fg":63.6,"fg3":66.7,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '22:nick martinelli';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '22:narcisse ngoy';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Bradley Beal'
    , full_name = 'Bradley Beal'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '22:bradley beal';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Keaton Wagler'
    , full_name = 'Keaton Wagler'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":12.2,"reb":3.5,"ast":3.4,"stl":0.8,"blk":0.2,"tov":1.9,"fg":32.9,"fg3":35.4,"ft":86.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '22:keaton wagler';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Max Strus'
    , full_name = 'Max Strus'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":9.8,"reb":4.0,"ast":4.0,"stl":0.5,"blk":0.0,"tov":0.5,"fg":35.9,"fg3":30.0,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '22:max strus';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Kobe Sanders'
    , full_name = 'Kobe Sanders'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":9.8,"reb":2.9,"ast":2.7,"stl":1.0,"blk":0.1,"tov":1.8,"fg":41.0,"fg3":35.4,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '22:kobe sanders';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Derrick Jones Jr.'
    , full_name = 'Derrick Jones Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":11.1,"reb":4.9,"ast":1.4,"stl":1.1,"blk":0.8,"tov":1.1,"fg":50.7,"fg3":47.2,"ft":64.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '22:derrick jones jr.';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '22:yuki kawamura';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Yanic Konan Niederhauser'
    , full_name = 'Yanic Konan Niederhauser'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '22:yanic konan niederhäuser';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Jordan Miller'
    , full_name = 'Jordan Miller'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '22:jordan miller';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '22:johni broome';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Isaiah Jackson'
    , full_name = 'Isaiah Jackson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":8.1,"reb":5.9,"ast":2.0,"stl":1.3,"blk":0.7,"tov":1.8,"fg":58.2,"fg3":100.0,"ft":57.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '22:isaiah jackson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Cam Christie'
    , full_name = 'Cam Christie'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":1.4,"reb":0.4,"ast":0.2,"stl":0.2,"blk":0.0,"tov":0.6,"fg":18.2,"fg3":25.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '22:cam christie';

UPDATE public.nba_players
SET is_active = true
    , team_id = 22
    , name = 'Jalen Pickett'
    , full_name = 'Jalen Pickett'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.0,"reb":0.8,"ast":1.0,"stl":0.4,"blk":0.0,"tov":0.2,"fg":50.0,"fg3":66.7,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '22:jalen pickett';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '22:nicolas batum';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '22:jamarion sharp';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '22:fletcher loyer';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Luka Doncic'
    , full_name = 'Luka Doncic'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":39.3,"reb":7.8,"ast":7.9,"stl":2.0,"blk":0.8,"tov":5.0,"fg":49.8,"fg3":40.7,"ft":88.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '23:luka dončić';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Austin Reaves'
    , full_name = 'Austin Reaves'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":25.3,"reb":3.4,"ast":4.6,"stl":1.0,"blk":0.4,"tov":3.6,"fg":50.8,"fg3":41.3,"ft":90.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '23:austin reaves';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Quentin Grimes'
    , full_name = 'Quentin Grimes'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":8.0,"reb":2.5,"ast":2.5,"stl":0.9,"blk":0.2,"tov":1.4,"fg":43.1,"fg3":24.2,"ft":70.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '23:quentin grimes';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Sandro Mamukelashvili'
    , full_name = 'Sandro Mamukelashvili'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":9.8,"reb":4.6,"ast":1.6,"stl":0.8,"blk":0.6,"tov":0.8,"fg":47.7,"fg3":37.2,"ft":81.8}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '23:sandro mamukelashvili';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Walker Kessler'
    , full_name = 'Walker Kessler'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":14.9,"reb":10.8,"ast":1.7,"stl":1.2,"blk":2.3,"tov":1.8,"fg":69.1,"fg3":null,"ft":61.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '23:walker kessler';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Arthur Kaluma'
    , full_name = 'Arthur Kaluma'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '23:arthur kaluma';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Adou Thiero'
    , full_name = 'Adou Thiero'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":2.7,"reb":2.7,"ast":1.0,"stl":0.3,"blk":0.0,"tov":0.3,"fg":57.1,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '23:adou thiero';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Jarred Vanderbilt'
    , full_name = 'Jarred Vanderbilt'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":1.7,"reb":3.9,"ast":1.3,"stl":0.3,"blk":0.4,"tov":0.9,"fg":85.7,"fg3":null,"ft":0.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '23:jarred vanderbilt';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Matisse Thybulle'
    , full_name = 'Matisse Thybulle'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":12,"pts":7.0,"reb":1.6,"ast":1.1,"stl":2.1,"blk":0.8,"tov":1.0,"fg":43.1,"fg3":39.2,"ft":88.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '23:matisse thybulle';

UPDATE public.nba_players
SET is_active = true
    , team_id = 3
    , name = 'Dalton Knecht'
    , full_name = 'Dalton Knecht'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":4.3,"reb":2.3,"ast":0.3,"stl":0.0,"blk":0.3,"tov":0.0,"fg":62.5,"fg3":50.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '23:dalton knecht';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Jaden Hardy'
    , full_name = 'Jaden Hardy'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":1.3,"reb":0.5,"ast":0.5,"stl":0.3,"blk":0.0,"tov":0.2,"fg":10.0,"fg3":12.5,"ft":83.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '23:jaden hardy';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Bronny James'
    , full_name = 'Bronny James'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":0.8,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.2,"tov":0.4,"fg":66.7,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '23:bronny james';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Collin Sexton'
    , full_name = 'Collin Sexton'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":10.3,"reb":1.9,"ast":2.5,"stl":0.5,"blk":0.3,"tov":1.3,"fg":42.9,"fg3":29.7,"ft":70.6}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '23:collin sexton';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Ziaire Williams'
    , full_name = 'Ziaire Williams'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":11.2,"reb":2.8,"ast":1.7,"stl":1.4,"blk":0.2,"tov":0.4,"fg":54.5,"fg3":45.2,"ft":83.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '18'::jsonb, true)
    , updated_at = now()
WHERE id = '23:ziaire williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Jake LaRavia'
    , full_name = 'Jake LaRavia'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.1,"reb":3.5,"ast":1.8,"stl":1.4,"blk":0.7,"tov":1.5,"fg":52.2,"fg3":54.5,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '23:jake laravia';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Chris Manon'
    , full_name = 'Chris Manon'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":1.0,"reb":0.5,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":33.3,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '23:chris mañon';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'AK Okereke'
    , full_name = 'AK Okereke'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '23:ak okereke';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Cameron Carr'
    , full_name = 'Cameron Carr'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":0.5,"reb":0.8,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":33.3,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '23:cameron carr';

UPDATE public.nba_players
SET is_active = true
    , team_id = 23
    , name = 'Kevon Looney'
    , full_name = 'Kevon Looney'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":2.0,"reb":2.0,"ast":0.2,"stl":0.0,"blk":0.0,"tov":0.0,"fg":50.0,"fg3":null,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '23:kevon looney';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Devin Booker'
    , full_name = 'Devin Booker'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":25.1,"reb":2.7,"ast":4.8,"stl":1.0,"blk":0.3,"tov":2.5,"fg":48.3,"fg3":35.7,"ft":93.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '24:devin booker';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Jalen Green'
    , full_name = 'Jalen Green'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":11.8,"reb":3.3,"ast":3.4,"stl":0.6,"blk":0.6,"tov":2.6,"fg":42.6,"fg3":27.3,"ft":63.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '24:jalen green';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Dillon Brooks'
    , full_name = 'Dillon Brooks'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":14.9,"reb":3.9,"ast":2.2,"stl":0.8,"blk":0.2,"tov":1.6,"fg":44.4,"fg3":42.2,"ft":74.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '24:dillon brooks';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Miles Bridges'
    , full_name = 'Miles Bridges'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":15.0,"reb":7.4,"ast":3.1,"stl":1.1,"blk":0.8,"tov":0.7,"fg":45.2,"fg3":32.8,"ft":86.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '24:miles bridges';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Mark Williams'
    , full_name = 'Mark Williams'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '24:mark williams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Ryan Dunn'
    , full_name = 'Ryan Dunn'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":5.8,"reb":4.0,"ast":1.3,"stl":0.6,"blk":0.8,"tov":0.3,"fg":50.0,"fg3":50.0,"ft":62.5}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '24:ryan dunn';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '24:amir coffey';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '24:haywood highsmith';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Luke Kennard'
    , full_name = 'Luke Kennard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":8.3,"reb":1.3,"ast":1.9,"stl":0.1,"blk":0.0,"tov":0.6,"fg":53.2,"fg3":48.7,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '24:luke kennard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Khaman Maluach'
    , full_name = 'Khaman Maluach'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":8.1,"reb":6.4,"ast":1.4,"stl":0.6,"blk":0.8,"tov":1.2,"fg":61.5,"fg3":28.6,"ft":78.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '24:khaman maluach';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Oso Ighodaro'
    , full_name = 'Oso Ighodaro'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":6.5,"reb":5.4,"ast":3.1,"stl":0.1,"blk":0.8,"tov":2.0,"fg":57.5,"fg3":null,"ft":46.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '24:oso ighodaro';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Collin Gillespie'
    , full_name = 'Collin Gillespie'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.2,"reb":2.2,"ast":4.4,"stl":2.0,"blk":0.1,"tov":1.5,"fg":33.3,"fg3":31.7,"ft":25.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '24:collin gillespie';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '24:koby brea';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Jamaree Bouyea'
    , full_name = 'Jamaree Bouyea'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":3.2,"reb":0.3,"ast":1.5,"stl":0.0,"blk":0.0,"tov":0.2,"fg":100.0,"fg3":100.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '24:jamaree bouyea';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '24:isaiah livers';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Koa Peat'
    , full_name = 'Koa Peat'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":2.5,"reb":0.7,"ast":0.2,"stl":0.0,"blk":0.0,"tov":0.2,"fg":60.0,"fg3":null,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '24:koa peat';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Rasheer Fleming'
    , full_name = 'Rasheer Fleming'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":1.8,"reb":1.5,"ast":0.0,"stl":0.5,"blk":0.2,"tov":0.5,"fg":20.0,"fg3":16.7,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '24:rasheer fleming';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '24:cj huntley';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Jordan Goodwin'
    , full_name = 'Jordan Goodwin'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":9.5,"reb":3.3,"ast":2.3,"stl":1.5,"blk":0.0,"tov":0.5,"fg":51.2,"fg3":48.4,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '24:jordan goodwin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 24
    , name = 'Pat Spencer'
    , full_name = 'Pat Spencer'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":1.2,"reb":1.2,"ast":1.0,"stl":0.2,"blk":0.5,"tov":1.0,"fg":33.3,"fg3":50.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '24:pat spencer';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Darius Acuff Jr.'
    , full_name = 'Darius Acuff Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":26.2,"reb":3.8,"ast":7.3,"stl":1.0,"blk":0.1,"tov":3.6,"fg":41.8,"fg3":33.0,"ft":84.6}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '25:darius acuff jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'De''Andre Hunter'
    , full_name = 'De''Andre Hunter'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":13.3,"reb":4.5,"ast":1.3,"stl":0.2,"blk":0.1,"tov":1.4,"fg":42.9,"fg3":36.8,"ft":71.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '25:de''andre hunter';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Keegan Murray'
    , full_name = 'Keegan Murray'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":8.8,"reb":2.2,"ast":1.0,"stl":1.0,"blk":1.2,"tov":0.8,"fg":33.3,"fg3":15.4,"ft":90.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '25:keegan murray';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Zach LaVine'
    , full_name = 'Zach LaVine'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":22.3,"reb":3.3,"ast":2.5,"stl":1.0,"blk":0.4,"tov":3.1,"fg":50.3,"fg3":38.3,"ft":86.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '25:zach lavine';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Domantas Sabonis'
    , full_name = 'Domantas Sabonis'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":13.8,"reb":13.3,"ast":5.9,"stl":0.8,"blk":0.1,"tov":3.2,"fg":66.3,"fg3":40.0,"ft":70.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '25:domantas sabonis';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Malik Monk'
    , full_name = 'Malik Monk'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.8,"reb":1.1,"ast":3.4,"stl":0.4,"blk":0.1,"tov":1.6,"fg":36.1,"fg3":33.3,"ft":88.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '25:malik monk';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Jonathan Mogbo'
    , full_name = 'Jonathan Mogbo'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":3.0,"reb":2.2,"ast":0.8,"stl":0.8,"blk":0.4,"tov":0.6,"fg":35.3,"fg3":16.7,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '25:jonathan mogbo';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Precious Achiuwa'
    , full_name = 'Precious Achiuwa'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":10.4,"reb":6.4,"ast":1.1,"stl":1.3,"blk":1.1,"tov":1.2,"fg":53.3,"fg3":36.4,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '25:precious achiuwa';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Nique Clifford'
    , full_name = 'Nique Clifford'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":1.9,"reb":1.2,"ast":1.0,"stl":0.2,"blk":0.0,"tov":0.7,"fg":38.1,"fg3":11.1,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '25:nique clifford';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '25:adam flagler';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Ben Simmons'
    , full_name = 'Ben Simmons'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '25:ben simmons';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Daeqwon Plowden'
    , full_name = 'Daeqwon Plowden'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":2.6,"reb":1.0,"ast":0.2,"stl":0.2,"blk":0.1,"tov":0.2,"fg":44.4,"fg3":30.8,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '25:daeqwon plowden';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Dylan Cardwell'
    , full_name = 'Dylan Cardwell'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":4.5,"reb":7.0,"ast":1.8,"stl":1.0,"blk":1.2,"tov":1.8,"fg":46.7,"fg3":null,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '25:dylan cardwell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Alex Karaban'
    , full_name = 'Alex Karaban'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":1.4,"reb":0.8,"ast":0.4,"stl":0.2,"blk":0.0,"tov":1.0,"fg":33.3,"fg3":40.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '25:alex karaban';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Emanuel Sharp'
    , full_name = 'Emanuel Sharp'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":4.6,"reb":1.5,"ast":0.6,"stl":0.6,"blk":0.2,"tov":0.4,"fg":38.3,"fg3":40.6,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '25:emanuel sharp';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Maxime Raynaud'
    , full_name = 'Maxime Raynaud'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '25:maxime raynaud';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Kyrie Irving'
    , full_name = 'Kyrie Irving'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":22.9,"reb":3.2,"ast":4.3,"stl":1.2,"blk":0.3,"tov":1.9,"fg":48.7,"fg3":39.5,"ft":89.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '26:kyrie irving';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Max Christie'
    , full_name = 'Max Christie'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":5.5,"reb":3.0,"ast":1.3,"stl":0.5,"blk":0.2,"tov":1.2,"fg":32.8,"fg3":26.2,"ft":100.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '26:max christie';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Zaccharie Risacher'
    , full_name = 'Zaccharie Risacher'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":7.1,"reb":4.9,"ast":1.4,"stl":1.3,"blk":1.1,"tov":1.1,"fg":38.8,"fg3":25.0,"ft":58.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '26:zaccharie risacher';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Cooper Flagg'
    , full_name = 'Cooper Flagg'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":25.9,"reb":6.9,"ast":6.9,"stl":2.2,"blk":0.8,"tov":3.3,"fg":50.0,"fg3":29.2,"ft":90.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '26:cooper flagg';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Dereck Lively II'
    , full_name = 'Dereck Lively II'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '26:dereck lively ii';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Tarik Biberovic'
    , full_name = 'Tarik Biberovic'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '26:tarik biberovic';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '26:vsevolod ishchenko';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '26:john poulakidas';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Naji Marshall'
    , full_name = 'Naji Marshall'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":11.1,"reb":3.0,"ast":4.5,"stl":1.2,"blk":0.2,"tov":1.9,"fg":47.4,"fg3":28.0,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '26:naji marshall';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '26:dwight powell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Marcus Sasser'
    , full_name = 'Marcus Sasser'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":5.9,"reb":1.1,"ast":1.9,"stl":0.1,"blk":0.1,"tov":0.8,"fg":46.5,"fg3":37.5,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '26:marcus sasser';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Jett Howard'
    , full_name = 'Jett Howard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.4,"reb":0.2,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.2,"fg":57.1,"fg3":50.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '26:jett howard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Morez Johnson Jr.'
    , full_name = 'Morez Johnson Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.6,"reb":5.1,"ast":1.3,"stl":0.5,"blk":0.1,"tov":1.2,"fg":51.8,"fg3":22.2,"ft":72.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '26:morez johnson jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Caleb Martin'
    , full_name = 'Caleb Martin'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":3.6,"reb":2.3,"ast":1.3,"stl":0.4,"blk":0.0,"tov":0.4,"fg":45.0,"fg3":50.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '26:caleb martin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Daniel Gafford'
    , full_name = 'Daniel Gafford'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":9.6,"reb":5.5,"ast":2.0,"stl":0.7,"blk":1.8,"tov":1.4,"fg":71.2,"fg3":100.0,"ft":70.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '26:daniel gafford';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'P.J. Washington'
    , full_name = 'P.J. Washington'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":14.6,"reb":7.5,"ast":1.2,"stl":0.7,"blk":1.0,"tov":1.6,"fg":40.9,"fg3":35.6,"ft":72.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '26:p.j. washington';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Moussa Cisse'
    , full_name = 'Moussa Cisse'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":1.7,"reb":0.9,"ast":0.1,"stl":0.0,"blk":0.0,"tov":0.0,"fg":80.0,"fg3":null,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '26:moussa cisse';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Tobi Lawal'
    , full_name = 'Tobi Lawal'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":1.5,"reb":0.2,"ast":0.3,"stl":0.2,"blk":0.0,"tov":0.0,"fg":57.1,"fg3":33.3,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '26:tobi lawal';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Santi Aldama'
    , full_name = 'Santi Aldama'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":10.0,"reb":5.0,"ast":0.7,"stl":0.3,"blk":0.0,"tov":2.3,"fg":55.0,"fg3":33.3,"ft":83.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '26:santi aldama';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Sergio de Larrea'
    , full_name = 'Sergio de Larrea'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":4,"pts":5.2,"reb":2.0,"ast":1.2,"stl":0.0,"blk":0.0,"tov":1.0,"fg":50.0,"fg3":60.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '26:sergio de larrea';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Fred VanVleet'
    , full_name = 'Fred VanVleet'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":13.2,"reb":3.1,"ast":5.6,"stl":1.1,"blk":0.2,"tov":1.2,"fg":40.8,"fg3":36.8,"ft":82.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '27:fred vanvleet';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Amen Thompson'
    , full_name = 'Amen Thompson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":14.9,"reb":6.7,"ast":3.0,"stl":1.2,"blk":0.5,"tov":1.6,"fg":49.6,"fg3":22.2,"ft":78.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '27:amen thompson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Kevin Durant'
    , full_name = 'Kevin Durant'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":21.0,"reb":6.3,"ast":3.5,"stl":0.6,"blk":1.4,"tov":3.4,"fg":49.6,"fg3":35.7,"ft":86.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '27:kevin durant';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Jabari Smith Jr.'
    , full_name = 'Jabari Smith Jr.'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":17.0,"reb":6.5,"ast":2.4,"stl":0.9,"blk":0.9,"tov":0.9,"fg":50.4,"fg3":44.8,"ft":86.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '27:jabari smith jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Alperen Sengun'
    , full_name = 'Alperen Sengun'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":21.3,"reb":9.0,"ast":7.8,"stl":1.1,"blk":1.1,"tov":3.1,"fg":51.4,"fg3":47.4,"ft":74.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '27:alperen şengün';

UPDATE public.nba_players
SET is_active = true
    , team_id = 25
    , name = 'Sean Pedulla'
    , full_name = 'Sean Pedulla'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '27:sean pedulla';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Bruce Thornton'
    , full_name = 'Bruce Thornton'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":1.7,"reb":0.1,"ast":0.0,"stl":0.1,"blk":0.0,"tov":0.1,"fg":55.6,"fg3":50.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '27:bruce thornton';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '27:rafael castro';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Quadir Copeland'
    , full_name = 'Quadir Copeland'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '27:quadir copeland';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '27:aaron holiday';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Julian Phillips'
    , full_name = 'Julian Phillips'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '27:julian phillips';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Jae''Sean Tate'
    , full_name = 'Jae''Sean Tate'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":0.0,"reb":0.8,"ast":0.2,"stl":0.2,"blk":0.0,"tov":0.2,"fg":0.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '27:jae''sean tate';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Steven Adams'
    , full_name = 'Steven Adams'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":4.0,"reb":2.0,"ast":1.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":100.0,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '27:steven adams';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Reed Sheppard'
    , full_name = 'Reed Sheppard'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":9.8,"reb":1.8,"ast":2.8,"stl":1.4,"blk":0.0,"tov":1.1,"fg":37.3,"fg3":31.6,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '27:reed sheppard';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Tari Eason'
    , full_name = 'Tari Eason'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":9.6,"reb":6.0,"ast":1.4,"stl":1.2,"blk":1.2,"tov":1.3,"fg":43.2,"fg3":26.3,"ft":93.3}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '27:tari eason';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Isaiah Crawford'
    , full_name = 'Isaiah Crawford'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":2.0,"reb":0.1,"ast":0.0,"stl":0.0,"blk":0.1,"tov":0.0,"fg":55.6,"fg3":50.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '27:isaiah crawford';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Clint Capela'
    , full_name = 'Clint Capela'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":3.2,"reb":5.2,"ast":1.7,"stl":0.8,"blk":0.7,"tov":0.8,"fg":64.3,"fg3":null,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '27:clint capela';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Bogdan Bogdanovic'
    , full_name = 'Bogdan Bogdanovic'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":5.3,"reb":1.3,"ast":1.0,"stl":0.3,"blk":0.0,"tov":0.5,"fg":50.0,"fg3":48.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '27:bogdan bogdanović';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '27:jeff green';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Oscar Tshiebwe'
    , full_name = 'Oscar Tshiebwe'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":2.8,"reb":2.0,"ast":0.5,"stl":0.2,"blk":0.3,"tov":0.5,"fg":88.9,"fg3":null,"ft":25.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '27:oscar tshiebwe';

UPDATE public.nba_players
SET is_active = true
    , team_id = 27
    , name = 'Marcus Smart'
    , full_name = 'Marcus Smart'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":8.6,"reb":2.6,"ast":2.1,"stl":1.1,"blk":0.1,"tov":1.6,"fg":41.8,"fg3":36.8,"ft":81.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '27:marcus smart';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Ty Jerome'
    , full_name = 'Ty Jerome'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":26.7,"reb":3.7,"ast":4.9,"stl":0.8,"blk":0.2,"tov":2.6,"fg":50.0,"fg3":37.9,"ft":89.1}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '28:ty jerome';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Jaylen Wells'
    , full_name = 'Jaylen Wells'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":11.0,"reb":3.1,"ast":1.3,"stl":0.9,"blk":0.1,"tov":0.6,"fg":51.3,"fg3":39.6,"ft":73.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '28:jaylen wells';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Cedric Coward'
    , full_name = 'Cedric Coward'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":12.6,"reb":8.4,"ast":2.6,"stl":1.7,"blk":0.2,"tov":1.6,"fg":45.2,"fg3":46.8,"ft":70.0}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '28:cedric coward';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Cameron Boozer'
    , full_name = 'Cameron Boozer'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":16.2,"reb":9.7,"ast":5.5,"stl":0.4,"blk":0.6,"tov":3.4,"fg":36.4,"fg3":29.0,"ft":93.3}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '28:cameron boozer';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Zach Edey'
    , full_name = 'Zach Edey'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":8.2,"reb":8.0,"ast":1.0,"stl":0.1,"blk":1.3,"tov":1.4,"fg":54.2,"fg3":100.0,"ft":87.5}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '28:zach edey';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Jahmai Mashack'
    , full_name = 'Jahmai Mashack'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":1.0,"reb":0.0,"ast":1.5,"stl":0.0,"blk":0.0,"tov":0.5,"fg":50.0,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '28:jahmai mashack';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Richie Saunders'
    , full_name = 'Richie Saunders'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '28:richie saunders';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Scotty Pippen Jr.'
    , full_name = 'Scotty Pippen Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":6.4,"reb":2.2,"ast":2.2,"stl":1.0,"blk":0.2,"tov":2.0,"fg":42.3,"fg3":22.2,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '28:scotty pippen jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 26
    , name = 'Walter Clayton Jr.'
    , full_name = 'Walter Clayton Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":7.2,"reb":3.2,"ast":3.4,"stl":0.7,"blk":0.2,"tov":1.3,"fg":48.1,"fg3":43.3,"ft":69.2}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '28:walter clayton jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Jerami Grant'
    , full_name = 'Jerami Grant'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":10.4,"reb":2.2,"ast":2.1,"stl":0.4,"blk":1.0,"tov":1.3,"fg":43.9,"fg3":44.7,"ft":71.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '28:jerami grant';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Javon Small'
    , full_name = 'Javon Small'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":8.7,"reb":2.3,"ast":4.0,"stl":0.0,"blk":0.0,"tov":1.0,"fg":38.1,"fg3":40.0,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '28:javon small';

UPDATE public.nba_players
SET is_active = true
    , team_id = 18
    , name = 'Micah Peavy'
    , full_name = 'Micah Peavy'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":3.7,"reb":3.4,"ast":0.1,"stl":0.7,"blk":0.1,"tov":0.1,"fg":33.3,"fg3":30.8,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '28:micah peavy';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Olivier-Maxence Prosper'
    , full_name = 'Olivier-Maxence Prosper'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":2.4,"reb":1.4,"ast":0.6,"stl":0.0,"blk":0.0,"tov":0.2,"fg":50.0,"fg3":0.0,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '28:olivier-maxence prosper';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Quinten Post'
    , full_name = 'Quinten Post'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":5.0,"reb":2.1,"ast":0.4,"stl":0.2,"blk":0.2,"tov":0.6,"fg":47.1,"fg3":26.3,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '28:quinten post';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Taylor Hendricks'
    , full_name = 'Taylor Hendricks'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":3.8,"reb":1.6,"ast":0.0,"stl":0.2,"blk":0.2,"tov":0.4,"fg":58.3,"fg3":57.1,"ft":50.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '28:taylor hendricks';

UPDATE public.nba_players
SET is_active = true
    , team_id = 6
    , name = 'Jordan Hawkins'
    , full_name = 'Jordan Hawkins'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":3.4,"reb":0.4,"ast":0.2,"stl":0.0,"blk":0.2,"tov":0.0,"fg":41.2,"fg3":10.0,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '28:jordan hawkins';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Cam Spencer'
    , full_name = 'Cam Spencer'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":8.7,"reb":3.3,"ast":5.0,"stl":0.9,"blk":0.0,"tov":1.4,"fg":52.5,"fg3":51.5,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '28:cam spencer';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Kris Murray'
    , full_name = 'Kris Murray'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":1.3,"reb":1.7,"ast":0.7,"stl":0.3,"blk":0.7,"tov":0.1,"fg":20.0,"fg3":8.3,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '28:kris murray';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Isaiah Stewart'
    , full_name = 'Isaiah Stewart'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":11.9,"reb":3.4,"ast":0.6,"stl":0.1,"blk":0.7,"tov":0.9,"fg":66.7,"fg3":57.1,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '28:isaiah stewart';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'Karim Lopez'
    , full_name = 'Karim Lopez'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":1.3,"reb":0.7,"ast":0.0,"stl":0.0,"blk":0.3,"tov":0.0,"fg":50.0,"fg3":0.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '28:karim lopez';

UPDATE public.nba_players
SET is_active = true
    , team_id = 28
    , name = 'GG Jackson'
    , full_name = 'GG Jackson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":6.8,"reb":3.2,"ast":0.9,"stl":0.1,"blk":0.3,"tov":1.3,"fg":37.5,"fg3":37.5,"ft":76.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '28:gg jackson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Dejounte Murray'
    , full_name = 'Dejounte Murray'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":8,"pts":14.5,"reb":4.9,"ast":4.5,"stl":1.6,"blk":0.6,"tov":2.4,"fg":43.8,"fg3":29.2,"ft":96.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '29:dejounte murray';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Trey Murphy III'
    , full_name = 'Trey Murphy III'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":15.6,"reb":4.8,"ast":3.6,"stl":1.0,"blk":0.2,"tov":1.7,"fg":46.5,"fg3":37.7,"ft":86.7}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '29:trey murphy iii';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '29:herb jones';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Zion Williamson'
    , full_name = 'Zion Williamson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":21.0,"reb":5.3,"ast":2.7,"stl":2.2,"blk":0.5,"tov":1.9,"fg":62.8,"fg3":42.9,"ft":76.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '17'::jsonb, true)
    , updated_at = now()
WHERE id = '29:zion williamson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Derik Queen'
    , full_name = 'Derik Queen'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":12.5,"reb":6.9,"ast":2.5,"stl":0.8,"blk":0.8,"tov":2.5,"fg":47.3,"fg3":30.0,"ft":85.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '29:derik queen';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Jeremiah Fears'
    , full_name = 'Jeremiah Fears'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":15.4,"reb":4.5,"ast":4.9,"stl":1.1,"blk":0.5,"tov":2.8,"fg":44.6,"fg3":27.3,"ft":78.1}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '29:jeremiah fears';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Jordan Poole'
    , full_name = 'Jordan Poole'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":5,"pts":6.2,"reb":2.2,"ast":2.8,"stl":1.0,"blk":0.6,"tov":1.0,"fg":19.2,"fg3":23.5,"ft":94.4}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '29:jordan poole';

UPDATE public.nba_players
SET is_active = true
    , team_id = 20
    , name = 'Kobe Bufkin'
    , full_name = 'Kobe Bufkin'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '29:kobe bufkin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'DeAndre Jordan'
    , full_name = 'DeAndre Jordan'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":6.0,"reb":6.5,"ast":1.0,"stl":0.0,"blk":1.0,"tov":0.5,"fg":100.0,"fg3":null,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '29:deandre jordan';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'AJ Johnson'
    , full_name = 'AJ Johnson'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":1.3,"reb":0.7,"ast":1.0,"stl":0.3,"blk":0.3,"tov":0.3,"fg":40.0,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '29:aj johnson';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Malik Dia'
    , full_name = 'Malik Dia'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '29:malik dia';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Trendon Watford'
    , full_name = 'Trendon Watford'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":7.2,"reb":3.5,"ast":1.0,"stl":0.8,"blk":0.5,"tov":1.0,"fg":54.5,"fg3":33.3,"ft":81.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '29:trendon watford';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Bennedict Mathurin'
    , full_name = 'Bennedict Mathurin'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":6.0,"reb":1.9,"ast":1.3,"stl":0.4,"blk":0.0,"tov":0.9,"fg":36.5,"fg3":19.2,"ft":93.8}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '29:bennedict mathurin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Jaron Pierre Jr.'
    , full_name = 'Jaron Pierre Jr.'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '29:jaron pierre jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Bryce McGowens'
    , full_name = 'Bryce McGowens'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":2.5,"reb":0.7,"ast":0.5,"stl":1.0,"blk":0.3,"tov":0.3,"fg":35.7,"fg3":16.7,"ft":66.7}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '29:bryce mcgowens';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Karlo Matkovic'
    , full_name = 'Karlo Matkovic'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":9.0,"reb":4.3,"ast":1.2,"stl":0.8,"blk":0.5,"tov":1.2,"fg":60.7,"fg3":50.0,"ft":60.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '29:karlo matković';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Yves Missi'
    , full_name = 'Yves Missi'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":9.5,"reb":7.5,"ast":2.5,"stl":1.0,"blk":2.0,"tov":0.5,"fg":88.9,"fg3":null,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '29:yves missi';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '29:caleb houstan';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '29:christian koloko';

UPDATE public.nba_players
SET is_active = true
    , team_id = 29
    , name = 'Saddiq Bey'
    , full_name = 'Saddiq Bey'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":15.5,"reb":3.6,"ast":2.4,"stl":0.9,"blk":0.2,"tov":1.1,"fg":46.0,"fg3":34.5,"ft":90.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '29:saddiq bey';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'De''Aaron Fox'
    , full_name = 'De''Aaron Fox'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":13.9,"reb":4.4,"ast":5.9,"stl":1.2,"blk":0.5,"tov":2.5,"fg":53.2,"fg3":36.7,"ft":82.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '5'::jsonb, true)
    , updated_at = now()
WHERE id = '30:de''aaron fox';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Stephon Castle'
    , full_name = 'Stephon Castle'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":14.3,"reb":6.0,"ast":5.2,"stl":0.8,"blk":0.3,"tov":2.1,"fg":39.5,"fg3":32.4,"ft":71.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '3'::jsonb, true)
    , updated_at = now()
WHERE id = '30:stephon castle';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Devin Vassell'
    , full_name = 'Devin Vassell'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":11.9,"reb":3.8,"ast":3.1,"stl":1.7,"blk":0.3,"tov":1.0,"fg":40.6,"fg3":35.6,"ft":96.2}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '15'::jsonb, true)
    , updated_at = now()
WHERE id = '30:devin vassell';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Julian Champagnie'
    , full_name = 'Julian Champagnie'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":10.1,"reb":4.0,"ast":1.4,"stl":0.9,"blk":0.5,"tov":0.5,"fg":44.4,"fg3":43.1,"ft":88.9}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '4'::jsonb, true)
    , updated_at = now()
WHERE id = '30:julian champagnie';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Victor Wembanyama'
    , full_name = 'Victor Wembanyama'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":30.1,"reb":11.9,"ast":3.0,"stl":1.1,"blk":4.4,"tov":2.1,"fg":52.9,"fg3":32.3,"ft":77.4}'::jsonb, true), '{is_starter}', 'true'::jsonb, true), '{roster_order}', '16'::jsonb, true)
    , updated_at = now()
WHERE id = '30:victor wembanyama';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Jordan McLaughlin'
    , full_name = 'Jordan McLaughlin'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":6,"pts":1.5,"reb":1.3,"ast":1.3,"stl":0.8,"blk":0.0,"tov":0.5,"fg":18.8,"fg3":20.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '12'::jsonb, true)
    , updated_at = now()
WHERE id = '30:jordan mclaughlin';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Dylan Harper'
    , full_name = 'Dylan Harper'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":18.0,"reb":5.4,"ast":4.4,"stl":0.7,"blk":0.1,"tov":1.5,"fg":51.0,"fg3":33.3,"ft":85.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '7'::jsonb, true)
    , updated_at = now()
WHERE id = '30:dylan harper';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Keldon Johnson'
    , full_name = 'Keldon Johnson'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":7.8,"reb":5.6,"ast":2.1,"stl":0.5,"blk":0.0,"tov":1.1,"fg":42.9,"fg3":14.3,"ft":72.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '9'::jsonb, true)
    , updated_at = now()
WHERE id = '30:keldon johnson';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '30:taelon peter';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Luke Kornet'
    , full_name = 'Luke Kornet'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":11,"pts":3.1,"reb":4.2,"ast":1.0,"stl":0.1,"blk":0.6,"tov":0.5,"fg":48.0,"fg3":null,"ft":76.9}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '11'::jsonb, true)
    , updated_at = now()
WHERE id = '30:luke kornet';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Tarris Reed Jr.'
    , full_name = 'Tarris Reed Jr.'
    , position = 'C'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":7,"pts":2.3,"reb":3.1,"ast":0.3,"stl":0.0,"blk":0.3,"tov":1.0,"fg":63.6,"fg3":null,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '14'::jsonb, true)
    , updated_at = now()
WHERE id = '30:tarris reed jr.';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Carter Bryant'
    , full_name = 'Carter Bryant'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":10,"pts":3.1,"reb":0.7,"ast":0.5,"stl":0.1,"blk":0.3,"tov":0.4,"fg":33.3,"fg3":34.8,"ft":75.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '2'::jsonb, true)
    , updated_at = now()
WHERE id = '30:carter bryant';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Jayden Quaintance'
    , full_name = 'Jayden Quaintance'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '13'::jsonb, true)
    , updated_at = now()
WHERE id = '30:jayden quaintance';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Tobias Harris'
    , full_name = 'Tobias Harris'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '8'::jsonb, true)
    , updated_at = now()
WHERE id = '30:tobias harris';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'David Jones Garcia'
    , full_name = 'David Jones Garcia'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":3,"pts":1.3,"reb":0.0,"ast":0.0,"stl":0.7,"blk":0.0,"tov":0.3,"fg":12.5,"fg3":0.0,"ft":100.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '10'::jsonb, true)
    , updated_at = now()
WHERE id = '30:david jones garcia';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Harrison Barnes'
    , full_name = 'Harrison Barnes'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":9,"pts":5.8,"reb":0.9,"ast":0.0,"stl":0.1,"blk":0.2,"tov":0.0,"fg":42.9,"fg3":37.0,"ft":80.0}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '0'::jsonb, true)
    , updated_at = now()
WHERE id = '30:harrison barnes';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Maliq Brown'
    , full_name = 'Maliq Brown'
    , position = 'F'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":1,"pts":0.0,"reb":0.0,"ast":1.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '1'::jsonb, true)
    , updated_at = now()
WHERE id = '30:maliq brown';

UPDATE public.nba_players
SET is_active = true
    , team_id = 30
    , name = 'Ja''Kobi Gillespie'
    , full_name = 'Ja''Kobi Gillespie'
    , position = 'G'
    , metadata = jsonb_set(jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":2,"pts":2.5,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":50.0,"fg3":33.3,"ft":null}'::jsonb, true), '{is_starter}', 'false'::jsonb, true), '{roster_order}', '6'::jsonb, true)
    , updated_at = now()
WHERE id = '30:ja''kobi gillespie';

UPDATE public.nba_players
SET is_active = false
    , metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', COALESCE(metadata->'player', '{}'::jsonb) || '{"stats_season":"2026-27","stats_as_of":"2026-11-11","stats_source":"ESPN box scores","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null}'::jsonb, true)
    , updated_at = now()
WHERE id = '30:emanuel miller';

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('1:devin carter', 1, 'Devin Carter', 'Devin Carter', 'G', true, '{"is_starter":false,"roster_order":0,"player":{"name":"Devin Carter","pos":"G","contract_type":null,"stats_season":"2026-27","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('16:cam whitmore', 16, 'Cam Whitmore', 'Cam Whitmore', 'F', true, '{"is_starter":false,"roster_order":16,"player":{"name":"Cam Whitmore","pos":"F","contract_type":null,"stats_season":"2026-27","gp":2,"pts":4.0,"reb":1.0,"ast":0.5,"stl":0.5,"blk":0.0,"tov":0.5,"fg":57.1,"fg3":0.0,"ft":0.0,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('21:jimmy butler iii', 21, 'Jimmy Butler III', 'Jimmy Butler III', 'F', true, '{"is_starter":false,"roster_order":1,"player":{"name":"Jimmy Butler III","pos":"F","contract_type":null,"stats_season":"2026-27","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('21:graham ike', 21, 'Graham Ike', 'Graham Ike', 'F', true, '{"is_starter":false,"roster_order":6,"player":{"name":"Graham Ike","pos":"F","contract_type":null,"stats_season":"2026-27","gp":8,"pts":4.9,"reb":2.8,"ast":0.9,"stl":0.4,"blk":0.2,"tov":0.4,"fg":51.7,"fg3":80.0,"ft":83.3,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('22:blake wesley', 22, 'Blake Wesley', 'Blake Wesley', 'G', true, '{"is_starter":false,"roster_order":18,"player":{"name":"Blake Wesley","pos":"G","contract_type":null,"stats_season":"2026-27","gp":2,"pts":1.0,"reb":2.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":0.0,"fg3":0.0,"ft":100.0,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('23:carson cooper', 23, 'Carson Cooper', 'Carson Cooper', 'C', true, '{"is_starter":false,"roster_order":1,"player":{"name":"Carson Cooper","pos":"C","contract_type":null,"stats_season":"2026-27","gp":1,"pts":1.0,"reb":2.0,"ast":1.0,"stl":0.0,"blk":0.0,"tov":1.0,"fg":null,"fg3":null,"ft":50.0,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('11:bobby portis', 11, 'Bobby Portis', 'Bobby Portis', 'F', true, '{"is_starter":false,"roster_order":12,"player":{"name":"Bobby Portis","pos":"F","contract_type":null,"stats_season":"2026-27","gp":11,"pts":6.8,"reb":5.8,"ast":1.7,"stl":0.7,"blk":0.5,"tov":0.8,"fg":36.4,"fg3":31.8,"ft":71.4,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('29:herbert jones', 29, 'Herbert Jones', 'Herbert Jones', 'F', true, '{"is_starter":false,"roster_order":4,"player":{"name":"Herbert Jones","pos":"F","contract_type":null,"stats_season":"2026-27","gp":11,"pts":6.0,"reb":3.1,"ast":0.9,"stl":0.7,"blk":0.3,"tov":1.3,"fg":39.1,"fg3":28.6,"ft":80.0,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('29:julian reese', 29, 'Julian Reese', 'Julian Reese', 'F', true, '{"is_starter":false,"roster_order":15,"player":{"name":"Julian Reese","pos":"F","contract_type":null,"stats_season":"2026-27","gp":3,"pts":1.3,"reb":0.3,"ast":0.0,"stl":0.0,"blk":0.3,"tov":0.3,"fg":50.0,"fg3":null,"ft":null,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('3:jaden akins', 3, 'Jaden Akins', 'Jaden Akins', 'G', true, '{"is_starter":false,"roster_order":0,"player":{"name":"Jaden Akins","pos":"G","contract_type":null,"stats_season":"2026-27","gp":1,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('3:james wiseman', 3, 'James Wiseman', 'James Wiseman', 'C', true, '{"is_starter":false,"roster_order":16,"player":{"name":"James Wiseman","pos":"C","contract_type":null,"stats_season":"2026-27","gp":5,"pts":1.6,"reb":2.4,"ast":0.0,"stl":0.2,"blk":0.8,"tov":0.6,"fg":40.0,"fg3":null,"ft":null,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('24:duop reath', 24, 'Duop Reath', 'Duop Reath', 'C', true, '{"is_starter":false,"roster_order":13,"player":{"name":"Duop Reath","pos":"C","contract_type":null,"stats_season":"2026-27","gp":6,"pts":3.2,"reb":1.0,"ast":0.0,"stl":0.0,"blk":0.2,"tov":0.3,"fg":58.3,"fg3":37.5,"ft":100.0,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('24:drew timme', 24, 'Drew Timme', 'Drew Timme', 'F', true, '{"is_starter":false,"roster_order":15,"player":{"name":"Drew Timme","pos":"F","contract_type":null,"stats_season":"2026-27","gp":0,"pts":null,"reb":null,"ast":null,"stl":null,"blk":null,"tov":null,"fg":null,"fg3":null,"ft":null,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('25:leaky black', 25, 'Leaky Black', 'Leaky Black', 'F', true, '{"is_starter":false,"roster_order":2,"player":{"name":"Leaky Black","pos":"F","contract_type":null,"stats_season":"2026-27","gp":6,"pts":5.8,"reb":3.5,"ast":1.8,"stl":1.5,"blk":0.5,"tov":0.0,"fg":41.4,"fg3":40.0,"ft":50.0,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.nba_players
  (id, team_id, name, full_name, position, is_active, metadata)
VALUES ('15:reece beekman', 15, 'Reece Beekman', 'Reece Beekman', 'G', true, '{"is_starter":false,"roster_order":1,"player":{"name":"Reece Beekman","pos":"G","contract_type":null,"stats_season":"2026-27","gp":1,"pts":0.0,"reb":0.0,"ast":0.0,"stl":0.0,"blk":0.0,"tov":0.0,"fg":null,"fg3":null,"ft":null,"stats_as_of":"2026-11-11","stats_source":"ESPN box scores","salary":null}}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET team_id = EXCLUDED.team_id,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

COMMIT;
