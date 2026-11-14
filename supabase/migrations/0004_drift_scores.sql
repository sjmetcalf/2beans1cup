-- Doppio Drift leaderboard. Public read; writes only through the barista edge function.
create table if not exists public.drift_scores (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 1000000),
  created_at timestamptz not null default now()
);
create index if not exists drift_scores_score_idx on public.drift_scores (score desc);
alter table public.drift_scores enable row level security;
create policy "public read drift scores" on public.drift_scores for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.drift_scores from anon, authenticated;
