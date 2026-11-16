\set ON_ERROR_STOP on
create table public.zz_results(n serial, name text, got text, want text);
create function public.run_as(uid uuid, em text, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'email', em)::text end, true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
  execute q;
  execute 'reset role';
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
create function public.cnt_as(uid uuid, em text, q text) returns text language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'email', em)::text end, true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
  execute 'select count(*) from (' || q || ') s' into v;
  execute 'reset role';
  return v::text;
exception when others then
  return sqlerrm;
end $$;
create function public.chk(p_name text, p_got text, p_want text) returns void language sql as $$
  insert into public.zz_results(name, got, want) values (p_name, p_got, p_want);
$$;
-- users
insert into auth.users(id,email,raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x.com','{"full_name":"Avi"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','{"name":"Dana"}'),
 ('cccccccc-0000-0000-0000-000000000003','c@x.com','{}');
select chk('profile trigger', (select count(*)::text from public.profiles), '3');

-- A creates family
select chk('create_family', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ select public.create_family('Cohen') $q$), 'ok');
select chk('A sees family', public.cnt_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com','select * from public.families'), '1');
select chk('B cannot see family', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','select * from public.families'), '0');
select chk('direct insert family blocked', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into public.families(name) values ('x') $q$), 'permission denied for table families');
select chk('direct insert membership blocked', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.family_members(family_id,user_id,role) select id,'bbbbbbbb-0000-0000-0000-000000000002','admin' from public.families $q$), 'permission denied for table family_members');

-- vehicles
create temp table fam as select id from public.families limit 1;
grant select on fam to authenticated;
select chk('A insert vehicle', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into public.vehicles(family_id,plate,make,model) select id,'1234567','Toyota','Corolla' from fam $q$), 'ok');
select chk('dup plate blocked', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into public.vehicles(family_id,plate,make,model) select id,'1234567','Toyota','Corolla' from fam $q$), 'duplicate key value violates unique constraint "vehicles_family_id_plate_key"');
select chk('bad plate blocked', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into public.vehicles(family_id,plate,make,model) select id,'12AB','T','C' from fam $q$), 'new row for relation "vehicles" violates check constraint "vehicles_plate_check"');
select chk('B cannot see vehicles', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','select * from public.vehicles'), '0');
select chk('B cannot insert into A family', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.vehicles(family_id,plate,make,model) select id,'7654321','M','3' from fam $q$), 'new row violates row-level security policy for table "vehicles"');
select chk('anon blocked', public.cnt_as(null,null,'select * from public.vehicles'), 'permission denied for table vehicles');

-- invitations
create temp table inv_tok(t text);
grant all on inv_tok to authenticated;
select chk('B cannot invite (not member)', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.create_invitation((select id from fam),'c@x.com') $q$), 'forbidden');
select chk('A invites B', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into inv_tok select public.create_invitation((select id from fam),'B@X.com ','member') $q$), 'ok');
select chk('dup pending invite', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ select public.create_invitation((select id from fam),'b@x.com') $q$), 'invite_exists');
select chk('token hidden from non-admin', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','select * from public.invitations'), '0');
select chk('admin sees invite', public.cnt_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com','select * from public.invitations'), '1');
select chk('anon preview works', public.cnt_as(null,null,format('select * from public.get_invitation_preview(%L)', (select t from inv_tok))), '1');
select chk('anon preview email_matches null', (select email_matches::text from public.get_invitation_preview((select t from inv_tok))), null);
select chk('anon cannot accept', public.run_as(null,null,format('select public.accept_invitation(%L)', (select t from inv_tok))), 'permission denied for function accept_invitation');
select chk('wrong email cannot accept', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok))), 'email_mismatch');
select chk('bad token', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.accept_invitation('nope') $q$), 'invitation_invalid');
select chk('B accepts', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok))), 'ok');
select chk('accept twice', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok))), 'invitation_used');
select chk('B now sees vehicle', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','select * from public.vehicles'), '1');
select chk('member cannot insert vehicle', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.vehicles(family_id,plate,make,model) select id,'7654321','M','3' from fam $q$), 'new row violates row-level security policy for table "vehicles"');
select chk('B sees A profile', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','select * from public.profiles'), '2');
select chk('C sees only self profile', public.cnt_as('cccccccc-0000-0000-0000-000000000003','c@x.com','select * from public.profiles'), '1');

-- member restrictions
select chk('member delete runs', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','delete from public.vehicles'), 'ok');
select chk('member delete vehicle = 0 rows', (select count(*)::text from public.vehicles), '1');
select chk('member update vehicle ok', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ update public.vehicles set mileage=500 $q$), 'ok');
select chk('member mileage persisted', (select mileage::text from public.vehicles), '500');
select chk('updated_at trigger', (select (updated_at > created_at)::text from public.vehicles where plate='1234567'), 'true');
select chk('member cannot invite', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.create_invitation((select id from fam),'c@x.com') $q$), 'forbidden');
select chk('self-promote runs', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ update public.family_members set role='admin' where user_id='bbbbbbbb-0000-0000-0000-000000000002' $q$), 'ok');
select chk('member cannot self-promote', (select role from public.family_members where user_id='bbbbbbbb-0000-0000-0000-000000000002'), 'member');
select chk('cannot change family_id column', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ update public.family_members set family_id=gen_random_uuid() $q$), 'permission denied for table family_members');
select chk('delete other runs', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ delete from public.family_members where user_id='aaaaaaaa-0000-0000-0000-000000000001' $q$), 'ok');
select chk('member cannot delete other member', (select count(*)::text from public.family_members), '2');

