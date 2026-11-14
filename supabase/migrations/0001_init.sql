-- 2beans1cup: initial schema
-- Public read-only site. All writes go through the barista edge function,
-- which checks a shared passcode (BARISTA_CODE secret) and uses the service role.

-- The two beans
create table public.people (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text not null default '#b4683f',
  sort int not null default 0,
  garmin_connected boolean not null default false,
  garmin_last_sync timestamptz,
  garmin_last_error text,
  created_at timestamptz not null default now()
);

-- Activities ("The Pour Log"). No GPS coordinates are stored.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  source text not null check (source in ('garmin','upload','manual')),
  external_id text not null,
  sport text not null check (sport in ('ski','run','bike','other')),
  activity_type text,
  name text,
  start_time timestamptz not null,
  start_time_local timestamp,
  distance_m double precision,
  duration_s double precision,
  elapsed_s double precision,
  elevation_gain_m double precision,
  elevation_loss_m double precision,
  avg_hr double precision,
  max_hr double precision,
  avg_speed_mps double precision,
  calories double precision,
  training_load double precision,
  aerobic_te double precision,
  hr_zones_s double precision[],
  created_at timestamptz not null default now(),
  unique (person_id, source, external_id)
);
create index activities_person_start_idx on public.activities (person_id, start_time desc);
create index activities_sport_start_idx on public.activities (sport, start_time desc);

-- Shared calendar ("The Menu")
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'training' check (kind in ('race','training','rest','logistics')),
  sport text check (sport in ('ski','run','bike','other')),
  who text not null default 'both',
  starts_on date not null,
  ends_on date,
  notes text,
  created_at timestamptz not null default now()
);
create index events_starts_idx on public.events (starts_on);

-- Shared checklist ("The Bar Station")
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  list text not null default 'logistics' check (list in ('ski','run','bike','logistics')),
  label text not null,
  done boolean not null default false,
  who text not null default 'both',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Garmin personal API keys: never readable from the browser
create table public.garmin_keys (
  person_id uuid primary key references public.people(id) on delete cascade,
  api_key text not null,
  access_token text,
  token_expires_at timestamptz,
  saved_at timestamptz not null default now()
);

-- Row level security: public can read the cafe, nobody can write directly
alter table public.people enable row level security;
alter table public.activities enable row level security;
alter table public.events enable row level security;
alter table public.checklist_items enable row level security;
alter table public.garmin_keys enable row level security;

create policy "public read people" on public.people for select to anon, authenticated using (true);
create policy "public read activities" on public.activities for select to anon, authenticated using (true);
create policy "public read events" on public.events for select to anon, authenticated using (true);
create policy "public read checklist" on public.checklist_items for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.people, public.activities, public.events, public.checklist_items from anon, authenticated;
revoke all on public.garmin_keys from anon, authenticated;

-- Seed
insert into public.people (slug, name, color, sort) values
  ('bean-one', 'Steve', '#b4683f', 1),
  ('bean-two', 'Partner', '#5b7a6a', 2);

insert into public.events (title, kind, sport, starts_on, notes) values
  ('Triple Crown priority registration opens', 'logistics', null, '2026-11-16', 'Midnight MST. Register for the Triple Crown; team captain registers first.'),
  ('GT Mountain Run: Crested Butte → Aspen', 'race', 'run', '2027-09-04', '~40 mi point-to-point'),
  ('GT Mountain Bike: Aspen → Crested Butte', 'race', 'bike', '2027-09-05', 'Dual sport: back-to-back with the run');

insert into public.checklist_items (list, label, sort) values
  ('logistics', 'Register for the Triple Crown (Nov 16, midnight)', 1),
  ('logistics', 'Book run shuttle Aspen → CB', 2),
  ('logistics', 'Book bike transport for dual sport', 3),
  ('ski', 'Confirm team entry + mandatory gear list', 1),
  ('run', 'Plan finish-line bag', 1),
  ('bike', 'Tune-up before race weekend', 1);
