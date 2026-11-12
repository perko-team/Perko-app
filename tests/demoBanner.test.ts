// The demo banner: full once, then the small tag.
import assert from 'node:assert/strict';
import test from 'node:test';
import { resetDemoBanner, takeFullBanner } from '../src/lib/demoBanner.ts';

test('the first screen gets the full banner, later ones the tag', () => {
  resetDemoBanner();
  assert.equal(takeFullBanner(), true);
  assert.equal(takeFullBanner(), false);
  assert.equal(takeFullBanner(), false);
});
