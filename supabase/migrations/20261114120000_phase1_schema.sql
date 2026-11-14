-- Phase 1: schema + RLS + triggers + RPC.
-- Apply once in the Supabase SQL Editor. Safe to read top to bottom.

------------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.family_members (
  family_id   uuid not null references public.families(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin', 'member')),
  created_at  timestamptz not null default now(),
  primary key (family_id, user_id)          -- also the unique (family_id, user_id)
);
create index family_members_user_id_idx on public.family_members (user_id);

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  email       text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        text not null default 'member' check (role in ('admin', 'member')),
  token       text not null unique
              default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at  timestamptz not null default now() + interval '7 days',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index invitations_family_id_idx on public.invitations (family_id);
create unique index invitations_one_pending_per_email on public.invitations (family_id, email) where status = 'pending';

create table public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families(id) on delete cascade,
  plate               text not null check (plate ~ '^[0-9]{7,8}$'),       -- digits only; formatted in the UI
  nickname            text check (char_length(nickname) <= 60),
  make                text not null check (char_length(btrim(make)) between 1 and 40),
  model               text not null check (char_length(btrim(model)) between 1 and 40),
  year                smallint check (year between 1950 and 2100),
  color               text check (char_length(color) <= 30),
  fuel_type           text check (fuel_type in ('petrol', 'diesel', 'hybrid', 'plug_in', 'electric')),
  mileage             integer not null default 0 check (mileage >= 0),
  mileage_updated_at  date not null default current_date,
  test_due            date,
  license_due         date,
  insurance_due       date,
  next_service_km     integer check (next_service_km >= 0),
  service_interval_km integer not null default 10000 check (service_interval_km > 0),
  notes               text check (char_length(notes) <= 2000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (family_id, plate)                 -- its index also serves family_id lookups
);

create table public.service_logs (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references public.vehicles(id) on delete cascade,
  service_date  date not null,
  mileage       integer not null check (mileage >= 0),
  garage        text check (char_length(garage) <= 80),
  cost          numeric(10, 2) check (cost >= 0),
  notes         text check (char_length(notes) <= 2000),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index service_logs_vehicle_idx on public.service_logs (vehicle_id, service_date desc);

------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER: avoids recursive RLS)
------------------------------------------------------------------
create or replace function public.is_family_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.shares_family_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.family_members me
    join public.family_members other on other.family_id = me.family_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user_id
  );
$$;

create or replace function public.can_access_vehicle(p_vehicle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.vehicles v
    join public.family_members fm on fm.family_id = v.family_id
    where v.id = p_vehicle_id and fm.user_id = (select auth.uid())
  );
$$;

------------------------------------------------------------------
-- 3. Triggers
------------------------------------------------------------------
-- 3a. Profile row on first login
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who already signed in before this migration
insert into public.profiles (id, full_name, email)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'), email
from auth.users
on conflict (id) do nothing;

