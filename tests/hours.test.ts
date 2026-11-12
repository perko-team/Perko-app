// Business info: weekly hours with Friday, today's line in Israel time, phone and navigation links.
import assert from 'node:assert/strict';
import test from 'node:test';
import { hasHours, israelWeekday, navigationUrl, parseWeeklyHours, telLink, todayLine, weekLines } from '../supabase/functions/_shared/hours.ts';

const week = [
  { open: '07:00', close: '19:00' }, { open: '07:00', close: '19:00' }, { open: '07:00', close: '19:00' },
  { open: '07:00', close: '19:00' }, { open: '07:00', close: '19:00' }, { open: '07:00', close: '14:00' }, null,
];

test('a valid week parses; anything else is no hours', () => {
  assert.deepEqual(parseWeeklyHours(week), week);
  assert.equal(parseWeeklyHours(week.slice(0, 6)), null, 'seven days');
  assert.equal(parseWeeklyHours([...week.slice(0, 6), { open: '7:00', close: '14:00' }]), null, 'HH:MM');
  assert.equal(parseWeeklyHours([...week.slice(0, 6), { open: '18:00', close: '24:00' }])?.[6]?.close, '24:00');
  assert.equal(parseWeeklyHours('א׳-ה׳ 7:00-19:00'), null);
  assert.equal(hasHours(parseWeeklyHours(Array(7).fill(null))), false, 'all closed shows nothing');
  assert.equal(hasHours(parseWeeklyHours(week)), true);
});

test('today is the weekday in Israel, Friday included', () => {
  // Friday 13 Nov 2026, 23:30 UTC is already Saturday 01:30 in Israel.
  assert.equal(israelWeekday(new Date('2026-11-13T10:00:00Z')), 5);
  assert.equal(israelWeekday(new Date('2026-11-13T23:30:00Z')), 6);
  assert.equal(todayLine(week, new Date('2026-11-13T10:00:00Z')), 'היום, שישי: 07:00-14:00');
  assert.equal(todayLine(week, new Date('2026-11-14T10:00:00Z')), 'היום, שבת: סגור');
  const lines = weekLines(week, new Date('2026-11-13T10:00:00Z'));
  assert.equal(lines.length, 7);
  assert.deepEqual(lines[5], { day: 'שישי', text: '07:00-14:00', today: true });
});

test('phone numbers become tel: links', () => {
  assert.equal(telLink('02-6789012'), 'tel:+97226789012');
  assert.equal(telLink('050-123-4567'), 'tel:+972501234567');
  assert.equal(telLink('+972 50 123 4567'), 'tel:+972501234567');
  assert.equal(telLink('12345'), null);
  assert.equal(telLink(null), null);
});

test('navigation prefers the map point, then the address', () => {
  assert.equal(navigationUrl({ address: 'x', lat: 31.7, lng: 35.2 }), 'https://www.google.com/maps/dir/?api=1&destination=31.7,35.2');
  assert.equal(navigationUrl({ address: 'עמק רפאים 1', lat: null, lng: null }), `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('עמק רפאים 1')}`);
  assert.equal(navigationUrl({ address: ' ', lat: null, lng: null }), null);
});
