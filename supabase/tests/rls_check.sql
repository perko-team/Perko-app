-- Plain-Postgres check of the schema, RLS and the atomic write functions, without the Supabase stack.
-- Run with scripts/test-db.sh (creates a throwaway database with a minimal auth schema).
\set ON_ERROR_STOP 1
insert into auth.users (id, phone, email) values
  ('11111111-1111-4111-8111-111111111111', '972501234567', null),
  ('22222222-2222-4222-8222-222222222222', null, 'dana@example.com'),
  ('33333333-3333-4333-8333-333333333333', null, 'owner@example.com');

create function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL %: expected an error', label;
exception when others then
  if sqlerrm like 'FAIL %' then raise; end if;
  raise notice 'ok   %  (%)', label, sqlerrm;
end $$;
grant execute on function pg_temp.expect_error(text, text) to public;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ begin assert (select count(*) from businesses) = 5, 'businesses visible'; raise notice 'ok   user sees the 5 sample businesses'; end $$;
select pg_temp.expect_error($q$insert into cards (user_id, program_id, current) values ('11111111-1111-4111-8111-111111111111','b0000000-0000-4000-8000-000000000001', 5)$q$, 'client cannot set current');
select pg_temp.expect_error($q$insert into cards (user_id, program_id) values ('22222222-2222-4222-8222-222222222222','b0000000-0000-4000-8000-000000000001')$q$, 'client cannot add a card for someone else');
insert into cards (user_id, program_id) values ('11111111-1111-4111-8111-111111111111','b0000000-0000-4000-8000-000000000001');
select pg_temp.expect_error($q$insert into cards (user_id, program_id) values ('11111111-1111-4111-8111-111111111111','b0000000-0000-4000-8000-000000000001')$q$, 'one open card per program');
select pg_temp.expect_error($q$update cards set current = 9$q$, 'client cannot update cards');
select pg_temp.expect_error($q$insert into stamp_events (card_id, user_id, business_id, amount) select id, user_id, 'a0000000-0000-4000-8000-000000000001', 1 from cards$q$, 'client cannot write stamp events');
select pg_temp.expect_error($q$select * from qr_codes$q$, 'client cannot read qr codes');
select pg_temp.expect_error($q$select apply_collect(id, 0, 1, 'active', 1, 'a0000000-0000-4000-8000-000000000001', null) from cards$q$, 'client cannot call apply_collect');
reset role;

set role service_role;
do $$
declare c uuid; ok boolean; n uuid;
begin
  select id into c from cards;
  ok := apply_collect(c, 0, 10, 'complete', 1, 'a0000000-0000-4000-8000-000000000001', null);
  assert ok, 'first collect applies';
  ok := apply_collect(c, 0, 10, 'complete', 1, 'a0000000-0000-4000-8000-000000000001', null);
  assert not ok, 'stale version is rejected';
  raise notice 'ok   apply_collect writes once and rejects a stale version';
  n := apply_redeem(c, 1);
  assert n is not null and n <> c, 'redeem opens a new card';
  assert (select status from cards where id = c) = 'redeemed';
  assert (select current from cards where id = n) = 0;
  assert (select count(*) from redemptions) = 1;
  assert apply_redeem(c, 2) is null, 'second redeem is rejected';
  raise notice 'ok   apply_redeem marks the reward used, starts a new card, cannot repeat';
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin assert (select count(*) from cards) = 0 and (select count(*) from stamp_events) = 0; raise notice 'ok   another user sees none of it'; end $$;
reset role;
-- Cards keep the rules they were opened with -------------------------------------------------------
set role service_role;
do $$
declare c uuid;
begin
  select id into c from cards where user_id = '11111111-1111-4111-8111-111111111111' and status = 'active';
  assert (select goal from cards where id = c) = 10 and (select reward from cards where id = c) = 'קפה הפוך עלינו', 'snapshot on insert';
  update programs set goal = 12, reward = 'עוגה' where id = 'b0000000-0000-4000-8000-000000000001';
  assert (select goal from cards where id = c) = 10, 'open card keeps its goal';
  insert into cards (user_id, program_id, goal, reward) values ('22222222-2222-4222-8222-222222222222', 'b0000000-0000-4000-8000-000000000001', 1, 'הכל');
  assert (select goal from cards where user_id = '22222222-2222-4222-8222-222222222222') = 12, 'new card takes the current rules, not the caller''s';
  assert (select reward from cards where user_id = '22222222-2222-4222-8222-222222222222') = 'עוגה';
  delete from cards where user_id = '22222222-2222-4222-8222-222222222222';
  raise notice 'ok   cards snapshot the program rules; program changes reach new cards only';