-- last admin
select chk('last admin cannot demote self', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ update public.family_members set role='member' where user_id='aaaaaaaa-0000-0000-0000-000000000001' $q$), 'last_admin');
select chk('last admin cannot leave', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ delete from public.family_members where user_id='aaaaaaaa-0000-0000-0000-000000000001' $q$), 'last_admin');
select chk('admin promotes B', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ update public.family_members set role='admin' where user_id='bbbbbbbb-0000-0000-0000-000000000002' $q$), 'ok');
select chk('A demotes self with 2 admins', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ update public.family_members set role='member' where user_id='aaaaaaaa-0000-0000-0000-000000000001' $q$), 'ok');
select chk('B now last admin cannot demote', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ update public.family_members set role='member' where user_id='bbbbbbbb-0000-0000-0000-000000000002' $q$), 'last_admin');
select chk('A (member) can leave', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ delete from public.family_members where user_id='aaaaaaaa-0000-0000-0000-000000000001' $q$), 'ok');
select chk('admin delete runs', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','delete from public.vehicles'), 'ok');
select chk('B admin deletes vehicle', (select count(*)::text from public.vehicles), '0');

-- expired / revoked
select chk('invite C (expired test)', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into inv_tok select public.create_invitation((select id from fam),'c@x.com') $q$), 'ok');
update public.invitations set expires_at = now() - interval '1 minute' where email='c@x.com' and status='pending';
select chk('expired invite fails', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok order by ctid desc limit 1))), 'invitation_expired');
select chk('preview shows expired', (select status from public.get_invitation_preview((select t from inv_tok order by ctid desc limit 1))), 'expired');
select chk('re-invite after expiry works', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into inv_tok select public.create_invitation((select id from fam),'c@x.com') $q$), 'ok');
select chk('revoke invite', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.revoke_invitation((select id from public.invitations where email='c@x.com' and status='pending')) $q$), 'ok');
select chk('revoked invite fails', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok order by ctid desc limit 1))), 'invitation_revoked');
create temp table inv_id as select id from public.invitations limit 1; grant select on inv_id to authenticated;
select chk('non-admin cannot revoke', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.revoke_invitation((select id from inv_id)) $q$), 'forbidden');

-- service logs + family move trigger
select chk('B inserts vehicle', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.vehicles(family_id,plate,make,model) select id,'8888888','K','P' from fam $q$), 'ok');
select chk('B inserts log', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.service_logs(vehicle_id,service_date,mileage) select id,current_date,100 from public.vehicles $q$), 'ok');
select chk('C cannot see logs', public.cnt_as('cccccccc-0000-0000-0000-000000000003','c@x.com','select * from public.service_logs'), '0');
create temp table veh_id as select id from public.vehicles limit 1; grant select on veh_id to authenticated;
select chk('C cannot insert log', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ insert into public.service_logs(vehicle_id,service_date,mileage) values ((select id from veh_id),current_date,1) $q$), 'new row violates row-level security policy for table "service_logs"');
select chk('B cannot create a 2nd family (single-family guard)', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.create_family('Two') $q$), 'already_in_family');
insert into public.families(name, created_by) values ('Two', 'bbbbbbbb-0000-0000-0000-000000000002');
do $$
begin
  insert into public.family_members(family_id, user_id, role)
  select id, 'bbbbbbbb-0000-0000-0000-000000000002', 'admin' from public.families where name='Two';
  perform public.chk('second membership blocked by unique index', 'inserted', 'duplicate key value violates unique constraint "family_members_one_per_user"');
