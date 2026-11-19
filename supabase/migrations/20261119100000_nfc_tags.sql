-- NFC collection with NTAG 424 DNA tags (SUN). Every tap carries the tag's UID and a read counter that the tag
-- increments itself, signed with a per-tag AES key (verified in the collect Edge Function, _shared/sun.ts).
-- The counter is what stops a saved or copied tap URL: a tap is accepted only when its counter is higher than
-- the last accepted one, and the counter moves in the same transaction as the stamp (apply_nfc_collect).
-- The tag stays with the staff, so by default an NFC stamp needs no PIN; a business can require one.

create table public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- 7-byte UID, upper-case hex. The per-tag key is derived from it, never stored.
  uid text not null unique check (uid ~ '^[0-9A-F]{14}$'),
  label text check (label is null or char_length(label) between 1 and 40),
  -- SDMReadCtr of the last accepted tap (-1: never tapped). 24 bits on the tag.
  last_counter int not null default -1 check (last_counter between -1 and 16777215),
  last_tap_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index nfc_tags_business on public.nfc_tags (business_id);

-- Taps that were refused after a valid signature: a counter that was already used (a saved link), or a
-- disabled tag. Kept for the owner's alerts; no PICC data or MAC is stored.
create table public.nfc_rejections (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  counter int not null,
  reason text not null check (reason in ('stale', 'inactive')),
  created_at timestamptz not null default now()
);
create index nfc_rejections_tag on public.nfc_rejections (tag_id, created_at desc);

alter table public.businesses add column nfc_require_pin boolean not null default false;
grant update (nfc_require_pin) on public.businesses to authenticated;

alter table public.stamp_events add column nfc_tag_id uuid references public.nfc_tags (id) on delete set null;