end $$;
reset role;

-- Staff PINs and lockout ---------------------------------------------------------------------------
set role service_role;
do $$
declare
  u uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := 'a0000000-0000-4000-8000-000000000001';
  pin uuid; c uuid; n int;
begin
  insert into staff_pins (business_id, name, pin_hash) values (b, 'צוות', repeat('a', 64)) returning id into pin;
  begin
    insert into staff_pins (business_id, name, pin_hash) values (b, 'דנה', repeat('a', 64));
    raise exception 'FAIL duplicate pin';
  exception when unique_violation then null;
  end;
  insert into staff_pins (business_id, name, pin_hash) values ('a0000000-0000-4000-8000-000000000002', 'צוות', repeat('a', 64));
  raise notice 'ok   a PIN is unique within its business only';

  assert register_pin_failure(u, b, 'collect') = 1;
  assert register_pin_failure(u, b, 'collect') = 2;
  assert not exists (select 1 from business_alerts where kind = 'pin_lockout');
  assert register_pin_failure(u, b, 'redeem') = 3;
  assert (select count(*) from business_alerts where kind = 'pin_lockout' and business_id = b and user_id = u) = 1, 'lockout alert';
  assert pin_locked_until(u, b) = israel_day_end(), 'locked until midnight';
  assert pin_locked_until(u, 'a0000000-0000-4000-8000-000000000002') is null;
  assert pin_failures_today(u, 'a0000000-0000-4000-8000-000000000002') = 0, 'lockout is per business';
  assert israel_day_end('2026-07-01 20:30:00+00') = '2026-07-01 21:00:00+00', 'summer: midnight in Israel is 21:00 UTC';
  assert israel_day_end('2026-12-01 21:30:00+00') = '2026-12-01 22:00:00+00', 'winter: midnight in Israel is 22:00 UTC';
  raise notice 'ok   3 wrong PINs lock the customer at that business until midnight in Israel, with an alert';

  -- A successful PIN resets the count: failures are consecutive. (Everything in this block shares one now(),
  -- so move the earlier failures a minute back to put them before the success.)
  update pin_failures set created_at = created_at - interval '1 minute';
  select id into c from cards where user_id = u and status = 'active';
  assert apply_collect(c, (select version from cards where id = c), 1, 'active', 1, b, null, 'qr', pin);
  assert (select staff_pin_id from stamp_events order by created_at desc limit 1) = pin, 'event records the staff PIN';
  assert pin_failures_today(u, b) = 0, 'success resets the count';
