// Readability: every text role meets WCAG AA (4.5:1) on the surfaces it is used on, in light and dark.
import assert from 'node:assert/strict';
import test from 'node:test';
import { colors, darkPalette, lightPalette, type Palette } from '../src/tokens.ts';

const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** #rrggbb, or rgba() blended over the background. */
function rgb(s: string, bg?: number[]): number[] {
  if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [r, g, b, a = 1] = s.match(/rgba?\(([^)]+)\)/)![1].split(',').map(Number);
  return [r, g, b].map((v, i) => v * a + bg![i] * (1 - a));
}
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function contrast(fg: string, bg: string): number {
  const b = rgb(bg);
  const [x, y] = [lum(rgb(fg, b)), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const PAIRS: [keyof Palette, keyof Palette][] = [
  ['text', 'bg'], ['text', 'surface'], ['textMuted', 'bg'], ['textMuted', 'surface'], ['textMuted', 'surfaceAlt'],
  ['textMuted', 'tabBar'], ['placeholder', 'surface'], ['placeholder', 'surfaceAlt'], ['onAccent', 'accent'],
  ['onHero', 'hero'], ['onHeroMuted', 'hero'],
];

for (const [name, p] of [['light', lightPalette], ['dark', darkPalette]] as const) {
  test(`${name}: text roles are AA`, () => {
    for (const [fg, bg] of PAIRS) {
      const r = contrast(p[fg] as string, p[bg] as string);
      assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  });
}

test('muted text on the lime and paper brand surfaces is AA', () => {
  assert.ok(contrast(colors.muted, colors.lime) >= 4.5);
  assert.ok(contrast(colors.muted, colors.paper) >= 4.5);
  assert.ok(contrast(colors.slateOnInk, colors.ink) >= 4.5);
});
