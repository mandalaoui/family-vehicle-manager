-- DRAFT: email reminders data source. NOT a migration and NOT applied anywhere.
-- Needs approval before it is moved to supabase/migrations and run in the SQL Editor.
--
-- Goal: let a daily cron job (Vercel Cron -> /api/cron/reminders) read "what needs a reminder" and record
-- what was mailed, WITHOUT the service_role key. The cron route calls these functions with the publishable
-- key plus a long random shared secret (CRON_SECRET); only its SHA-256 hash is stored in the database.

-- 1. Per-user opt-out (default on)
alter table public.profiles add column email_reminders boolean not null default true;
grant update (full_name, email_reminders) on public.profiles to authenticated;

-- 2. What was already mailed (dedupe), one row per vehicle + alert key
create table public.reminder_log (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  alert_key  text not null,
  sent_on    date not null,
  primary key (vehicle_id, alert_key)
);
alter table public.reminder_log enable row level security;   -- no policies, no grants: only the functions below touch it
revoke all on public.reminder_log from anon, authenticated;

-- 3. Hash of the cron secret (insert it once by hand: sha256 hex of CRON_SECRET)
create table public.app_secrets (name text primary key, secret_hash text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

create or replace function public.reminders_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_secrets
    where name = 'cron' and secret_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
  );
$$;
revoke all on function public.reminders_secret_ok(text) from public, anon, authenticated;

-- 4. The batch: recipients (opted in) with their family's vehicles, plus what was already sent
create or replace function public.reminder_batch(p_secret text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.reminders_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'family_id', f.id,
      'family_name', f.name,
      'recipients', (
        select coalesce(jsonb_agg(p.email), '[]'::jsonb)
        from public.family_members fm join public.profiles p on p.id = fm.user_id
        where fm.family_id = f.id and p.email_reminders and p.email is not null
      ),
      'vehicles', (
        select coalesce(jsonb_agg(to_jsonb(v) - 'photo_path' - 'renewal_undo' - 'notes'), '[]'::jsonb)
        from public.vehicles v where v.family_id = f.id
      ),
      'sent', (
        select coalesce(jsonb_object_agg(r.vehicle_id || ':' || r.alert_key, r.sent_on), '{}'::jsonb)
        from public.reminder_log r join public.vehicles v on v.id = r.vehicle_id where v.family_id = f.id
      )
    ))
    from public.families f
  ), '[]'::jsonb);
end;
$$;

create or replace function public.reminder_mark_sent(p_secret text, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.reminders_secret_ok(p_secret) then raise exception 'forbidden'; end if;
  insert into public.reminder_log (vehicle_id, alert_key, sent_on)
  select (i ->> 'vehicle_id')::uuid, i ->> 'alert_key', (now() at time zone 'Asia/Jerusalem')::date
  from jsonb_array_elements(p_items) i
  on conflict (vehicle_id, alert_key) do update set sent_on = excluded.sent_on;
end;
$$;

revoke all on function public.reminder_batch(text), public.reminder_mark_sent(text, jsonb) from public;
grant execute on function public.reminder_batch(text), public.reminder_mark_sent(text, jsonb) to anon, authenticated;
