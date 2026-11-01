import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFace, DEFAULT_LOOK, FACES, mediaUrl, PHOTO_FACE, stampColors, STAMP_GLYPHS } from '../src/cardLook.ts';

const id = 'a0000000-0000-4000-8000-000000000001';

test('auto keeps the stable face per business; named styles pick their face', () => {
  const auto = cardFace(DEFAULT_LOOK, id);
  assert.equal(cardFace(DEFAULT_LOOK, id), auto, 'same business, same face');
  assert.ok(FACES.includes(auto));
  assert.equal(cardFace({ style: 'lime', imageUrl: null }, id), FACES[0]);
  assert.equal(cardFace({ style: 'ink', imageUrl: null }, id), FACES[1]);
  assert.equal(cardFace({ style: 'paper', imageUrl: null }, id), FACES[2]);
});

test('photo uses the photo face only when there is an image', () => {
  assert.equal(cardFace({ style: 'photo', imageUrl: 'https://x/y.jpg' }, id), PHOTO_FACE);
  assert.equal(cardFace({ style: 'photo', imageUrl: null }, id), cardFace(DEFAULT_LOOK, id), 'no image: falls back to auto');
});

test('media URLs point at the public bucket', () => {
  assert.equal(mediaUrl('https://p.supabase.co/', `${id}/bg.jpg`), `https://p.supabase.co/storage/v1/object/public/business-media/${id}/bg.jpg`);
  assert.equal(mediaUrl('https://p.supabase.co', null), null);
  assert.equal(mediaUrl('', `${id}/bg.jpg`), null);
});

test('every surface has stamp colours and every shape but the disc has a glyph', () => {
  for (const s of ['light', 'lime', 'dark', 'photo'] as const) assert.ok(stampColors(s).filled);
  assert.deepEqual(Object.keys(STAMP_GLYPHS).sort(), ['cup', 'heart', 'star']);
});
