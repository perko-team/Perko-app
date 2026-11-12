// Rules in plain words, and no "צבירה" or "מימוש" anywhere a customer reads.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fullCardMessage, ruleFacts } from '../supabase/functions/_shared/loyalty.ts';

test('three facts: what counts, how often, how much', () => {
  assert.deepEqual(ruleFacts({ type: 'stamps', step: 1, rule: 'חותמת על כל משקה חם', cooldownMinutes: 120 }), [
    { label: 'מה נחשב קנייה', value: 'חותמת על כל משקה חם' },
    { label: 'כל כמה זמן', value: 'אפשר לאסוף חותמת אחת בכל שעתיים' },
    { label: 'כמה מקבלים', value: 'חותמת אחת על כל קנייה' },
  ]);
});

test('an empty rule reads as any purchase at the counter', () => {
  assert.equal(ruleFacts({ type: 'stamps', step: 1, rule: '  ', cooldownMinutes: 120 })[0].value, 'כל קנייה בקופה');
});

test('points, several stamps and no cooldown', () => {
  const points = ruleFacts({ type: 'points', step: 20, rule: 'x', cooldownMinutes: 90 });
  assert.equal(points[1].value, 'אפשר לאסוף נקודות פעם אחת בכל שעה ו-30 דקות');
  assert.equal(points[2].value, '20 נקודות על כל קנייה');
  assert.equal(ruleFacts({ type: 'stamps', step: 2, rule: 'x', cooldownMinutes: 0 })[2].value, '2 חותמות על כל קנייה');
  assert.equal(ruleFacts({ type: 'stamps', step: 2, rule: 'x', cooldownMinutes: 0 })[1].value, 'אין הגבלה: כל קנייה נספרת');
});

test('a scan of a full card says the purchase did not count', () => {
  assert.equal(fullCardMessage('קפה'), 'הקנייה הזו לא נספרה כי הכרטיס מלא. מקבלים את ההטבה (קפה) ומתחילים כרטיס חדש');
});

test('customer copy never says צבירה or מימוש', () => {
  const banned = /צבירה|לצבור|צוברים|צובר|מימוש|מומש|לממש|מממשים/;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk('src');
  files.push('supabase/functions/_shared/loyalty.ts');
  const hits = files.flatMap((f) =>
    readFileSync(f, 'utf8').split('\n')
      .map((line, i) => ({ line: line.trim(), at: `${f}:${i + 1}` }))
      // Comments are for developers.
      .filter((l) => !l.line.startsWith('//') && !l.line.startsWith('*') && !l.line.startsWith('/*'))
      .filter((l) => banned.test(l.line.replace(/\/\/.*$/, '')))
      .map((l) => l.at),
  );
  assert.deepEqual(hits, []);
});
