-- Personal group: a signed-in user with no membership gets one group named "הרכבים שלי".
-- Accepting an invitation deletes that group only when the user is its only member and it has
-- zero vehicles. Apply once in the Supabase SQL Editor (Frankfurt). Safe to read top to bottom.

------------------------------------------------------------------
-- 1. One membership per user. Abort if existing data already has duplicates.
------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.family_members group by user_id having count(*) > 1
  ) then
    raise exception 'duplicate_memberships';
  end if;
end $$;

create unique index family_members_one_per_user on public.family_members (user_id);

------------------------------------------------------------------
-- 2. create_family: same rule as before, serialized per user so it cannot race the helper below.
------------------------------------------------------------------
create or replace function public.create_family(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid_name'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if exists (select 1 from public.family_members where user_id = v_uid) then raise exception 'already_in_family'; end if;
  insert into public.families (name, created_by) values (btrim(p_name), v_uid) returning id into v_id;
  insert into public.family_members (family_id, user_id, role) values (v_id, v_uid, 'admin');
  return v_id;
end;
$$;

------------------------------------------------------------------
-- 3. Idempotent personal group. Returns the user's existing family when they already have one.
------------------------------------------------------------------
create or replace function public.ensure_personal_family()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  select family_id into v_id from public.family_members where user_id = v_uid;
  if v_id is not null then return v_id; end if;

  begin
    insert into public.families (name, created_by) values ('הרכבים שלי', v_uid) returning id into v_id;
    insert into public.family_members (family_id, user_id, role) values (v_id, v_uid, 'admin');
    return v_id;
  exception when unique_violation then
    delete from public.families f
    where f.id = v_id and not exists (select 1 from public.family_members m where m.family_id = f.id);
    select family_id into v_id from public.family_members where user_id = v_uid;
    if v_id is null then raise exception 'already_in_family'; end if;
    return v_id;
  end;
end;
$$;

revoke all on function public.ensure_personal_family() from public, anon;
grant execute on function public.ensure_personal_family() to authenticated;

------------------------------------------------------------------
-- 4. Accept an invitation. An empty solo group is removed in this same transaction.
--    A group with vehicles, or with any other member, is left untouched.
------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := (select auth.uid());
  v_inv      public.invitations;
  v_email    text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_existing uuid;
  v_vehicles integer;
  v_members  integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  select * into v_inv from public.invitations where token = p_token for update;
  if not found then raise exception 'invitation_invalid'; end if;
  if v_inv.status = 'revoked'  then raise exception 'invitation_revoked'; end if;
  if v_inv.status = 'accepted' then raise exception 'invitation_used'; end if;
  if v_inv.status = 'expired' or v_inv.expires_at <= now() then raise exception 'invitation_expired'; end if;
  if v_inv.email <> v_email then raise exception 'email_mismatch'; end if;

  select family_id into v_existing from public.family_members where user_id = v_uid;
  if v_existing is not null then
    select count(*) into v_vehicles from public.vehicles where family_id = v_existing;
    select count(*) into v_members from public.family_members where family_id = v_existing;
    if v_vehicles > 0 then raise exception 'group_has_vehicles'; end if;
    if v_members <> 1 then raise exception 'group_has_members'; end if;
    -- Cascades to members, invitations and garages. The last-admin trigger allows the
    -- member delete once this family row is gone. Vehicles were counted above.
    delete from public.families where id = v_existing;
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_inv.family_id, v_uid, v_inv.role)
  on conflict (family_id, user_id) do nothing;

  update public.invitations set status = 'accepted' where id = v_inv.id;
  return v_inv.family_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
