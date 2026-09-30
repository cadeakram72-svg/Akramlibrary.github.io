-- Enable Supabase Cron (pg_cron), pg_net, and Vault in the Dashboard first.
-- In Vault, create secrets named akram_commerce_url and akram_cron_secret.
-- URL: https://hbbejwxcjtlkxdcbmgwj.supabase.co/functions/v1/akram-commerce/jobs
-- The cron secret must match the Edge Function CRON_SECRET. Never commit its value.
-- Run once. Remove any earlier job with this name before rescheduling.
select cron.schedule('akram-commerce-every-minute','* * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='akram_commerce_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='akram_cron_secret')),
  body:='{}'::jsonb,
  timeout_milliseconds:=120000
 );
$job$);
-- Inspect cron.job_run_details and net._http_response for failures. A cron SQL success
-- alone does not mean the HTTP worker succeeded. Do not expose those tables publicly.
