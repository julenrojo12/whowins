-- Who Wins — Initial Schema
-- Run this in your Supabase SQL editor

-- Extensions
create extension if not exists "uuid-ossp";

-- Character Sets
create table if not exists character_sets (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  created_at timestamptz default now()
);

-- Characters
create table if not exists characters (
  id         uuid primary key default uuid_generate_v4(),
  set_id     uuid references character_sets(id) on delete cascade,
  name       text not null,
  image_url  text,
  created_at timestamptz default now()
);

-- Weapon Sets
create table if not exists weapon_sets (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  created_at timestamptz default now()
);

-- Weapons (danger_level 1-10 internal)
create table if not exists weapons (
  id           uuid primary key default uuid_generate_v4(),
  set_id       uuid references weapon_sets(id) on delete cascade,
  name         text not null,
  image_url    text,
  danger_level integer not null check (danger_level between 1 and 10),
  created_at   timestamptz default now()
);

-- Lobbies
create table if not exists lobbies (
  id                uuid primary key default uuid_generate_v4(),
  code              char(6) unique not null,
  host_session_id   text not null,
  format            integer not null check (format in (2,4,8,16)),
  character_set_id  uuid references character_sets(id),
  weapon_set_id     uuid references weapon_sets(id),
  status            text not null default 'waiting'
                    check (status in ('waiting','rating','bracket','voting','between_rounds','finished')),
  current_round     integer not null default 0,
  created_at        timestamptz default now()
);

-- Players
create table if not exists players (
  id             uuid primary key default uuid_generate_v4(),
  lobby_id       uuid references lobbies(id) on delete cascade,
  session_id     text,          -- NULL for bots
  player_type    text not null default 'human' check (player_type in ('human','bot')),
  name           text not null,
  photo_url      text,
  slot_number    integer not null,
  is_eliminated  boolean not null default false,
  created_at     timestamptz default now()
);

-- Ratings (UNIQUE per rater+target, not per lobby — one rating per pair)
create table if not exists ratings (
  id          uuid primary key default uuid_generate_v4(),
  lobby_id    uuid references lobbies(id) on delete cascade,
  rater_id    uuid references players(id) on delete cascade,
  target_id   uuid references players(id) on delete cascade,
  strength    numeric(3,1) not null check (strength between 1 and 5),
  skill       numeric(3,1) not null check (skill between 1 and 5),
  resistance  numeric(3,1) not null check (resistance between 1 and 5),
  created_at  timestamptz default now(),
  unique (rater_id, target_id)
);

-- Power Scores
create table if not exists player_power_scores (
  player_id       uuid primary key references players(id) on delete cascade,
  avg_strength    numeric(5,3) not null,
  avg_skill       numeric(5,3) not null,
  avg_resistance  numeric(5,3) not null,
  power_score     numeric(6,3) not null,
  bracket_seed    integer not null
);

-- Brackets
create table if not exists brackets (
  id            uuid primary key default uuid_generate_v4(),
  lobby_id      uuid references lobbies(id) on delete cascade,
  round_number  integer not null,
  match_number  integer not null,
  player1_id    uuid references players(id),
  player2_id    uuid references players(id),
  weapon1_id    uuid references weapons(id),
  weapon2_id    uuid references weapons(id),
  status        text not null default 'pending'
                check (status in ('pending','open','closed')),
  winner_id     uuid references players(id),
  created_at    timestamptz default now()
);

-- Votes (UNIQUE per bracket+voter)
create table if not exists votes (
  id            uuid primary key default uuid_generate_v4(),
  bracket_id    uuid references brackets(id) on delete cascade,
  voter_id      uuid references players(id) on delete cascade,
  voted_for_id  uuid references players(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (bracket_id, voter_id)
);

-- Lobby Events (event log for realtime)
create table if not exists lobby_events (
  id          uuid primary key default uuid_generate_v4(),
  lobby_id    uuid references lobbies(id) on delete cascade,
  event_type  text not null,
  payload     jsonb not null default '{}',
  created_at  timestamptz default now()
);

-- =============================================
-- RLS: permissive anonymous policies
-- =============================================

alter table character_sets     enable row level security;
alter table characters         enable row level security;
alter table weapon_sets        enable row level security;
alter table weapons            enable row level security;
alter table lobbies            enable row level security;
alter table players            enable row level security;
alter table ratings            enable row level security;
alter table player_power_scores enable row level security;
alter table brackets           enable row level security;
alter table votes              enable row level security;
alter table lobby_events       enable row level security;

-- Allow all for anonymous (game is public and ephemeral)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'character_sets','characters','weapon_sets','weapons',
    'lobbies','players','ratings','player_power_scores',
    'brackets','votes','lobby_events'
  ]
  loop
    execute format('create policy "anon_all" on %I for all to anon using (true) with check (true)', tbl);
  end loop;
end;
$$;

-- =============================================
-- Storage buckets
-- =============================================

-- player-photos: public, image/*, max 5MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos', 'player-photos', true, 5242880,
  array['image/jpeg','image/png','image/gif','image/webp']
) on conflict (id) do nothing;

-- set-images: public, image/*, max 10MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'set-images', 'set-images', true, 10485760,
  array['image/jpeg','image/png','image/gif','image/webp']
) on conflict (id) do nothing;

-- Storage policies
create policy "public read player-photos"
  on storage.objects for select using (bucket_id = 'player-photos');
create policy "anon upload player-photos"
  on storage.objects for insert to anon with check (bucket_id = 'player-photos');
create policy "anon update player-photos"
  on storage.objects for update to anon using (bucket_id = 'player-photos');

create policy "public read set-images"
  on storage.objects for select using (bucket_id = 'set-images');
create policy "anon upload set-images"
  on storage.objects for insert to anon with check (bucket_id = 'set-images');

-- Enable Realtime for all tables
alter publication supabase_realtime add table lobbies;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table ratings;
alter publication supabase_realtime add table brackets;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table lobby_events;
