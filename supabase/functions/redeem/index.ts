// POST /functions/v1/redeem  { action: 'confirm', cardId, pin } | { action: 'fill', cardId, confirmation }
// Marks the reward used and opens a new card. A staff member confirms by typing their 4-digit PIN on the
// customer's phone; the PIN is checked here, a wrong one counts towards the customer's lockout at the business.
import { canRedeem } from '../_shared/loyalty.ts';
import { UUID } from '../_shared/token.ts';
import type { RedeemRequest, RedeemResponse } from '../_shared/api-types.ts';
import { admin, cors, json, requireUser, secret } from '../_shared/server.ts';
import { checkStaffPin, lockedUntil } from '../_shared/pins.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const db = admin();
  const user = await requireUser(req, db);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: RedeemRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'body' }, 400);
  }
  if ((body.action !== 'confirm' && body.action !== 'fill') || typeof body.cardId !== 'string') return json({ error: 'body' }, 400);

  // Right after the scan that filled the card: that scan's PIN confirms the reward. Every check is in
  // apply_redeem_after_fill (same card and customer, a staff PIN, 2 minutes, once).
  if (body.action === 'fill') {
    if (typeof body.confirmation !== 'string' || !UUID.test(body.confirmation) || !UUID.test(body.cardId)) {
      return json({ status: 'confirmation_invalid' } satisfies RedeemResponse);
    }
    const { data, error } = await db.rpc('apply_redeem_after_fill', { p_card_id: body.cardId, p_user: user.id, p_event_id: body.confirmation });
    if (error) {
      // Two requests with one confirmation: the unique column refused the second.
      if (error.code === '23505') return json({ status: 'confirmation_invalid' } satisfies RedeemResponse);
      return json({ error: 'write' }, 500);
    }
    const row = (data as { new_card_id: string | null; reward: string | null; problem: string | null }[])[0];
    if (!row || row.problem === 'not_ready') return json({ status: 'not_ready' } satisfies RedeemResponse);
    if (row.problem) return json({ status: 'confirmation_invalid' } satisfies RedeemResponse);
    return json({ status: 'redeemed', newCardId: row.new_card_id!, reward: row.reward! } satisfies RedeemResponse);
  }

  // The card keeps the goal and reward it was opened with.
  const { data: card } = await db
    .from('cards')
    .select('id, user_id, current, status, version, goal, reward, program:programs(business_id)')
    .eq('id', body.cardId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!card) return json({ status: 'not_found' } satisfies RedeemResponse);
  if (card.status !== 'complete' || !canRedeem(card, card)) return json({ status: 'not_ready' } satisfies RedeemResponse);
  const businessId = (card.program as unknown as { business_id: string }).business_id;

  const until = await lockedUntil(db, user.id, businessId);
  if (until) return json({ status: 'locked', until } satisfies RedeemResponse);

  const pin = await checkStaffPin(db, secret('PIN_SECRET'), user.id, businessId, body.pin, 'redeem');
  if (pin.kind === 'locked') return json({ status: 'locked', until: pin.until } satisfies RedeemResponse);
  if (pin.kind === 'wrong') return json({ status: 'wrong_pin', attemptsLeft: pin.attemptsLeft } satisfies RedeemResponse);

  const { data: newCardId, error } = await db.rpc('apply_redeem', {
    p_card_id: card.id,
    p_expected_version: card.version,
    p_staff_pin_id: pin.staffPinId,
  });
  if (error) return json({ error: 'write' }, 500);
  if (!newCardId) return json({ status: 'not_ready' } satisfies RedeemResponse);
  return json({ status: 'redeemed', newCardId, reward: card.reward } satisfies RedeemResponse);
});
