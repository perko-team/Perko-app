// Demo mode: the full explanation once, on the first screen that shows it in this app session, then only a
// small "הדגמה" tag. Users found the banner on every screen noisy (focus group #12). No imports, tested.
let shown = false;

/** True for the first caller only (the screen that shows the full banner). */
export function takeFullBanner(): boolean {
  if (shown) return false;
  shown = true;
  return true;
}

/** Tests only. */
export function resetDemoBanner(): void {
  shown = false;
}
