// Fill-and-redeem: the PIN typed for the scan that filled the card also confirms the reward, within 2 minutes,
// for the same card only, and once.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FILL_REDEEM_WINDOW_MS, fillRedeemProblem, type FillConfirmation } from '../supabase/functions/_shared/loyalty.ts';

const at = new Date('2026-11-12T10:00:00Z');
const event = (p: Partial<FillConfirmation> = {}): FillConfirmation => ({
  cardId: 'card-1', userId: 'user-1', staffPinId: 'pin-1', createdAt: at.toISOString(), used: false, ...p,
});
const req = { cardId: 'card-1', userId: 'user-1' };
const after = (ms: number) => new Date(at.getTime() + ms);

test('the window is 2 minutes', () => {
  assert.equal(FILL_REDEEM_WINDOW_MS, 120_000);
});

test('a fresh confirmation of the same card redeems', () => {
  assert.equal(fillRedeemProblem(event(), req, after(0)), null);
  assert.equal(fillRedeemProblem(event(), req, after(119_000)), null);
  assert.equal(fillRedeemProblem(event(), req, after(120_000)), null);
});

test('an old confirmation is rejected', () => {
  assert.equal(fillRedeemProblem(event(), req, after(120_001)), 'expired');
  assert.equal(fillRedeemProblem(event(), req, after(60 * 60_000)), 'expired');
  // A confirmation from the future (clock games) is not accepted either.
  assert.equal(fillRedeemProblem(event(), req, after(-1_000)), 'expired');
});

test('a confirmation of another card or customer is rejected', () => {
  assert.equal(fillRedeemProblem(event({ cardId: 'card-2' }), req, after(1_000)), 'mismatch');
  assert.equal(fillRedeemProblem(event({ userId: 'user-2' }), req, after(1_000)), 'mismatch');
  assert.equal(fillRedeemProblem(event({ staffPinId: null }), req, after(1_000)), 'mismatch', 'a stamp without a staff PIN confirms nothing');
});

test('a used or unknown confirmation is rejected', () => {
  assert.equal(fillRedeemProblem(event({ used: true }), req, after(1_000)), 'used');
  assert.equal(fillRedeemProblem(null, req, after(1_000)), 'not_found');
});