-- Alerts about a tag, next to business_alerts (left as it is: this migration only adds). The dashboard reads
-- both through business_alert_feed.
--   nfc_stale     the same tag was tapped with old counters again and again (someone replaying saved links)
--   nfc_off_hours a stamp from a tag while the business is closed (by its weekly hours)
--   nfc_burst     many stamps from one tag within minutes
create table public.nfc_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('nfc_stale', 'nfc_off_hours', 'nfc_burst')),
  nfc_tag_id uuid not null references public.nfc_tags (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  failures int,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index nfc_alerts_business on public.nfc_alerts (business_id, created_at desc);

alter table public.nfc_tags enable row level security;
alter table public.nfc_rejections enable row level security;
alter table public.nfc_alerts enable row level security;
revoke all on public.nfc_tags, public.nfc_rejections, public.nfc_alerts from anon, authenticated;
-- Owners read their own tag alerts and mark them seen, as with business_alerts.
grant select on public.nfc_alerts to authenticated;
grant update (seen_at) on public.nfc_alerts to authenticated;
create policy "owner: own tag alerts" on public.nfc_alerts for select to authenticated using (is_business_owner(business_id));
create policy "owner: mark tag alerts seen" on public.nfc_alerts for update to authenticated
  using (is_business_owner(business_id)) with check (is_business_owner(business_id));
-- Owners see their own tags and may rename, disable or enable them. Registering a tag is the operator's job
-- (scripts/admin.ts nfc:add, service role). Customers never see this table.
grant select (id, business_id, uid, label, last_tap_at, active, created_at) on public.nfc_tags to authenticated;
grant update (label, active) on public.nfc_tags to authenticated;
create policy "owner: own tags" on public.nfc_tags for select to authenticated using (is_business_owner(business_id));
create policy "owner: edit own tags" on public.nfc_tags for update to authenticated
  using (is_business_owner(business_id)) with check (is_business_owner(business_id));

-- Is the business open at p_at by its weekly hours (Israel time)? Null when it has no hours.
-- A close time before the open time runs past midnight; '24:00' is the end of the day.
create function public.business_open_at(p_hours jsonb, p_at timestamptz) returns boolean
language sql immutable set search_path = public as $$
  with t as (
    select extract(dow from p_at at time zone 'Asia/Jerusalem')::int as dow,
      (p_at at time zone 'Asia/Jerusalem')::time as now_t
  ), days as (
    select t.now_t, p_hours -> t.dow as today, p_hours -> ((t.dow + 6) % 7) as yesterday from t
  )
  select case when p_hours is null or jsonb_typeof(p_hours) <> 'array' then null else (
    -- Today's opening (an overnight close is handled with yesterday below).
    (jsonb_typeof(today) = 'object' and now_t >= (today->>'open')::time and (
      today->>'close' = '24:00' or (today->>'close')::time <= (today->>'open')::time or now_t < (today->>'close')::time))
    -- Yesterday's opening that runs past midnight.
    or (jsonb_typeof(yesterday) = 'object' and yesterday->>'close' <> '24:00'
      and (yesterday->>'close')::time < (yesterday->>'open')::time and now_t < (yesterday->>'close')::time)
  ) end
  from days
$$;

-- The stamp of an NFC tap, atomically with the tag's counter: the card is written and the counter moved, or
-- nothing happens. Returns 'ok', 'conflict' (the card changed in between: answered as cooldown) or 'stale'
-- (the counter was already used or the tag was disabled meanwhile). Raises the off-hours and burst alerts.
create function public.apply_nfc_collect(
  p_card_id uuid, p_expected_version int, p_current int, p_status text,
  p_amount int, p_business_id uuid, p_tag_id uuid, p_counter int, p_staff_pin_id uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_hours jsonb;
begin
  begin
    update nfc_tags set last_counter = p_counter, last_tap_at = now()
    where id = p_tag_id and business_id = p_business_id and active and last_counter < p_counter;
    if not found then raise exception using errcode = 'P0001', message = 'nfc_stale'; end if;

    update cards set
      current = p_current,
      status = p_status,
      version = version + 1,
      last_collected_at = now(),
      completed_at = case when p_status = 'complete' then now() else completed_at end
    where id = p_card_id and version = p_expected_version and status = 'active'
    returning user_id into v_user;
    if not found then raise exception using errcode = 'P0001', message = 'nfc_conflict'; end if;

    insert into stamp_events (card_id, user_id, business_id, amount, source, nfc_tag_id, staff_pin_id)
    values (p_card_id, v_user, p_business_id, p_amount, 'nfc', p_tag_id, p_staff_pin_id);
  exception when sqlstate 'P0001' then
    -- Rolls back the counter and the card together.
    if sqlerrm = 'nfc_stale' then return 'stale'; end if;
    if sqlerrm = 'nfc_conflict' then return 'conflict'; end if;
    raise;
  end;

  -- Anomalies for the owner: a stamp while closed (once per tag a day), a burst (once per tag an hour).
  select weekly_hours into v_hours from businesses where id = p_business_id;
  if business_open_at(v_hours, now()) = false and not exists (
    select 1 from nfc_alerts where nfc_tag_id = p_tag_id and kind = 'nfc_off_hours' and created_at > israel_day_end() - interval '1 day'
  ) then
    insert into nfc_alerts (business_id, kind, nfc_tag_id, user_id) values (p_business_id, 'nfc_off_hours', p_tag_id, v_user);
  end if;
  if (select count(*) from stamp_events where nfc_tag_id = p_tag_id and created_at > now() - interval '10 minutes') >= 8
    and not exists (select 1 from nfc_alerts where nfc_tag_id = p_tag_id and kind = 'nfc_burst' and created_at > now() - interval '1 hour')
  then
    insert into nfc_alerts (business_id, kind, nfc_tag_id, failures)
    values (p_business_id, 'nfc_burst', p_tag_id, (select count(*) from stamp_events where nfc_tag_id = p_tag_id and created_at > now() - interval '10 minutes')::int);
  end if;
  return 'ok';
end $$;

-- A refused tap with a valid signature. Three stale taps on one tag within a day raise one alert a day.
create function public.register_nfc_rejection(p_tag_id uuid, p_user uuid, p_counter int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
  v_count int;
begin
  select business_id into v_business from nfc_tags where id = p_tag_id;
  if v_business is null then return; end if;
  insert into nfc_rejections (tag_id, business_id, user_id, counter, reason) values (p_tag_id, v_business, p_user, p_counter, p_reason);
  if p_reason <> 'stale' then return; end if;
  select count(*) into v_count from nfc_rejections where tag_id = p_tag_id and reason = 'stale' and created_at > now() - interval '1 day';
  if v_count >= 3 and not exists (
    select 1 from nfc_alerts where nfc_tag_id = p_tag_id and kind = 'nfc_stale' and created_at > now() - interval '1 day'
  ) then
    insert into nfc_alerts (business_id, kind, nfc_tag_id, user_id, failures) values (v_business, 'nfc_stale', p_tag_id, p_user, v_count);
  end if;
end $$;

revoke all on function public.business_open_at(jsonb, timestamptz) from public, anon;
revoke all on function public.apply_nfc_collect(uuid, int, int, text, int, uuid, uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.register_nfc_rejection(uuid, uuid, int, text) from public, anon, authenticated;
grant execute on function public.business_open_at(jsonb, timestamptz) to authenticated, service_role;
grant execute on function public.apply_nfc_collect(uuid, int, int, text, int, uuid, uuid, int, uuid) to service_role;
grant execute on function public.register_nfc_rejection(uuid, uuid, int, text) to service_role;

-- The owner's tag list: last tap and refused taps in the last 7 days.
create function public.business_nfc_tags(p_business uuid)
returns table (id uuid, uid text, label text, active boolean, last_tap_at timestamptz, created_at timestamptz, taps_7d int, rejected_7d int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_business_owner(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select t.id, t.uid, t.label, t.active, t.last_tap_at, t.created_at,
    (select count(*) from stamp_events e where e.nfc_tag_id = t.id and e.created_at > now() - interval '7 days')::int,
    (select count(*) from nfc_rejections r where r.tag_id = t.id and r.created_at > now() - interval '7 days')::int
  from nfc_tags t
  where t.business_id = p_business
  order by t.created_at;
end $$;
revoke all on function public.business_nfc_tags(uuid) from public, anon;
grant execute on function public.business_nfc_tags(uuid) to authenticated;

-- PIN and tag alerts together, with the tag's label (business_alert_states stays as it is for older dashboards).
create function public.business_alert_feed(p_business uuid, p_limit int default 100)
returns table (id uuid, kind text, created_at timestamptz, seen_at timestamptz, failures int, customer text, resolved_at timestamptz, active boolean, tag_label text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_business_owner(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select x.* from (
    select a.id, a.kind, a.created_at, a.seen_at, a.failures,
      case when a.user_id is null then null else customer_label(a.user_id) end,
      a.resolved_at,
      (a.kind = 'pin_lockout' and a.resolved_at is null and a.user_id is not null and a.created_at > israel_day_end() - interval '1 day'),
      null::text
    from business_alerts a
    where a.business_id = p_business
    union all
    select n.id, n.kind, n.created_at, n.seen_at, n.failures,
      case when n.user_id is null then null else customer_label(n.user_id) end,
      null::timestamptz, false, coalesce(t.label, t.uid)
    from nfc_alerts n join nfc_tags t on t.id = n.nfc_tag_id
    where n.business_id = p_business
  ) x
  order by x.created_at desc
  limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function public.business_alert_feed(uuid, int) from public, anon;
grant execute on function public.business_alert_feed(uuid, int) to authenticated;
