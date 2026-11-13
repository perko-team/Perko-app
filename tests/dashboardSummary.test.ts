// The overview's summary line and metric definitions.
import assert from 'node:assert/strict';
import test from 'node:test';
import { METRIC_DEFINITIONS, weekSummary } from '../dashboard/lib/summary.ts';

test('the week in one line', () => {
  assert.equal(weekSummary({ visits: 42, returning: 9, redeemed: 3 }), 'השבוע: 42 ביקורים, 9 לקוחות חוזרים, 3 הטבות');
  assert.equal(weekSummary({ visits: 1, returning: 1, redeemed: 1 }), 'השבוע: ביקור אחד, לקוח חוזר אחד, הטבה אחת');
  assert.equal(weekSummary({ visits: 5, returning: 0, redeemed: 0 }), 'השבוע: 5 ביקורים, 0 לקוחות חוזרים, 0 הטבות');
  assert.equal(weekSummary({ visits: 0, returning: 0, redeemed: 0 }), 'השבוע עוד לא היו ביקורים.');
});

test('every metric has a one-sentence definition', () => {
  for (const [k, v] of Object.entries(METRIC_DEFINITIONS)) {
    assert.ok(v.length > 10 && v.length < 90, k);
    assert.equal((v.match(/\./g) ?? []).length, 1, `${k}: one sentence`);
  }
});
