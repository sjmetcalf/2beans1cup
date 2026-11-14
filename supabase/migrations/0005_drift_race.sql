-- Doppio Drift race day: one seeded course per day, fastest time to Aspen wins.
alter table public.drift_scores add column if not exists mode text not null default 'endless' check (mode in ('endless', 'race'));
alter table public.drift_scores add column if not exists course date;
alter table public.drift_scores add column if not exists time_ms integer check (time_ms is null or time_ms between 1000 and 3600000);
create index if not exists drift_scores_race_idx on public.drift_scores (mode, course, time_ms);
