# Claude Code prompt: fixes from the Perko focus group (paste as is)

---

You are working in the Perko-app repository (Expo SDK 58 customer app in `src/`, Next.js business dashboard in
`dashboard/`, Supabase in `supabase/`). Read `AGENTS.md` and `README.md` first and follow them (Expo docs for SDK 58,
`npx expo install` for packages, typecheck and lint before you finish). The app is Hebrew-only, RTL, light and dark.

A simulated focus group of 50 users (30 customers, 20 small-business owners, five income groups) tested the customer
app in demo mode and reviewed the dashboard from its code. The findings, with counts, are in
`docs/focus-group/REPORT.md`; screenshots of the tested flow are in `docs/focus-group/shots/`. Implement the P0 and
P1 items below, then the P2 items marked **(do)**. Do not do the P3 items or anything raised by only one user.

## Rules for this work

- Preserve all existing behaviour that is not named below: the staff PIN on every stamp and every reward, the
  cooldown, three wrong PINs = lockout, RLS, the demo backend (`src/lib/demoBackend.ts`) and the real one
  (`src/lib/supabaseBackend.ts`) staying in step, the wallet stack and its TalkBack list, deep links, account deletion.
- Every server change goes in a new migration and, where a secret is needed, through the `business-admin` Edge
  Function; never from the browser. Update `supabase/functions/_shared` types and both backends together.
- Copy is Hebrew, plural/neutral, short. Customer-facing copy says "לאסוף חותמת" and "לקבל את ההטבה", not
  "צבירה" / "מימוש"; the dashboard may keep its terms but must define them.
- Add or update unit tests in `tests/` for every rule you touch. Run `npm run typecheck`, `npm run lint`, `npm test`,
  and the dashboard's typecheck/lint. Check every changed screen in light and dark, in demo mode, at phone width.
- Keep commits small, one item per commit, with the item number in the message.

## P0

**1. Sign-in that does not lose people (15/50, mostly older and low-tech users).**
`src/app/sign-in.tsx` is email-only because `PHONE_SIGN_IN` (`src/lib/config.ts`) is off until an SMS provider exists.
- Do not turn phone sign-in on. Make the email screen forgiving:
  - When the email field holds something that looks like an Israeli phone number (use `normalizeIsraeliPhone`), show
    a specific message instead of the email example: "כרגע נכנסים עם כתובת מייל. אין מייל? אפשר לבקש עזרה בקופה."
  - On the code screen, explain the disabled "כניסה" button with a hint line under the field
    ("מקלידים את 6 הספרות מהמייל") that disappears once 6 digits are typed.
  - Show "לא קיבלתם? בודקים בספאם, או שולחים שוב בעוד 30 שניות" (keep the existing resend timer).
- Make phone sign-in a one-flag switch: confirm the `MethodSwitch` path works end to end in demo mode with
  `PHONE_SIGN_IN = true`, so turning SMS on later is a config change only.
Acceptance: typing `0501234567` in the email field and pressing "שליחת קוד" shows the phone-specific message;
email sign-in is unchanged; with the flag on, phone sign-in works in demo mode; tests cover the phone detection.

**2. Owners can release a PIN lockout (5 of 20 owners).**
A customer locked after three wrong PINs (`pin_failures`, alert `pin_lockout`) cannot collect until midnight and the
owner can do nothing.
- Add a `lockout_release` action to `business-admin` (owner of that business only) that clears the customer's
  lockout for that business today (delete or mark today's `pin_failures` rows; keep them for the log if you can
  by marking instead of deleting) and writes a log entry ("שחרור נעילה" with the owner as actor).
- In `dashboard/app/(dash)/alerts/page.tsx`, add "שחרור" on each active lockout alert, with a confirmation that
  explains the risk in one line ("אם מישהו ניסה לנחש את הקוד, השחרור מאפשר לו לנסות שוב").
- In the customer app, the lockout message says until when ("אפשר לנסות שוב מחר, או לבקש מבעלי העסק לשחרר").
- Mirror the behaviour in `demoBackend.ts`.
Acceptance: an owner releases a lockout and the customer can collect at once; a non-owner call is refused; the
release appears in the log; the lockout itself still triggers after three wrong PINs.

## P1

**3. A shorter counter step, keeping the PIN (19/50 found it slow or intrusive; 5 valued it against fraud).**
- When a scan fills the card (`scan.tsx` result "הכרטיס מלא"), offer "לקבל את ההטבה עכשיו" that redeems with the
  PIN already confirmed for this visit (server: allow `redeem` to accept the collect confirmation for the same card
  within 2 minutes, verified server side; never trust the client). The existing separate redeem flow stays.
