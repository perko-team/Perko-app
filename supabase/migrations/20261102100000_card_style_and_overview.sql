-- The card's look, set by the business owner in the dashboard and shown at once on every customer's card
-- in the app: a background (one of the brand faces, or the owner's photo under a dark layer), a logo instead of
-- the business's initial, and the stamp shape. Plus the overview's numbers and the first-run flag.

alter table public.businesses
  -- 'auto' keeps the face the app picks from the business id (the look before this migration).
  add column card_style text not null default 'auto' check (card_style in ('auto', 'lime', 'ink', 'paper', 'photo')),
  -- Paths in the business-media bucket, always inside the business's own folder.
  add column card_image_path text check (card_image_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$'),
  add column logo_path text check (logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$'),
  -- How dark the layer over the photo is, in percent: below 30 text on a bright photo stops being readable.
  add column card_overlay int not null default 55 check (card_overlay between 30 and 85),
  add column stamp_shape text not null default 'circle' check (stamp_shape in ('circle', 'cup', 'heart', 'star')),
  -- Set when the owner finishes (or skips) the first-run guide in the dashboard.
  add column onboarded_at timestamptz,
  add constraint businesses_card_image_own_folder check (card_image_path is null or card_image_path like id::text || '/%'),
  add constraint businesses_logo_own_folder check (logo_path is null or logo_path like id::text || '/%'),
  add constraint businesses_photo_needs_image check (card_style <> 'photo' or card_image_path is not null);

-- Owners edit their own business's look, and nothing else on the row.
create policy "owner: edit own business look" on public.businesses for update to authenticated
  using (is_business_owner(id)) with check (is_business_owner(id));
grant update (card_style, card_image_path, logo_path, card_overlay, stamp_shape, onboarded_at) on public.businesses to authenticated;

-- Images: a public bucket (the app shows them on every card), written only by the business's owners,
-- each business in its own folder named by its id. Skipped where there is no storage schema (scripts/test-db.sh).
create function public.owns_media_path(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  -- CASE, not AND: the uuid cast must only run on a name that matched (AND does not fix the order).
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$'
    then is_business_owner(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;
revoke all on function public.owns_media_path(text) from public, anon;
grant execute on function public.owns_media_path(text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'no storage schema: business-media bucket not created';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('business-media', 'business-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy "business media: owners upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'business-media' and public.owns_media_path(name))$p$;
  execute $p$create policy "business media: owners replace" on storage.objects for update to authenticated
    using (bucket_id = 'business-media' and public.owns_media_path(name))
    with check (bucket_id = 'business-media' and public.owns_media_path(name))$p$;
  execute $p$create policy "business media: owners delete" on storage.objects for delete to authenticated
    using (bucket_id = 'business-media' and public.owns_media_path(name))$p$;
  -- Reads go through the bucket's public URLs; owners also list their own folder in the dashboard.
  execute $p$create policy "business media: owners list" on storage.objects for select to authenticated
    using (bucket_id = 'business-media' and public.owns_media_path(name))$p$;
end $$;

-- Overview ------------------------------------------------------------------------------------------
-- Days and hours are in Israel time. A visit is a collection (stamp_events row).

-- Visits per day for the last p_days days, today included, with zero days filled in.
create function public.business_daily_visits(p_business uuid, p_days int)
returns table (day date, visits int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if not is_business_owner(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select d::date, coalesce(count(e.id), 0)::int
  from generate_series(v_today - (least(greatest(p_days, 1), 366) - 1), v_today, interval '1 day') d
  left join stamp_events e
    on e.business_id = p_business and (e.created_at at time zone 'Asia/Jerusalem')::date = d::date
  group by d
  order by d;
end $$;

-- Visits by weekday (0 = Sunday) and hour over the last p_days days.
create function public.business_heatmap(p_business uuid, p_days int)
returns table (dow int, hour int, visits int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_business_owner(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select extract(dow from t)::int, extract(hour from t)::int, count(*)::int
  from (
    select created_at at time zone 'Asia/Jerusalem' as t
    from stamp_events
    where business_id = p_business and created_at > now() - make_interval(days => least(greatest(p_days, 1), 366))
  ) x
  group by 1, 2;
end $$;

-- The overview's numbers for the last p_days days and the p_days before them, plus the cards right now.
--   visits / active_customers / returning_customers / rewards_redeemed, each with its prev_ value
--   open_cards   cards that are still collecting or full and waiting for redemption
--   near_reward  cards one collection away from the reward
--   ready_cards  full cards waiting to be redeemed
create function public.business_overview(p_business uuid, p_days int)
returns table (
  visits int, prev_visits int,
  active_customers int, prev_active_customers int,
  returning_customers int, prev_returning_customers int,
  rewards_redeemed int, prev_rewards_redeemed int,
  open_cards int, near_reward int, ready_cards int
)
language plpgsql stable security definer set search_path = public as $$
declare
  d int := least(greatest(p_days, 1), 366);
begin
  if not is_business_owner(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  with ev as (
    select user_id, created_at,
      case when created_at > now() - make_interval(days => d) then 0 else 1 end as period,
      (created_at at time zone 'Asia/Jerusalem')::date as day
    from stamp_events
    where business_id = p_business and created_at > now() - make_interval(days => 2 * d)
  ),
  per_user as (
    select period, user_id, count(*) as n, count(distinct day) as days from ev group by period, user_id
  ),
  red as (
    select case when created_at > now() - make_interval(days => d) then 0 else 1 end as period
    from redemptions
    where business_id = p_business and created_at > now() - make_interval(days => 2 * d)
  ),
  cards_now as (
    select c.status, c.goal - c.current as missing, c.step
    from cards c join programs p on p.id = c.program_id
    where p.business_id = p_business and c.status in ('active', 'complete')
  )
  select
    (select coalesce(sum(n), 0) from per_user where period = 0)::int,
    (select coalesce(sum(n), 0) from per_user where period = 1)::int,
    (select count(*) from per_user where period = 0)::int,
    (select count(*) from per_user where period = 1)::int,
    (select count(*) from per_user where period = 0 and days >= 2)::int,
    (select count(*) from per_user where period = 1 and days >= 2)::int,
    (select count(*) from red where period = 0)::int,
    (select count(*) from red where period = 1)::int,
    (select count(*) from cards_now)::int,
    (select count(*) from cards_now where status = 'active' and missing <= step)::int,
    (select count(*) from cards_now where status = 'complete')::int;
end $$;

revoke all on function public.business_daily_visits(uuid, int) from public, anon;
revoke all on function public.business_heatmap(uuid, int) from public, anon;
revoke all on function public.business_overview(uuid, int) from public, anon;
grant execute on function public.business_daily_visits(uuid, int) to authenticated;
grant execute on function public.business_heatmap(uuid, int) to authenticated;
grant execute on function public.business_overview(uuid, int) to authenticated;
