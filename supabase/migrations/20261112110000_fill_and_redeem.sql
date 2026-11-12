-- Focus group #3: when a scan fills the card, the reward can be taken right away with the same staff PIN.
-- The app sends the collect confirmation (the id of the stamp event the PIN wrote); this function accepts it
-- only for the same card and customer, confirmed with a staff PIN, at most 2 minutes old, and once. The client
-- is never trusted: everything is read here. Same window as FILL_REDEEM_WINDOW_MS in _shared/loyalty.ts.

alter table public.redemptions add column collect_event_id uuid unique references public.stamp_events (id) on delete set null;

create function public.apply_redeem_after_fill(p_card_id uuid, p_user uuid, p_event_id uuid)
returns table (new_card_id uuid, reward text, problem text)
language plpgsql security definer set search_path = public as $$
declare
  v_event stamp_events%rowtype;
  v_card cards%rowtype;
  v_program programs%rowtype;
  v_new uuid;
begin
  select * into v_event from stamp_events where id = p_event_id;
  if not found then return query select null::uuid, null::text, 'not_found'; return; end if;
  if v_event.card_id <> p_card_id or v_event.user_id <> p_user or v_event.staff_pin_id is null then
    return query select null::uuid, null::text, 'mismatch'; return;
  end if;
  if v_event.created_at < now() - interval '2 minutes' or v_event.created_at > now() then
    return query select null::uuid, null::text, 'expired'; return;
  end if;
  if exists (select 1 from redemptions where collect_event_id = p_event_id) then
    return query select null::uuid, null::text, 'used'; return;
  end if;

  update cards set status = 'redeemed', redeemed_at = now(), version = version + 1
  where id = p_card_id and user_id = p_user and status = 'complete'
  returning * into v_card;
  if not found then return query select null::uuid, null::text, 'not_ready'; return; end if;

  select * into v_program from programs where id = v_card.program_id;
  -- The unique collect_event_id stops a second redemption with the same confirmation, even in a race.
  insert into redemptions (card_id, user_id, business_id, reward, staff_pin_id, collect_event_id)
  values (v_card.id, v_card.user_id, v_program.business_id, v_card.reward, v_event.staff_pin_id, p_event_id);

  if v_program.active then
    insert into cards (user_id, program_id) values (v_card.user_id, v_card.program_id) returning id into v_new;
  end if;
  return query select coalesce(v_new, v_card.id), v_card.reward, null::text;
end $$;
revoke all on function public.apply_redeem_after_fill(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_redeem_after_fill(uuid, uuid, uuid) to service_role;