- On the PIN pad screen add one line for staff ("לצוות: מקלידים את הקוד שלכם ומחזירים את הטלפון") and a clear
  error state on a wrong PIN (shake/haptic plus text with tries left; the count must match the server).
Acceptance: fill-and-redeem needs one PIN entry; a reused or old confirmation is rejected by the server; tests for
the 2-minute window and for card mismatch.

**4. Rules a customer can understand (14/50).**
- On the business page (`src/app/business/[id].tsx`) and the card detail (`src/app/card/[id].tsx`), show:
  what counts as a purchase (from the program; default text "כל קנייה בקופה"), the cooldown in plain words
  ("אפשר לאסוף חותמת אחת בכל שעתיים"), and for points programs how many points one purchase gives.
- Replace customer-facing "צבירה"/"מימוש" wording across the app with the words above.
- On a second scan of a full card, say explicitly whether this purchase was counted
  ("הקנייה הזו לא נספרה כי הכרטיס מלא. מקבלים את ההטבה ומתחילים כרטיס חדש").
Acceptance: every sample business shows the three facts; no customer screen shows "צבירה"/"מימוש"; the full-card
message states the purchase was not counted.

**5. Cards, rewards and the card screen read at a glance (10 + 6 + 6).**
- Full card: collected stamps render in the "collected" style everywhere (wallet card, card detail, rewards hero,
  result sheet), so a full card looks full; the last slot keeps the reward mark. Fix whatever makes 9/10 look like
  nine empty dark circles in dark mode (see `docs/focus-group/shots/13-*` and `17-*`).
- "ההטבה מומשה" screen (`redeem/[id].tsx` done state): add the business initial/logo and the reward line, not a blank.
- Rewards tab (`(tabs)/rewards.tsx`): a visible "לקבל את ההטבה" button on each ready reward (the card stays tappable),
  and a proper rewards icon in the tab bar instead of the plain circle.
- Card screen: fill the empty area under the focused card with that card's recent history (last 5 events) and its
  rules (item 4), instead of blank space (`shots/08-*`).
Acceptance: screenshots before/after for each; TalkBack labels updated; no layout overlap at 360px width.

**6. Business information (10/50).**
- Structured hours per weekday including Friday (replace or extend the free-text `businesses.hours`; migrate the
  sample data), a tappable phone number, a navigation link from the address, and an optional kashrut field that
  owners set in the dashboard ("הכרטיס" or a new "פרטי העסק" section) and the app shows only when set.
Acceptance: the business page shows today's hours with Friday handled; empty fields are hidden, never "לא ידוע".

**7. Dashboard metrics explained (9 owners, hypothetical).**
- In `overview` and `insights`: a one-sentence definition under each metric ("חוזרים: לקוחות שאספו פעמיים ומעלה
  בתקופה"), a one-line summary at the top ("השבוע: 34 ביקורים, 12 לקוחות חוזרים, 3 הטבות"), computed from the same
  RPCs; show active lockouts at the top of the overview with the release action from item 2.
Acceptance: every number on the overview has a definition; the summary matches the cards below it.

## P2 (do)

**8. Readability (8/50).** Minimum 14px for secondary text in the app, AA contrast for text on lime and on ink
(`src/theme.ts` roles, not per screen), respect the system font scale (no fixed heights that clip), and replace the
long legal paragraph under the sign-in buttons with one link line. Replace the "לילה טוב"/time greetings in
`(tabs)/index.tsx` with a neutral greeting.

**10. Team code clarity (5 owners).** In onboarding and "צוות", explain in one line why the code is shown once and that
"איפוס" makes a new one; add a "אני עובד/ת לבד" note explaining that a solo owner types their own code.

**12. Demo banner.** In demo mode only: full banner on the first screen, then a small "הדגמה" tag.

## Not in this round

P2 item 9 (owner messages to customers), item 11 (paper-card migration), Arabic/Russian, Apple/Google Wallet, owner
self sign-up and pricing page: leave them, and do not add partial versions.

## Done when

All P0, P1 and the P2 (do) items meet their acceptance criteria; typecheck, lint and tests pass for the app and the
dashboard; demo mode still runs the full flow (onboarding → sign-in → scan → PIN 1234 → full card → reward → new
card); and `README.md` documents the new behaviour (lockout release, fill-and-redeem, structured hours).
