-- Phase 2 features: battery, tires, garages (family level), garage link on service logs,
-- single-family guard on create_family, and "my pending invitations" for new users.
-- Apply in the Supabase SQL Editor after migrations 1-5.

------------------------------------------------------------------
-- 1. Battery + tires (columns on vehicles; the existing vehicles RLS covers them)
------------------------------------------------------------------
alter table public.vehicles
  add column battery_replaced_at       date,
  add column battery_warranty_until    date,
  add column battery_notes             text check (char_length(battery_notes) <= 1000),
  add column battery_reminder_months   smallint not null default 36 check (battery_reminder_months between 1 and 120),
  add column tires_replaced_at         date,
  add column tires_separate            boolean  not null default false,
  add column tire_fl_at                date,   -- front left
  add column tire_fr_at                date,   -- front right
  add column tire_rl_at                date,   -- rear left
  add column tire_rr_at                date,   -- rear right
  add column tires_replaced_km         integer check (tires_replaced_km >= 0),
  add column tires_reminder_months     smallint not null default 48 check (tires_reminder_months between 1 and 120),
  add column tires_reminder_km         integer  not null default 50000 check (tires_reminder_km between 1000 and 500000);

------------------------------------------------------------------
-- 2. Garages (one list per family)
------------------------------------------------------------------
create table public.garages (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  phone       text check (phone is null or phone ~ '^[0-9+()*\s-]{3,30}$'),
  address     text check (char_length(address) <= 200),
  notes       text check (char_length(notes) <= 1000),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index garages_family_id_idx on public.garages (family_id);
create unique index garages_family_name_key on public.garages (family_id, lower(btrim(name)));

create or replace function public.garages_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.family_id <> old.family_id then raise exception 'forbidden'; end if;
  return new;
end;
$$;
create trigger garages_before_update before update on public.garages
  for each row execute function public.garages_before_update();

revoke all on public.garages from anon, authenticated;
grant select, insert, update, delete on public.garages to authenticated;

alter table public.garages enable row level security;
-- Members read, add and edit; only admins delete (a garage in use is detached from logs, never lost).
create policy garages_select on public.garages for select to authenticated
  using ((select public.is_family_member(family_id)));
create policy garages_insert on public.garages for insert to authenticated
  with check ((select public.is_family_member(family_id)));
create policy garages_update on public.garages for update to authenticated
  using ((select public.is_family_member(family_id))) with check ((select public.is_family_member(family_id)));
create policy garages_delete on public.garages for delete to authenticated
  using ((select public.is_family_admin(family_id)));

------------------------------------------------------------------
-- 3. Optional garage link on service logs
------------------------------------------------------------------
alter table public.service_logs
  add column garage_id uuid references public.garages(id) on delete set null;
create index service_logs_garage_idx on public.service_logs (garage_id) where garage_id is not null;

-- Resolves the display name for a log: the garage name when a garage is linked (it must belong to the
-- vehicle's family), otherwise the free-text name. SECURITY INVOKER, so RLS applies.
create or replace function public.resolve_garage_name(p_vehicle_id uuid, p_garage_id uuid, p_garage text)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_name text;
begin
  if p_garage_id is null then return nullif(btrim(p_garage), ''); end if;
  select g.name into v_name
  from public.garages g join public.vehicles v on v.family_id = g.family_id
  where g.id = p_garage_id and v.id = p_vehicle_id;
  if not found then raise exception 'forbidden'; end if;
  return v_name;
end;
$$;

-- The three log RPCs get an optional trailing p_garage_id (old signatures are dropped, same transaction).
drop function public.complete_service(uuid, date, integer, text, numeric, text);
drop function public.update_service_log(uuid, date, integer, text, numeric, text);
drop function public.restore_service_log(uuid, date, integer, text, numeric, text);

create or replace function public.complete_service(
  p_vehicle_id uuid, p_date date, p_mileage integer, p_garage text, p_cost numeric, p_notes text,
  p_garage_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform 1 from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'forbidden'; end if;

  insert into public.service_logs (vehicle_id, service_date, mileage, garage, garage_id, cost, notes, created_by)
  values (p_vehicle_id, p_date, p_mileage, public.resolve_garage_name(p_vehicle_id, p_garage_id, p_garage),
          p_garage_id, p_cost, nullif(btrim(p_notes), ''), v_uid)
  returning id into v_id;

  update public.vehicles
  set mileage = p_mileage, mileage_updated_at = (now() at time zone 'Asia/Jerusalem')::date
  where id = p_vehicle_id and p_mileage > mileage;

  perform public.recompute_next_service(p_vehicle_id);
  return v_id;
end;
$$;

create or replace function public.update_service_log(
  p_log_id uuid, p_date date, p_mileage integer, p_garage text, p_cost numeric, p_notes text,
  p_garage_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_vehicle uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select vehicle_id into v_vehicle from public.service_logs where id = p_log_id;
  if not found then raise exception 'forbidden'; end if;
  update public.service_logs
     set service_date = p_date, mileage = p_mileage,
         garage = public.resolve_garage_name(v_vehicle, p_garage_id, p_garage), garage_id = p_garage_id,
         cost = p_cost, notes = nullif(btrim(p_notes), '')
   where id = p_log_id;
  perform public.recompute_next_service(v_vehicle);
  return v_vehicle;
end;
$$;

-- Restore tolerates a garage that was deleted in the meantime (keeps the text name, drops the link).
create or replace function public.restore_service_log(
  p_vehicle_id uuid, p_date date, p_mileage integer, p_garage text, p_cost numeric, p_notes text,
  p_garage_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id  uuid;
  v_gid uuid := p_garage_id;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if v_gid is not null and not exists (
    select 1 from public.garages g join public.vehicles v on v.family_id = g.family_id
    where g.id = v_gid and v.id = p_vehicle_id) then
    v_gid := null;
  end if;
  insert into public.service_logs (vehicle_id, service_date, mileage, garage, garage_id, cost, notes, created_by)
  values (p_vehicle_id, p_date, p_mileage, nullif(btrim(p_garage), ''), v_gid, p_cost, p_notes, (select auth.uid()))
  returning id into v_id;
  perform public.recompute_next_service(p_vehicle_id);
  return v_id;
end;
$$;

-- delete_service_log now also returns garage_id so an undo can re-link it.
create or replace function public.delete_service_log(p_log_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.service_logs;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  delete from public.service_logs where id = p_log_id returning * into v_row;
  if not found then raise exception 'forbidden'; end if;
  perform public.recompute_next_service(v_row.vehicle_id);
  return jsonb_build_object('vehicle_id', v_row.vehicle_id, 'service_date', v_row.service_date,
    'mileage', v_row.mileage, 'garage', v_row.garage, 'garage_id', v_row.garage_id,
    'cost', v_row.cost, 'notes', v_row.notes);
end;
$$;

revoke all on function
  public.resolve_garage_name(uuid, uuid, text),
  public.complete_service(uuid, date, integer, text, numeric, text, uuid),
  public.update_service_log(uuid, date, integer, text, numeric, text, uuid),
  public.restore_service_log(uuid, date, integer, text, numeric, text, uuid),
  public.delete_service_log(uuid)
  from public, anon;
grant execute on function
  public.resolve_garage_name(uuid, uuid, text),
  public.complete_service(uuid, date, integer, text, numeric, text, uuid),
  public.update_service_log(uuid, date, integer, text, numeric, text, uuid),
  public.restore_service_log(uuid, date, integer, text, numeric, text, uuid),
  public.delete_service_log(uuid)
  to authenticated;

------------------------------------------------------------------
-- 4. Open signup + invites
------------------------------------------------------------------
-- create_family: one family per user, enforced in the database too.
create or replace function public.create_family(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid_name'; end if;
  if exists (select 1 from public.family_members where user_id = v_uid) then raise exception 'already_in_family'; end if;
  insert into public.families (name, created_by) values (btrim(p_name), v_uid) returning id into v_id;
  insert into public.family_members (family_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;

-- Invitations addressed to the signed-in user's Google email, so a new user who skipped the invite
-- link still sees "you were invited" on the onboarding screen instead of only "create a family".
create or replace function public.my_pending_invitations()
returns table (family_name text, role text, token text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.name, i.role, i.token, i.expires_at
  from public.invitations i
  join public.families f on f.id = i.family_id
  where (select auth.uid()) is not null
    and i.status = 'pending' and i.expires_at > now()
    and i.email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  order by i.created_at desc;
$$;
revoke all on function public.my_pending_invitations() from public, anon;
grant execute on function public.my_pending_invitations() to authenticated;