-- 3b. Never remove or demote the last admin of a family
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_other_admins integer;
begin
  if old.role <> 'admin' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;
  -- The family itself is being deleted (cascade): allow.
  if not exists (select 1 from public.families where id = old.family_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- Lock the admin rows so two concurrent demotions cannot both pass the check.
  perform 1 from public.family_members where family_id = old.family_id and role = 'admin' for update;
  select count(*) into v_other_admins
  from public.family_members
  where family_id = old.family_id and role = 'admin' and user_id <> old.user_id;
  if v_other_admins = 0 then
    raise exception 'last_admin';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger family_members_protect_last_admin
  before update of role or delete on public.family_members
  for each row execute function public.protect_last_admin();

-- 3c. vehicles: maintain updated_at, forbid moving a vehicle to another family
create or replace function public.vehicles_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.family_id <> old.family_id then
    raise exception 'forbidden';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger vehicles_before_update
  before update on public.vehicles
  for each row execute function public.vehicles_before_update();

------------------------------------------------------------------
-- 4. RPC functions (the only way to create families / invitations / memberships)
------------------------------------------------------------------
create or replace function public.create_family(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid_name'; end if;
  insert into public.families (name, created_by) values (btrim(p_name), v_uid) returning id into v_id;
  insert into public.family_members (family_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;

create or replace function public.create_invitation(p_family_id uuid, p_email text, p_role text default 'member')
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_family_admin(p_family_id) then raise exception 'forbidden'; end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (
    select 1 from public.family_members fm
    join public.profiles p on p.id = fm.user_id
    where fm.family_id = p_family_id and lower(p.email) = v_email
  ) then
    raise exception 'already_member';
  end if;

  update public.invitations set status = 'expired'
  where family_id = p_family_id and email = v_email and status = 'pending' and expires_at <= now();

  begin
    insert into public.invitations (family_id, email, role, created_by)
    values (p_family_id, v_email, p_role, v_uid)
    returning token into v_token;
  exception when unique_violation then
    raise exception 'invite_exists';
  end;
  return v_token;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select family_id into v_family from public.invitations where id = p_invitation_id;
  if v_family is null then raise exception 'invitation_invalid'; end if;
  if not public.is_family_admin(v_family) then raise exception 'forbidden'; end if;
  update public.invitations set status = 'revoked' where id = p_invitation_id and status = 'pending';
end;
$$;

-- Callable before login (the /invite/[token] page). Returns only what the page must show.
create or replace function public.get_invitation_preview(p_token text)
returns table (family_name text, role text, status text, email_matches boolean)
language sql stable security definer set search_path = '' as $$
  select
    f.name,
    i.role,
    case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
    case when (select auth.uid()) is null then null
         else i.email = lower(coalesce((select auth.jwt()) ->> 'email', '')) end
  from public.invitations i
  join public.families f on f.id = i.family_id
  where i.token = p_token;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_inv   public.invitations;
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.invitations where token = p_token for update;
  if not found then raise exception 'invitation_invalid'; end if;
  if v_inv.status = 'revoked'  then raise exception 'invitation_revoked'; end if;
  if v_inv.status = 'accepted' then raise exception 'invitation_used'; end if;
  if v_inv.status = 'expired' or v_inv.expires_at <= now() then raise exception 'invitation_expired'; end if;
  if v_inv.email <> v_email then raise exception 'email_mismatch'; end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_inv.family_id, v_uid, v_inv.role)
  on conflict (family_id, user_id) do nothing;

  update public.invitations set status = 'accepted' where id = v_inv.id;
  return v_inv.family_id;
end;
$$;

------------------------------------------------------------------
-- 5. Privileges: start from zero, grant only what the app needs
------------------------------------------------------------------
revoke all on public.profiles, public.families, public.family_members,
              public.invitations, public.vehicles, public.service_logs
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select on public.families to authenticated;
grant update (name) on public.families to authenticated;

grant select, delete on public.family_members to authenticated;
grant update (role) on public.family_members to authenticated;

grant select on public.invitations to authenticated;

grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.service_logs to authenticated;

revoke all on function
  public.is_family_member(uuid), public.is_family_admin(uuid), public.shares_family_with(uuid),
  public.can_access_vehicle(uuid), public.create_family(text), public.create_invitation(uuid, text, text),
  public.revoke_invitation(uuid), public.accept_invitation(text), public.get_invitation_preview(text)
  from public, anon;

grant execute on function
  public.is_family_member(uuid), public.is_family_admin(uuid), public.shares_family_with(uuid),
  public.can_access_vehicle(uuid), public.create_family(text), public.create_invitation(uuid, text, text),
  public.revoke_invitation(uuid), public.accept_invitation(text)
  to authenticated;

grant execute on function public.get_invitation_preview(text) to anon, authenticated;

------------------------------------------------------------------
-- 6. Row Level Security
------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.invitations    enable row level security;
alter table public.vehicles       enable row level security;
alter table public.service_logs   enable row level security;

-- profiles: yourself + people who share a family with you
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.shares_family_with(id)));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- families: members read, admins rename. Creation only through create_family().
create policy families_select on public.families for select to authenticated
  using ((select public.is_family_member(id)));
create policy families_update on public.families for update to authenticated
  using ((select public.is_family_admin(id))) with check ((select public.is_family_admin(id)));

-- family_members: members read; admins change roles; admin removes anyone, a member can leave.
-- Joining only through create_family() / accept_invitation(). Last-admin rule: trigger above.
create policy family_members_select on public.family_members for select to authenticated
  using ((select public.is_family_member(family_id)));
create policy family_members_update_role on public.family_members for update to authenticated
  using ((select public.is_family_admin(family_id))) with check ((select public.is_family_member(family_id)));
create policy family_members_delete on public.family_members for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_family_admin(family_id)));

-- invitations: admins read (they copy the link). Writes only through RPC.
create policy invitations_select on public.invitations for select to authenticated
  using ((select public.is_family_admin(family_id)));

-- vehicles: members read/update; only admins add and delete
create policy vehicles_select on public.vehicles for select to authenticated
  using ((select public.is_family_member(family_id)));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check ((select public.is_family_admin(family_id)));
create policy vehicles_update on public.vehicles for update to authenticated
  using ((select public.is_family_member(family_id))) with check ((select public.is_family_member(family_id)));
create policy vehicles_delete on public.vehicles for delete to authenticated
  using ((select public.is_family_admin(family_id)));

-- service_logs: any member of the vehicle's family
create policy service_logs_all on public.service_logs for all to authenticated
  using ((select public.can_access_vehicle(vehicle_id)))
  with check ((select public.can_access_vehicle(vehicle_id)));
