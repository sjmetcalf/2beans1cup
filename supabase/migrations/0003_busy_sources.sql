-- Multiple named calendars per person (e.g. Work, Time off, Holidays).
-- kind 'busy' blocks time; kind 'off' marks days off (which override busy time on those days).
create table public.busy_sources (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  name text not null,
  kind text not null default 'busy' check (kind in ('busy', 'off')),
  uploaded_at timestamptz not null default now(),
  range_start timestamptz,
  range_end timestamptz,
  block_count int not null default 0,
  unique (person_id, name)
);
alter table public.busy_sources enable row level security;
revoke all on public.busy_sources from anon, authenticated;

-- Old single-calendar uploads become a "Work" calendar
insert into public.busy_sources (person_id, name, kind, uploaded_at, range_start, range_end, block_count)
select person_id, 'Work', 'busy', uploaded_at, range_start, range_end, block_count from public.busy_uploads;

alter table public.busy_blocks add column source_id uuid references public.busy_sources(id) on delete cascade;
update public.busy_blocks b set source_id = s.id from public.busy_sources s where s.person_id = b.person_id and s.name = 'Work' and b.source_id is null;
delete from public.busy_blocks where source_id is null;
alter table public.busy_blocks alter column source_id set not null;
create index busy_blocks_source_idx on public.busy_blocks (source_id);

drop table public.busy_uploads;
