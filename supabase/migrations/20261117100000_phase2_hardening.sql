-- Phase 2 hardening (apply in the Supabase SQL Editor).
-- 1. Dates that belong to "today" use Asia/Jerusalem instead of the database's UTC.
-- 2. accept_invitation refuses users who already belong to a family (the app shows one family per user).

alter table public.vehicles
  alter column mileage_updated_at set default ((now() at time zone 'Asia/Jerusalem')::date);

create or replace function public.complete_service(
  p_vehicle_id uuid,
  p_date       date,
  p_mileage    integer,
  p_garage     text,
  p_cost       numeric,
  p_notes      text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  perform 1 from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'forbidden'; end if;

  insert into public.service_logs (vehicle_id, service_date, mileage, garage, cost, notes, created_by)
  values (p_vehicle_id, p_date, p_mileage, nullif(btrim(p_garage), ''), p_cost, nullif(btrim(p_notes), ''), v_uid)
  returning id into v_id;

  update public.vehicles
  set mileage = p_mileage,
      mileage_updated_at = (now() at time zone 'Asia/Jerusalem')::date
  where id = p_vehicle_id and p_mileage > mileage;

  perform public.recompute_next_service(p_vehicle_id);
  return v_id;
end;
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
  if exists (select 1 from public.family_members where user_id = v_uid) then
    raise exception 'already_in_family';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_inv.family_id, v_uid, v_inv.role)
  on conflict (family_id, user_id) do nothing;

  update public.invitations set status = 'accepted' where id = v_inv.id;
  return v_inv.family_id;
end;
$$;

-- Grants are unchanged (create or replace keeps them), restated for safety.
revoke all on function public.complete_service(uuid, date, integer, text, numeric, text) from public, anon;
grant execute on function public.complete_service(uuid, date, integer, text, numeric, text) to authenticated;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
