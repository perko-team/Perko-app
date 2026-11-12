-- Focus group #2: the business owner can release a customer's PIN lockout. A regular whose PIN the staff
-- mistyped three times could not collect until midnight, and the owner could do nothing about it.
-- A release marks that day's wrong PINs as released (kept for the record), resolves the lockout alert and
-- writes a release row that the owner's log shows ("שחרור נעילה"). Called only by the business-admin Edge
-- Function, after it checked that the caller owns the business.

alter table public.pin_failures add column released_at timestamptz;
alter table public.business_alerts add column resolved_at timestamptz;

create table public.lockout_releases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The owner who released it; null when the admin script did (service role).
  released_by uuid references auth.users (id) on delete set null,
  alert_id uuid references public.business_alerts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index lockout_releases_business on public.lockout_releases (business_id, created_at desc);
alter table public.lockout_releases enable row level security;
revoke all on public.lockout_releases from anon, authenticated;

-- Consecutive wrong PINs today, as before, minus the ones an owner released.
create or replace function public.pin_failures_today(p_user uuid, p_business uuid) returns int
language sql stable security definer set search_path = public as $$
  with since as (
    select greatest(
      israel_day_end() - interval '1 day',
      coalesce((select max(created_at) from stamp_events where user_id = p_user and business_id = p_business and staff_pin_id is not null), '-infinity'),
      coalesce((select max(created_at) from redemptions where user_id = p_user and business_id = p_business and staff_pin_id is not null), '-infinity')
    ) as t
  )
  select count(*)::int from pin_failures f, since
  where f.user_id = p_user and f.business_id = p_business and f.created_at > since.t and f.released_at is null
$$;

-- Releases the lockout behind a pin_lockout alert. Returns the customer's id, or null when the alert is not a
-- lockout of that business (or was already released). The Edge Function checks ownership before calling.
create function public.release_lockout(p_business uuid, p_alert uuid, p_by uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  update business_alerts set resolved_at = now(), seen_at = coalesce(seen_at, now())
  where id = p_alert and business_id = p_business and kind = 'pin_lockout' and resolved_at is null and user_id is not null
  returning user_id into v_user;
  if v_user is null then return null; end if;
  -- Any older lockout alert of the same customer there is settled by this release too.
  update business_alerts set resolved_at = now(), seen_at = coalesce(seen_at, now())
  where business_id = p_business and user_id = v_user and kind = 'pin_lockout' and resolved_at is null;

  update pin_failures set released_at = now()
  where user_id = v_user and business_id = p_business and released_at is null
    and created_at > israel_day_end() - interval '1 day';
  insert into lockout_releases (business_id, user_id, released_by, alert_id) values (p_business, v_user, p_by, p_alert);
  return v_user;
end $$;
revoke all on function public.release_lockout(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_lockout(uuid, uuid, uuid) to service_role;

-- The log shows releases next to stamps and redemptions, with the owner as the actor.
create or replace function public.business_log(p_business uuid, p_days int default 30, p_limit int default 300)
returns table (kind text, created_at timestamptz, amount int, reward text, staff_name text, customer text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_business_owner(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select l.kind, l.created_at, l.amount, l.reward, coalesce(l.actor, s.name, 'צוות'), coalesce(customer_label(l.user_id), 'לקוח/ה')
  from (
    select 'stamp'::text as kind, e.created_at, e.amount, null::text as reward, e.staff_pin_id, e.user_id, null::text as actor
    from stamp_events e where e.business_id = p_business and e.created_at > now() - make_interval(days => p_days)
    union all
    select 'redeem', r.created_at, null, r.reward, r.staff_pin_id, r.user_id, null
    from redemptions r where r.business_id = p_business and r.created_at > now() - make_interval(days => p_days)
    union all
    select 'release', x.created_at, null, null, null, x.user_id, 'בעלי העסק'
    from lockout_releases x where x.business_id = p_business and x.created_at > now() - make_interval(days => p_days)
  ) l
  left join staff_pins s on s.id = l.staff_pin_id
  order by l.created_at desc
  limit least(greatest(p_limit, 1), 1000);
end $$;

-- Alerts now say whether a lockout is still in force (today, not released), so the dashboard can offer "שחרור".
drop function public.business_alert_list(uuid, int);
create function public.business_alert_list(p_business uuid, p_limit int default 100)
returns table (id uuid, kind text, created_at timestamptz, seen_at timestamptz, failures int, customer text, resolved_at timestamptz, active boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_business_owner(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select a.id, a.kind, a.created_at, a.seen_at, a.failures,
    case when a.user_id is null then null else customer_label(a.user_id) end,
    a.resolved_at,
    (a.kind = 'pin_lockout' and a.resolved_at is null and a.user_id is not null and a.created_at > israel_day_end() - interval '1 day')
  from business_alerts a
  where a.business_id = p_business
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function public.business_alert_list(uuid, int) from public, anon;
grant execute on function public.business_alert_list(uuid, int) to authenticated;
