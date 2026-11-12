import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeHint, EMAIL_INVALID, emailFieldProblem, PHONE_IN_EMAIL, resendLine } from '../supabase/functions/_shared/loyalty.ts';

test('an email address passes', () => {
  assert.equal(emailFieldProblem('Noa@Example.com '), null);
});

test('an Israeli mobile number in the email field gets the phone message', () => {
  for (const phone of ['0501234567', '050-123-4567', '+972501234567', '972 50 123 4567']) {
    assert.equal(emailFieldProblem(phone), PHONE_IN_EMAIL, phone);
  }
});

test('anything else gets the email example', () => {
  for (const bad of ['', 'noa', 'noa@', '02-123-4567', '12345']) assert.equal(emailFieldProblem(bad), EMAIL_INVALID, bad);
});

test('the code hint explains the inactive button until every digit is typed', () => {
  assert.equal(codeHint(0, 6, 'email'), 'מקלידים את 6 הספרות מהמייל');
  assert.equal(codeHint(5, 6, 'sms'), 'מקלידים את 6 הספרות מה-SMS');
  assert.equal(codeHint(6, 6, 'email'), null);
});

test('the resend line counts down, then offers a new code', () => {
  assert.equal(resendLine(30, 'email'), 'לא קיבלתם? בודקים בספאם, או שולחים שוב בעוד 30 שניות');
  assert.equal(resendLine(0, 'email'), 'לא קיבלתם? שליחת קוד חדש');
});