end $$;
do $$ begin
  -- A new transaction, so a later now() than the stamp above.
  assert register_pin_failure('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'collect') = 1, 'counting starts again after a success';
  raise notice 'ok   a successful PIN resets the count and is recorded on the stamp';

  for i in 1..10 loop perform register_pin_failure('22222222-2222-4222-8222-222222222222', 'a0000000-0000-4000-8000-000000000003', 'collect'); end loop;
  assert (select count(*) from business_alerts where kind = 'pin_failures' and business_id = 'a0000000-0000-4000-8000-000000000003') = 1, 'burst alert once an hour';
  raise notice 'ok   many wrong PINs within an hour raise one alert';

  insert into business_members (user_id, business_id, role) values ('33333333-3333-4333-8333-333333333333', 'a0000000-0000-4000-8000-000000000001', 'owner');
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($q$select pin_hash from staff_pins$q$, 'customer cannot read PIN hashes');
select pg_temp.expect_error($q$select * from pin_failures$q$, 'customer cannot read PIN failures');
select pg_temp.expect_error($q$select register_pin_failure('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'collect')$q$, 'customer cannot register failures');
select pg_temp.expect_error($q$select * from business_log('a0000000-0000-4000-8000-000000000001')$q$, 'customer cannot read a business log');
select pg_temp.expect_error($q$select * from business_insights('a0000000-0000-4000-8000-000000000001', 7)$q$, 'customer cannot read insights');
select pg_temp.expect_error($q$select customer_label('22222222-2222-4222-8222-222222222222')$q$, 'customer cannot call customer_label');
do $$ begin
  update programs set goal = 1;
  assert (select goal from programs where id = 'b0000000-0000-4000-8000-000000000001') = 12, 'customer update changes nothing';
  assert (select count(*) from staff_pins) = 0 and (select count(*) from business_alerts) = 0;
  raise notice 'ok   customers see no staff, no alerts and cannot edit programs';
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select pg_temp.expect_error($q$select pin_hash from staff_pins$q$, 'owner cannot read PIN hashes');
select pg_temp.expect_error($q$select * from business_log('a0000000-0000-4000-8000-000000000002')$q$, 'owner cannot read another business''s log');
select pg_temp.expect_error($q$update programs set active = false where id = 'b0000000-0000-4000-8000-000000000001'$q$, 'owner cannot pause or swap a program');
select pg_temp.expect_error($q$update programs set goal = 0 where id = 'b0000000-0000-4000-8000-000000000001'$q$, 'program checks still apply');
do $$
declare r record;
begin
  assert (select count(*) from staff_pins) = 1 and (select name from staff_pins) = 'צוות', 'owner sees own staff only';
  assert (select count(*) from business_members) = 1;
  update programs set goal = 9, reward = 'אספרסו כפול' where business_id = 'a0000000-0000-4000-8000-000000000001';
  update programs set goal = 2 where business_id = 'a0000000-0000-4000-8000-000000000002';
  assert (select goal from programs where id = 'b0000000-0000-4000-8000-000000000001') = 9, 'owner edits own program';
  assert (select goal from programs where id = 'b0000000-0000-4000-8000-000000000002') = 6, 'owner cannot edit another business';

  select * into r from business_log('a0000000-0000-4000-8000-000000000001') where kind = 'stamp' order by created_at desc limit 1;
  assert r.staff_name = 'צוות' and r.customer = '•••4567', format('log row %s', r);
  select * into r from business_insights('a0000000-0000-4000-8000-000000000001', 7);
  assert r.active_customers = 1 and r.visits = 2 and r.rewards_redeemed = 1 and r.returning_customers = 0, format('insights %s', r);
  assert (select count(*) from business_alert_list('a0000000-0000-4000-8000-000000000001')) = 1;
  assert (select customer from business_alert_list('a0000000-0000-4000-8000-000000000001')) = '•••4567';
  update business_alerts set seen_at = now();
  assert (select count(*) from business_alerts where seen_at is not null) = 1;
  raise notice 'ok   owner reads the log (staff name, masked customer), insights and alerts of their own business';
end $$;
reset role;

-- Lockout release (migration 20261112100000) ---------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($q$select release_lockout('a0000000-0000-4000-8000-000000000001', gen_random_uuid(), null)$q$, 'customer cannot release a lockout');
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select pg_temp.expect_error($q$select release_lockout('a0000000-0000-4000-8000-000000000001', gen_random_uuid(), null)$q$, 'owner cannot call release_lockout directly (only through business-admin)');
do $$ begin
  assert (select active from business_alert_list('a0000000-0000-4000-8000-000000000001') where kind = 'pin_lockout'), 'today''s lockout is active';
end $$;
reset role;
set role service_role;
do $$
declare
  u uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := 'a0000000-0000-4000-8000-000000000001';
  a uuid;
  r record;
begin
  -- Lock the customer again (one failure is already on record since the last success).
  perform register_pin_failure(u, b, 'collect');
  perform register_pin_failure(u, b, 'collect');
  assert pin_locked_until(u, b) is not null, 'locked again';
  select id into a from business_alerts where kind = 'pin_lockout' and business_id = b and user_id = u order by created_at desc limit 1;
  assert release_lockout('a0000000-0000-4000-8000-000000000002', a, null) is null, 'an alert of another business releases nothing';
  assert pin_locked_until(u, b) is not null;
  assert release_lockout(b, a, '33333333-3333-4333-8333-333333333333') = u, 'release returns the customer';
  assert pin_locked_until(u, b) is null and pin_failures_today(u, b) = 0, 'released: can collect at once';
  assert (select count(*) from pin_failures where user_id = u and business_id = b and released_at is not null) >= 3, 'failures kept, marked released';
  assert release_lockout(b, a, null) is null, 'a release twice does nothing';
  assert (select resolved_at from business_alerts where id = a) is not null;

  assert register_pin_failure(u, b, 'collect') = 1;
  assert register_pin_failure(u, b, 'collect') = 2;
  assert register_pin_failure(u, b, 'collect') = 3;
  assert pin_locked_until(u, b) is not null, 'the lockout still triggers after 3 wrong PINs';
  raise notice 'ok   the owner''s release clears today''s lockout, keeps the failures and the lockout still works';
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$
declare r record;
begin
  select * into r from business_log('a0000000-0000-4000-8000-000000000001') where kind = 'release';
  assert r.staff_name = 'בעלי העסק' and r.customer = '•••4567', format('release log row %s', r);
  assert (select count(*) from business_alert_list('a0000000-0000-4000-8000-000000000001') where kind = 'pin_lockout' and not active and resolved_at is not null) = 2, 'both earlier lockouts are settled';
  assert (select count(*) from business_alert_list('a0000000-0000-4000-8000-000000000001') where kind = 'pin_lockout' and active) = 1, 'the new lockout is active';
  raise notice 'ok   the release shows in the owner''s log, and alerts say which lockouts are active';
end $$;
reset role;

-- As the table owner: customer_label is callable only from the security-definer RPCs.
do $$ begin
  insert into profiles (id, name) values ('11111111-1111-4111-8111-111111111111', 'נועה') on conflict (id) do update set name = excluded.name;
  assert customer_label('11111111-1111-4111-8111-111111111111') = 'נועה';
  assert customer_label('22222222-2222-4222-8222-222222222222') = 'd•••@example.com';
  raise notice 'ok   customers are shown by name, last 4 phone digits or a masked email';
end $$;
-- Card look and overview (migration 20261102100000) ------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select pg_temp.expect_error($q$update businesses set name = 'x' where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'owner cannot rename the business');
select pg_temp.expect_error($q$update businesses set card_style = 'photo' where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'photo style needs an image');
select pg_temp.expect_error($q$update businesses set logo_path = 'a0000000-0000-4000-8000-000000000002/logo.png' where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'logo must be in the business''s own folder');
select pg_temp.expect_error($q$update businesses set card_overlay = 10 where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'overlay below 30 is refused');
do $$
declare r record;
begin
  update businesses set card_style = 'photo', card_image_path = 'a0000000-0000-4000-8000-000000000001/bg-1.jpg',
    logo_path = 'a0000000-0000-4000-8000-000000000001/logo.png', stamp_shape = 'cup', card_overlay = 60, onboarded_at = now()
  where id = 'a0000000-0000-4000-8000-000000000001';
  update businesses set stamp_shape = 'star' where id = 'a0000000-0000-4000-8000-000000000002';
  assert (select stamp_shape from businesses where id = 'a0000000-0000-4000-8000-000000000001') = 'cup', 'owner sets the look';
  assert (select stamp_shape from businesses where id = 'a0000000-0000-4000-8000-000000000002') = 'circle', 'not another business';
  assert owns_media_path('a0000000-0000-4000-8000-000000000001/bg-1.jpg');
  assert not owns_media_path('a0000000-0000-4000-8000-000000000002/bg-1.jpg');
  assert not owns_media_path('../a0000000-0000-4000-8000-000000000001/x.jpg');
  assert not owns_media_path('not-a-uuid/x.jpg'), 'bad folder is false, not an error';
  assert (select count(*) from business_daily_visits('a0000000-0000-4000-8000-000000000001', 7)) = 7, 'one row per day';
  assert (select sum(visits) from business_daily_visits('a0000000-0000-4000-8000-000000000001', 7)) = 2;
  assert (select sum(visits) from business_heatmap('a0000000-0000-4000-8000-000000000001', 30)) = 2;
  select * into r from business_overview('a0000000-0000-4000-8000-000000000001', 7);
  assert r.visits = 2 and r.prev_visits = 0 and r.active_customers = 1 and r.rewards_redeemed = 1 and r.open_cards = 1, format('overview %s', r);
  raise notice 'ok   owner edits the card look within its own folder; daily visits, heatmap and overview work';
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($q$select * from business_overview('a0000000-0000-4000-8000-000000000001', 7)$q$, 'customer cannot read the overview');
do $$ begin
  assert not owns_media_path('a0000000-0000-4000-8000-000000000001/bg-1.jpg'), 'customer owns no media';
  update businesses set stamp_shape = 'heart';
  assert (select stamp_shape from businesses where id = 'a0000000-0000-4000-8000-000000000001') = 'cup', 'customer update changes nothing';
  assert (select logo_path from businesses where id = 'a0000000-0000-4000-8000-000000000001') is not null, 'customers read the look';
  raise notice 'ok   customers read the card look but cannot change it';
end $$;
reset role;
-- Storage: owners write only inside their business's folder.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
insert into storage.objects (bucket_id, name) values ('business-media', 'a0000000-0000-4000-8000-000000000001/bg-2.jpg');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('business-media', 'a0000000-0000-4000-8000-000000000002/bg.jpg')$q$, 'owner cannot upload to another business''s folder');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('business-media', 'a0000000-0000-4000-8000-000000000001/run.exe')$q$, 'only images');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('business-media', 'a0000000-0000-4000-8000-000000000001/x.jpg')$q$, 'customer cannot upload');
do $$ begin
  assert (select count(*) from storage.objects) = 0, 'customer does not list owners'' files';
  assert (select public from storage.buckets where id = 'business-media'), 'bucket is public for reading';
  raise notice 'ok   business-media: owners write their own folder only';
