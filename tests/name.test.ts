// The first name asked once, right after the first sign-in.
import assert from 'node:assert/strict';
import test from 'node:test';
import { NAME_MAX, nameProblem } from '../supabase/functions/_shared/loyalty.ts';

test('a first name passes, in Hebrew or English', () => {
  assert.equal(nameProblem('נועה'), null);
  assert.equal(nameProblem('  Noa '), null);
  assert.equal(nameProblem('אבי-גיל'), null);
});

test('empty, digits only or too long is refused', () => {
  assert.equal(nameProblem('   '), 'צריך למלא שם כדי להמשיך');
  assert.equal(nameProblem('1234'), 'שם צריך לכלול אותיות');
  assert.equal(nameProblem('א'.repeat(NAME_MAX + 1)), `עד ${NAME_MAX} תווים`);
});