exception when unique_violation then
  perform public.chk('second membership blocked by unique index', sqlerrm, 'duplicate key value violates unique constraint "family_members_one_per_user"');
end $$;
select chk('cannot move vehicle across families', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ update public.vehicles set family_id=(select id from public.families where name='Two') $q$), 'new row violates row-level security policy for table "vehicles"');

-- cascade delete of a family with its only admin (as superuser)
delete from public.families where name='Two';
select chk('family delete cascades past trigger', (select count(*)::text from public.families where name='Two'), '0');

-- complete_service (migration 20261114130000). veh_id = vehicle 8888888 (family 'fam'), B is admin, C is not a member.
select chk('complete_service: member runs', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.complete_service((select id from veh_id), current_date, 20000, ' Garage ', 450.50, 'oil') $q$), 'ok');
select chk('complete_service: log inserted', (select count(*)::text from public.service_logs where vehicle_id=(select id from veh_id)), '2');
select chk('complete_service: garage trimmed', (select garage from public.service_logs where mileage=20000), 'Garage');
select chk('complete_service: mileage raised', (select mileage::text from public.vehicles where id=(select id from veh_id)), '20000');
select chk('complete_service: mileage_updated_at', (select (mileage_updated_at = (now() at time zone 'Asia/Jerusalem')::date)::text from public.vehicles where id=(select id from veh_id)), 'true');
select chk('complete_service: next_service_km = mileage + interval', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), '30000');
select chk('complete_service: older/lower service keeps mileage', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.complete_service((select id from veh_id), current_date - 100, 5000, null, null, null) $q$), 'ok');
select chk('complete_service: mileage not lowered', (select mileage::text from public.vehicles where id=(select id from veh_id)), '20000');
select chk('complete_service: next service follows latest log', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), '30000');
select chk('complete_service: non-member forbidden', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.complete_service((select id from veh_id), current_date, 99999, null, null, null) $q$), 'forbidden');
select chk('complete_service: anon blocked', public.run_as(null,null,$q$ select public.complete_service(gen_random_uuid(), current_date, 1, null, null, null) $q$), 'permission denied for function complete_service');
select chk('complete_service: bad data rolls back everything', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.complete_service((select id from veh_id), current_date, -1, null, null, null) $q$), 'new row for relation "service_logs" violates check constraint "service_logs_mileage_check"');
select chk('complete_service: still 3 logs', (select count(*)::text from public.service_logs where vehicle_id=(select id from veh_id)), '3');
select chk('recompute: member deletes latest log', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ delete from public.service_logs where mileage=20000 $q$), 'ok');
select chk('recompute: runs', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.recompute_next_service((select id from veh_id)) $q$), 'ok');
select chk('recompute: falls back to latest remaining log', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), '10100');
select chk('recompute: C cannot change another family vehicle', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.recompute_next_service((select id from veh_id)) $q$), 'ok');
select chk('recompute: C changed nothing', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), '10100');
delete from public.service_logs;
select chk('recompute: no logs gives null', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.recompute_next_service((select id from veh_id)) $q$), 'ok');
select chk('recompute: next_service_km null', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), null);

