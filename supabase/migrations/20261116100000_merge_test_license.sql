-- Phase 1.5 fixes: for private cars the annual license renewal requires passing the test, so
-- "test" and "license" are ONE date. license_due is the source of truth; test_due is deprecated
-- (kept, unused, so nothing is dropped destructively).

-- 1. Backfill: where a vehicle had both dates, keep the earlier (more conservative) one.
update public.vehicles
set license_due = case
  when license_due is null then test_due
  when test_due is null then license_due
  else least(license_due, test_due)
end
where test_due is not null;

comment on column public.vehicles.test_due is 'Deprecated: merged into license_due (test + license are one date). Not used by the app.';

-- 2. Renew / undo now apply to license_due only (same signatures, same 30-day undo).
create or replace function public.renew_due(p_vehicle_id uuid, p_field text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_prev date; v_next date;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if p_field <> 'license_due' then raise exception 'invalid_field'; end if;
  select license_due into v_prev from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'forbidden'; end if;
  v_next := (case when v_prev is not null and v_prev > v_today then v_prev else v_today end + interval '12 months')::date;
  update public.vehicles set
    license_due = v_next,
    renewal_undo = coalesce(renewal_undo, '{}'::jsonb) ||
      jsonb_build_object('license_due', jsonb_build_object('previous', v_prev, 'next', v_next, 'at', v_today))
  where id = p_vehicle_id;
  return jsonb_build_object('previous', v_prev, 'next', v_next);
end $$;

create or replace function public.undo_renew_due(p_vehicle_id uuid, p_field text)
returns date language plpgsql security invoker set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_undo jsonb; v_cur date; v_prev date;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if p_field <> 'license_due' then raise exception 'invalid_field'; end if;
  select renewal_undo -> 'license_due', license_due into v_undo, v_cur
    from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'forbidden'; end if;
  if v_undo is null then raise exception 'undo_unavailable'; end if;
  if (v_undo ->> 'at')::date < v_today - 30 then raise exception 'undo_expired'; end if;
  if v_cur is distinct from (v_undo ->> 'next')::date then raise exception 'undo_stale'; end if;
  v_prev := (v_undo ->> 'previous')::date;
  update public.vehicles set license_due = v_prev, renewal_undo = renewal_undo - 'license_due'
  where id = p_vehicle_id;
  return v_prev;
end $$;
