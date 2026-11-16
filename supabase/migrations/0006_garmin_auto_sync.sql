-- Hourly automatic Garmin sync: pg_cron calls the barista edge function's "garmin.auto" action.
-- The function only refreshes people who connected Garmin and skips anyone synced in the last 30 min.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('garmin-auto-sync') where exists (select 1 from cron.job where jobname = 'garmin-auto-sync');
select cron.schedule(
  'garmin-auto-sync',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://xtzbgwnxfkdzhysnpwyq.supabase.co/functions/v1/barista',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Vb6dY0CKAo0nvcZvyWBiXg_dFav-0dM"}'::jsonb,
    body := '{"action": "garmin.auto"}'::jsonb
  );
  $$
);