-- Phase 1.5 checks (migration 20261115100000). Spliced into rls_tests.sql before its final select.
-- B is admin of fam; veh_id = vehicle 8888888; C is not a member.
select chk('p15: B restores a log via RPC', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.restore_service_log((select id from veh_id), current_date, 1000, 'G', 10, 'n') $q$), 'ok');
select chk('p15: next_service after restore', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), '11000');
select chk('p15: update_service_log recomputes', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.update_service_log((select id from public.service_logs limit 1), current_date, 2500, ' Z ', null, null) $q$), 'ok');
select chk('p15: next_service after update', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), '12500');
select chk('p15: garage trimmed', (select garage from public.service_logs limit 1), 'Z');
select chk('p15: C cannot update log', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.update_service_log((select id from public.service_logs limit 1), current_date, 1, null, null, null) $q$), 'forbidden');
select chk('p15: C cannot delete log', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.delete_service_log((select id from public.service_logs limit 1)) $q$), 'forbidden');
select chk('p15: anon cannot delete log', public.run_as(null,null,$q$ select public.delete_service_log(gen_random_uuid()) $q$), 'permission denied for function delete_service_log');
select chk('p15: delete_service_log ok', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.delete_service_log((select id from public.service_logs limit 1)) $q$), 'ok');
select chk('p15: next_service null after deleting last log', (select next_service_km::text from public.vehicles where id=(select id from veh_id)), null);

update public.vehicles set license_due = current_date + 10 where id=(select id from veh_id);
select chk('p15: renew_due ok', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.renew_due((select id from veh_id), 'license_due') $q$), 'ok');
select chk('p15: renewed +12 months from old date', (select (license_due = (current_date + 10 + interval '12 months')::date)::text from public.vehicles where id=(select id from veh_id)), 'true');
select chk('p15: undo info stored', (select ((renewal_undo -> 'license_due' ->> 'previous')::date = current_date + 10)::text from public.vehicles where id=(select id from veh_id)), 'true');
select chk('p15: renew bad field', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.renew_due((select id from veh_id), 'insurance_due') $q$), 'invalid_field');
select chk('p15: test_due no longer renewable', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.renew_due((select id from veh_id), 'test_due') $q$), 'invalid_field');
select chk('p15: C cannot renew', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.renew_due((select id from veh_id), 'license_due') $q$), 'forbidden');
select chk('p15: undo ok', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.undo_renew_due((select id from veh_id), 'license_due') $q$), 'ok');
select chk('p15: date restored', (select (license_due = current_date + 10)::text from public.vehicles where id=(select id from veh_id)), 'true');
select chk('p15: undo cleared', (select (renewal_undo ? 'license_due')::text from public.vehicles where id=(select id from veh_id)), 'false');
select chk('p15: undo again unavailable', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.undo_renew_due((select id from veh_id), 'license_due') $q$), 'undo_unavailable');
update public.vehicles set license_due = null where id=(select id from veh_id);
select chk('p15: renew from null date', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.renew_due((select id from veh_id), 'license_due') $q$), 'ok');
update public.vehicles set license_due = license_due + 5 where id=(select id from veh_id);
select chk('p15: undo stale after manual edit', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.undo_renew_due((select id from veh_id), 'license_due') $q$), 'undo_stale');
update public.vehicles set renewal_undo = jsonb_build_object('license_due', jsonb_build_object('previous', null, 'next', license_due, 'at', current_date - 31)) where id=(select id from veh_id);
select chk('p15: undo expired after 30 days', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select public.undo_renew_due((select id from veh_id), 'license_due') $q$), 'undo_expired');
-- migration 20261116100000 backfill (same statement as in the migration): earlier date wins
update public.vehicles set test_due = date '2027-01-01', license_due = date '2027-06-01' where id=(select id from veh_id);
update public.vehicles set license_due = case when license_due is null then test_due when test_due is null then license_due else least(license_due, test_due) end where test_due is not null;
select chk('p16: merged to earlier date', (select license_due::text from public.vehicles where id=(select id from veh_id)), '2027-01-01');
update public.vehicles set test_due = date '2027-03-01', license_due = null where id=(select id from veh_id);
update public.vehicles set license_due = case when license_due is null then test_due when test_due is null then license_due else least(license_due, test_due) end where test_due is not null;
select chk('p16: test-only vehicle keeps its date', (select license_due::text from public.vehicles where id=(select id from veh_id)), '2027-03-01');

