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

notify pgrst, 'reload schema';
