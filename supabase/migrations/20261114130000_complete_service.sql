-- Phase 1, part 2: atomic "service done" + next-service recomputation.
-- Both functions are SECURITY INVOKER, so every statement runs under the caller's RLS
-- (any family member may do this; non-members and anonymous callers get nothing).

-- Recomputes vehicles.next_service_km from the latest remaining service log
-- (log mileage + service_interval_km), or NULL when the vehicle has no logs.
create or replace function public.recompute_next_service(p_vehicle_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  update public.vehicles v
  set next_service_km = (
    select l.mileage + v.service_interval_km
    from public.service_logs l
    where l.vehicle_id = v.id
    order by l.service_date desc, l.mileage desc, l.created_at desc
    limit 1
  )
  where v.id = p_vehicle_id;
end;
$$;

-- One transaction: insert the log, raise the odometer only if the new reading is higher,
-- and move next_service_km to (latest log mileage + interval).
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

  -- Lock the vehicle row (RLS: members only) so concurrent calls serialize.
  perform 1 from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'forbidden'; end if;

  insert into public.service_logs (vehicle_id, service_date, mileage, garage, cost, notes, created_by)
  values (p_vehicle_id, p_date, p_mileage, nullif(btrim(p_garage), ''), p_cost, nullif(btrim(p_notes), ''), v_uid)
  returning id into v_id;

  update public.vehicles
  set mileage = p_mileage,
      mileage_updated_at = current_date
  where id = p_vehicle_id and p_mileage > mileage;

  perform public.recompute_next_service(p_vehicle_id);
  return v_id;
end;
$$;

revoke all on function public.recompute_next_service(uuid) from public, anon;
revoke all on function public.complete_service(uuid, date, integer, text, numeric, text) from public, anon;
grant execute on function public.recompute_next_service(uuid) to authenticated;
grant execute on function public.complete_service(uuid, date, integer, text, numeric, text) to authenticated;
