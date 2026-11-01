import '@fontsource-variable/heebo';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { colors, darkPalette, radius } from '../../src/tokens.ts';

export const metadata: Metadata = {
  title: 'Perko לעסקים',
  description: 'ניהול תוכנית הנאמנות של העסק ב-Perko: תוכנית, צוות, יומן, תובנות וקוד לקופה.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: colors.ink,
};

// Dark by default (the app's dark roles from src/tokens.ts, plus a few panel steps of the same ink), with the
// brand colours as variables. A light appearance can be added later under [data-theme="light"].
const brand = Object.entries(colors).map(([k, v]) => `--${k}:${v};`).join('');
const p = darkPalette;
const css = `:root{${brand}--bg:${p.bg};--panel:#1A1D16;--panel-2:#151712;--raised:${p.surface};--raised-2:${p.surfaceAlt};` +
  `--line:rgba(248,248,244,0.07);--line-2:rgba(248,248,244,0.12);--text:${p.text};--muted:${p.textMuted};--dim:#9EA294;` +
  `--placeholder:${p.placeholder};--accent:${colors.lime};--on-accent:${colors.ink};--warn:#FFB27A;` +
  `--radius-card:24px;--radius-row:${radius.row}px;--radius-sheet:${radius.sheet}px;color-scheme:dark}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