create temp table photo_path as select (select id from fam)::text || '/' || (select id from veh_id)::text || '.jpg' as p;
grant select on photo_path to authenticated;
select chk('p15: member can access own path', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select 1 where public.can_access_vehicle_photo((select p from photo_path)) $q$), '1');
select chk('p15: non-member cannot access path', public.cnt_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select 1 where public.can_access_vehicle_photo((select p from photo_path)) $q$), '0');
select chk('p15: wrong vehicle id denied', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select 1 where public.can_access_vehicle_photo((select id from fam)::text || '/' || gen_random_uuid()::text || '.jpg') $q$), '0');
select chk('p15: malformed path denied', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ select 1 where public.can_access_vehicle_photo('../x.jpg') $q$), '0');
insert into storage.objects(bucket_id, name) select 'vehicle-photos', p from photo_path;
select chk('p15: storage select member', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','select * from storage.objects'), '1');
select chk('p15: storage select non-member', public.cnt_as('cccccccc-0000-0000-0000-000000000003','c@x.com','select * from storage.objects'), '0');
select chk('p15: storage insert by non-member blocked', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ insert into storage.objects(bucket_id,name) select 'vehicle-photos', p from photo_path $q$), 'new row violates row-level security policy for table "objects"');

-- phase 2: a user who already belongs to a family cannot accept another invitation
select chk('p2: C creates own family', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.create_family('Levi') $q$), 'ok');
create temp table inv_tok2(t text);
grant all on inv_tok2 to authenticated;
select chk('p2: A creates own family', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ select public.create_family('Mizrahi') $q$), 'ok');
select chk('p2: A invites C', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into inv_tok2 select public.create_invitation((select id from public.families where name='Mizrahi'),'c@x.com','member') $q$), 'ok');
select chk('p2: C adds vehicle', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ insert into public.vehicles(family_id,plate,make,model) select id,'5551234','Kia','Niro' from public.families where name='Levi' $q$), 'ok');
select chk('p2: existing member with vehicles cannot accept', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok2))), 'group_has_vehicles');
select chk('p2: C vehicle kept', (select count(*)::text from public.vehicles where plate='5551234'), '1');
select chk('p2: complete_service still works', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.complete_service((select id from public.vehicles where plate='5551234'), current_date, 1000, null, null, null) $q$), 'ok');

-- phase 2 features: garages, garage-linked logs, create_family guard, my_pending_invitations
select chk('g: member adds garage', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.garages(family_id,name,phone) select id,'Moshe Garage','03-1234567' from fam $q$), 'ok');
select chk('g: bad phone rejected', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.garages(family_id,name,phone) select id,'Bad','abc' from fam $q$), 'new row for relation "garages" violates check constraint "garages_phone_check"');
select chk('g: duplicate name (case-insensitive) rejected', public.run_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com',$q$ insert into public.garages(family_id,name) select id,' moshe garage ' from fam $q$), 'duplicate key value violates unique constraint "garages_family_name_key"');
select chk('g: other family cannot see', public.cnt_as('cccccccc-0000-0000-0000-000000000003','c@x.com','select * from public.garages'), '0');
select chk('g: other family cannot insert', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ insert into public.garages(family_id,name) select id,'Evil' from fam $q$), 'new row violates row-level security policy for table "garages"');
select chk('g: anon blocked', public.cnt_as(null,null,'select * from public.garages'), 'permission denied for table garages');
select chk('g: C adds garage in own family', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ insert into public.garages(family_id,name) select id,'Levi Garage' from public.families where name='Levi' $q$), 'ok');
select chk('g: cannot move garage to another family', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ update public.garages set family_id=(select id from fam) where name='Levi Garage' $q$), 'forbidden');
select chk('g: complete_service links garage', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.complete_service((select id from public.vehicles where plate='5551234'), current_date, 2000, 'ignored', null, null, (select id from public.garages where name='Levi Garage')) $q$), 'ok');
select chk('g: log carries garage name and id', (select (garage = 'Levi Garage' and garage_id is not null)::text from public.service_logs where mileage=2000), 'true');
create temp table moshe_id as select id from public.garages where name='Moshe Garage';
grant select on moshe_id to authenticated;
select chk('g: foreign garage id rejected', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.complete_service((select id from public.vehicles where plate='5551234'), current_date, 2100, null, null, null, (select id from moshe_id)) $q$), 'forbidden');
select chk('g: foreign garage rolled back (no log)', (select count(*)::text from public.service_logs where mileage=2100), '0');
select chk('g: delete_service_log returns garage_id', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select (public.delete_service_log((select id from public.service_logs where mileage=2000)) ->> 'garage_id') is not null $q$), 'ok');
select chk('g: admin deletes garage', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ delete from public.garages where name='Levi Garage' $q$), 'ok');
select chk('g: garage gone', (select count(*)::text from public.garages where name='Levi Garage'), '0');
select chk('g: non-admin cannot delete (0 rows)', (select count(*)::text from public.garages where name='Moshe Garage'), '1');
select chk('p2: create_family refused when already member', public.run_as('cccccccc-0000-0000-0000-000000000003','c@x.com',$q$ select public.create_family('Another') $q$), 'already_in_family');
select chk('p2: pending invitations for invitee', public.cnt_as('cccccccc-0000-0000-0000-000000000003','c@x.com','select * from public.my_pending_invitations()'), '1');
select chk('p2: pending invitations hidden from others', public.cnt_as('bbbbbbbb-0000-0000-0000-000000000002','b@x.com','select * from public.my_pending_invitations()'), '0');
select chk('p2: pending invitations anon blocked', public.cnt_as(null,null,'select * from public.my_pending_invitations()'), 'permission denied for function my_pending_invitations');

