-- Phase 1.5: photo_path, DB-backed renewal undo, atomic service-log RPCs, private photo bucket.

-- 1. Columns
alter table public.vehicles
  add column photo_path   text check (photo_path is null or char_length(photo_path) <= 200),
  add column renewal_undo jsonb;   -- {"test_due":{"previous":"2026-01-01","next":"2027-01-01","at":"2026-11-15"}, ...}

-- 2. Service logs: single-transaction edit/delete/restore (SECURITY INVOKER: RLS applies)
create or replace function public.update_service_log(
  p_log_id uuid, p_date date, p_mileage integer, p_garage text, p_cost numeric, p_notes text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_vehicle uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  update public.service_logs
     set service_date = p_date, mileage = p_mileage, garage = nullif(btrim(p_garage), ''),
         cost = p_cost, notes = nullif(btrim(p_notes), '')
   where id = p_log_id returning vehicle_id into v_vehicle;
  if not found then raise exception 'forbidden'; end if;
  perform public.recompute_next_service(v_vehicle);
  return v_vehicle;
end $$;

create or replace function public.delete_service_log(p_log_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.service_logs;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  delete from public.service_logs where id = p_log_id returning * into v_row;
  if not found then raise exception 'forbidden'; end if;
  perform public.recompute_next_service(v_row.vehicle_id);
  return jsonb_build_object('vehicle_id', v_row.vehicle_id, 'service_date', v_row.service_date,
    'mileage', v_row.mileage, 'garage', v_row.garage, 'cost', v_row.cost, 'notes', v_row.notes);
end $$;

create or replace function public.restore_service_log(
  p_vehicle_id uuid, p_date date, p_mileage integer, p_garage text, p_cost numeric, p_notes text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  insert into public.service_logs (vehicle_id, service_date, mileage, garage, cost, notes, created_by)
  values (p_vehicle_id, p_date, p_mileage, p_garage, p_cost, p_notes, (select auth.uid()))
  returning id into v_id;
  perform public.recompute_next_service(p_vehicle_id);
  return v_id;
end $$;

-- 3. "Mark as renewed" + undo (30 days), stored on the vehicle row
create or replace function public.renew_due(p_vehicle_id uuid, p_field text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_prev date; v_next date;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if p_field not in ('test_due', 'license_due') then raise exception 'invalid_field'; end if;
  select case p_field when 'test_due' then test_due else license_due end into v_prev
    from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'forbidden'; end if;
  v_next := (case when v_prev is not null and v_prev > v_today then v_prev else v_today end + interval '12 months')::date;
  update public.vehicles set
    test_due    = case when p_field = 'test_due'    then v_next else test_due end,
    license_due = case when p_field = 'license_due' then v_next else license_due end,
    renewal_undo = coalesce(renewal_undo, '{}'::jsonb) ||
      jsonb_build_object(p_field, jsonb_build_object('previous', v_prev, 'next', v_next, 'at', v_today))
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
  if p_field not in ('test_due', 'license_due') then raise exception 'invalid_field'; end if;
  select renewal_undo -> p_field, case p_field when 'test_due' then test_due else license_due end
    into v_undo, v_cur from public.vehicles where id = p_vehicle_id for update;
  if not found then raise exception 'forbidden'; end if;
  if v_undo is null then raise exception 'undo_unavailable'; end if;
  if (v_undo ->> 'at')::date < v_today - 30 then raise exception 'undo_expired'; end if;
  if v_cur is distinct from (v_undo ->> 'next')::date then raise exception 'undo_stale'; end if;
  v_prev := (v_undo ->> 'previous')::date;
  update public.vehicles set
    test_due    = case when p_field = 'test_due'    then v_prev else test_due end,
    license_due = case when p_field = 'license_due' then v_prev else license_due end,
    renewal_undo = renewal_undo - p_field
  where id = p_vehicle_id;
  return v_prev;
end $$;

revoke all on function public.update_service_log(uuid, date, integer, text, numeric, text),
  public.delete_service_log(uuid), public.restore_service_log(uuid, date, integer, text, numeric, text),
  public.renew_due(uuid, text), public.undo_renew_due(uuid, text) from public, anon;
grant execute on function public.update_service_log(uuid, date, integer, text, numeric, text),
  public.delete_service_log(uuid), public.restore_service_log(uuid, date, integer, text, numeric, text),
  public.renew_due(uuid, text), public.undo_renew_due(uuid, text) to authenticated;

-- 4. Storage: private bucket, path {family_id}/{vehicle_id}.jpg
create or replace function public.can_access_vehicle_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    then public.is_family_member(split_part(p_name, '/', 1)::uuid)
         and exists (select 1 from public.vehicles v
                     where v.family_id = split_part(p_name, '/', 1)::uuid
                       and v.id::text = split_part(split_part(p_name, '/', 2), '.', 1))
    else false end;
$$;
revoke all on function public.can_access_vehicle_photo(text) from public, anon;
grant execute on function public.can_access_vehicle_photo(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

create policy vehicle_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'vehicle-photos' and (select public.can_access_vehicle_photo(name)));
create policy vehicle_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and (select public.can_access_vehicle_photo(name)));
create policy vehicle_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'vehicle-photos' and (select public.can_access_vehicle_photo(name)))
  with check (bucket_id = 'vehicle-photos' and (select public.can_access_vehicle_photo(name)));
create policy vehicle_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-photos' and (select public.can_access_vehicle_photo(name)));
