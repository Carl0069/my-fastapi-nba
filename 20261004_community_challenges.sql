create table if not exists public.community_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 48),
  description text not null default '' check (char_length(description) <= 220),
  creator text not null check (char_length(creator) between 2 and 24),
  rule_type text not null check (
    rule_type in ('all', 'scorers', 'playmakers', 'rebounders', 'guards', 'forwards', 'bigs', 'defenders')
  ),
  created_at timestamptz not null default now()
);

create index if not exists community_challenges_created_at_idx
  on public.community_challenges (created_at desc);

alter table public.community_challenges enable row level security;
grant select, insert on public.community_challenges to service_role;

notify pgrst, 'reload schema';
