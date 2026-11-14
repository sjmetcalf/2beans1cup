-- Private busy times from uploaded work calendars.
-- Only start/end are stored (no titles, attendees or locations).
-- No public access at all: read and written only by the barista edge function.
create table public.busy_blocks (
  id bigint generated always as identity primary key,
  person_id uuid not null references public.people(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  all_day boolean not null default false,
  created_at timestamptz not null default now()
);
create index busy_blocks_person_start_idx on public.busy_blocks (person_id, starts_at);

create table public.busy_uploads (
  person_id uuid primary key references public.people(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  range_start timestamptz,
  range_end timestamptz,
  block_count int not null default 0
);

alter table public.busy_blocks enable row level security;
alter table public.busy_uploads enable row level security;
revoke all on public.busy_blocks, public.busy_uploads from anon, authenticated;