end $$;
reset role;
-- Fill-and-redeem (migration 20261112110000) ----------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select pg_temp.expect_error($q$select * from apply_redeem_after_fill(gen_random_uuid(), '33333333-3333-4333-8333-333333333333', gen_random_uuid())$q$, 'customers cannot call apply_redeem_after_fill');
reset role;
set role service_role;
do $$
declare
  u uuid := '33333333-3333-4333-8333-333333333333';
  other uuid := '22222222-2222-4222-8222-222222222222';
  b uuid := 'a0000000-0000-4000-8000-000000000002';
  prog uuid := (select id from programs where business_id = 'a0000000-0000-4000-8000-000000000002' limit 1);
  pin uuid := (select id from staff_pins where business_id = 'a0000000-0000-4000-8000-000000000002' limit 1);
  c uuid; c2 uuid; ev uuid; old_ev uuid; r record;
begin
  insert into cards (user_id, program_id) values (u, prog) returning id into c;
  update cards set status = 'complete', current = goal where id = c;
  insert into stamp_events (card_id, user_id, business_id, amount, staff_pin_id) values (c, u, b, 1, pin) returning id into ev;
  insert into stamp_events (card_id, user_id, business_id, amount, staff_pin_id, created_at)
    values (c, u, b, 1, pin, now() - interval '2 minutes 1 second') returning id into old_ev;

  select * into r from apply_redeem_after_fill(c, u, old_ev);
  assert r.problem = 'expired', format('older than 2 minutes %s', r);
  select * into r from apply_redeem_after_fill(c, other, ev);
  assert r.problem = 'mismatch', 'another customer';
  insert into cards (user_id, program_id) values (other, prog) returning id into c2;
  select * into r from apply_redeem_after_fill(c2, u, ev);
  assert r.problem = 'mismatch', 'another card';
  update stamp_events set staff_pin_id = null where id = old_ev;
  update stamp_events set created_at = now() where id = old_ev;
  select * into r from apply_redeem_after_fill(c, u, old_ev);
  assert r.problem = 'mismatch', 'a stamp without a staff PIN confirms nothing';
  assert (select status from cards where id = c) = 'complete', 'nothing redeemed yet';

  select * into r from apply_redeem_after_fill(c, u, ev);
  assert r.problem is null and r.reward is not null and r.new_card_id <> c, format('redeemed %s', r);
  assert (select status from cards where id = c) = 'redeemed';
  assert (select staff_pin_id from redemptions where collect_event_id = ev) = pin, 'the redemption records the scan''s staff PIN';

  -- A reused confirmation: the new card filled again, the old confirmation does not redeem it.
  update cards set status = 'complete', current = goal where id = r.new_card_id;
  insert into stamp_events (card_id, user_id, business_id, amount, staff_pin_id) values (r.new_card_id, u, b, 1, pin);
  select * into r from apply_redeem_after_fill(r.new_card_id, u, ev);
  assert r.problem = 'mismatch', 'a confirmation of the old card';
  select * into r from apply_redeem_after_fill(c, u, ev);
  assert r.problem = 'used', 'a confirmation is used once';
  raise notice 'ok   fill-and-redeem: same card and customer, a staff PIN, within 2 minutes, once';
end $$;
reset role;
\echo ALL DB CHECKS PASSED