-- personal group: idempotent create, accept replaces an empty solo group, refuses when anyone else is in it
insert into auth.users(id,email) values
 ('dddddddd-0000-0000-0000-000000000004','d@x.com'),
 ('eeeeeeee-0000-0000-0000-000000000005','e@x.com'),
 ('ffffffff-0000-0000-0000-000000000006','f@x.com');
select chk('ensure anon blocked', public.run_as(null,null,$q$ select public.ensure_personal_family() $q$), 'permission denied for function ensure_personal_family');
select chk('ensure creates', public.run_as('dddddddd-0000-0000-0000-000000000004','d@x.com',$q$ select public.ensure_personal_family() $q$), 'ok');
select chk('ensure name', (select f.name from public.families f join public.family_members m on m.family_id=f.id where m.user_id='dddddddd-0000-0000-0000-000000000004'), 'הרכבים שלי');
select chk('ensure again', public.run_as('dddddddd-0000-0000-0000-000000000004','d@x.com',$q$ select public.ensure_personal_family() $q$), 'ok');
select chk('ensure one membership', (select count(*)::text from public.family_members where user_id='dddddddd-0000-0000-0000-000000000004'), '1');
create temp table inv_tok3(t text);
grant all on inv_tok3 to authenticated;
select chk('A invites D', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into inv_tok3 select public.create_invitation((select id from public.families where name='Mizrahi'),'d@x.com','member') $q$), 'ok');
select chk('D accepts empty group', public.run_as('dddddddd-0000-0000-0000-000000000004','d@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok3))), 'ok');
select chk('personal group deleted', (select count(*)::text from public.families where name='הרכבים שלי'), '0');
select chk('D joined Mizrahi', (select f.name from public.families f join public.family_members m on m.family_id=f.id where m.user_id='dddddddd-0000-0000-0000-000000000004'), 'Mizrahi');
select chk('ensure keeps D in Mizrahi', public.run_as('dddddddd-0000-0000-0000-000000000004','d@x.com',$q$ select public.ensure_personal_family() $q$), 'ok');
select chk('D still one membership', (select count(*)::text from public.family_members where user_id='dddddddd-0000-0000-0000-000000000004'), '1');
select chk('ensure for E', public.run_as('eeeeeeee-0000-0000-0000-000000000005','e@x.com',$q$ select public.ensure_personal_family() $q$), 'ok');
insert into public.family_members(family_id, user_id, role)
select family_id, 'ffffffff-0000-0000-0000-000000000006', 'member'
from public.family_members where user_id='eeeeeeee-0000-0000-0000-000000000005';
create temp table inv_tok4(t text);
grant all on inv_tok4 to authenticated;
select chk('A invites E', public.run_as('aaaaaaaa-0000-0000-0000-000000000001','a@x.com',$q$ insert into inv_tok4 select public.create_invitation((select id from public.families where name='Mizrahi'),'e@x.com','member') $q$), 'ok');
select chk('E with another member cannot accept', public.run_as('eeeeeeee-0000-0000-0000-000000000005','e@x.com',format('select public.accept_invitation(%L)', (select t from inv_tok4))), 'group_has_members');
select chk('E group kept', (select count(*)::text from public.family_members where user_id='eeeeeeee-0000-0000-0000-000000000005'), '1');

select n, case when got is not distinct from want then 'PASS' else 'FAIL' end as r, name, got, want from public.zz_results order by n;
