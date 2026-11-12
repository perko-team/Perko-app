# Focus group brief (read whole)

## The product
Perko (getperko.com), early access, Jerusalem pilot (Emek Refaim / Derech Beit Lehem). Hebrew only, RTL.
- **Customer app** (Expo, iOS/Android): one wallet for the loyalty cards of neighbourhood businesses. A customer
  scans the QR code at the counter after a purchase; a staff member types a 4-digit PIN on the customer's phone to
  confirm each stamp and each reward. Tabs: כרטיסים (wallet), גילוי (discover businesses), סריקה, הטבות, פרופיל.
  Free for customers. Sign-in: email + 6-digit code. Light/dark themes.
- **Business dashboard** (Next.js, web): the owner signs in with an email code, goes through a 3-step setup
  (program, team PIN, counter QR card to print), then manages: סקירה (visits, returning customers, heat map),
  הכרטיס (card look, photo/logo, stamp shape), תוכנית (goal, reward, rules, cooldown), צוות (PINs), יומן (log, CSV),
  התראות (PIN lockouts), קוד לקופה (printable counter card). Free during early access; no price is shown anywhere.

## What was actually tested (REAL)
The customer app was run in its demo mode in a phone-sized browser (412x892), and a real walkthrough was recorded:
onboarding (3 screens) → sign-in (a phone number typed into the email field, then an email) → code → wallet →
card detail → discover → business page → scan → staff PIN pad (PIN 1234) → "card full" result → redeem screen →
redeem PIN → "reward redeemed" → rewards tab → profile → wallet afterwards → a second scan of a full card → dark mode.
- Screenshots: `/home/user/Perko-app/.fg/shots/*.png` (open them with the Read tool; numbered in order).
- The visible text of every screen: `/home/user/Perko-app/.fg/screens.md`.
- Demo mode shows a banner ("מצב הדגמה"), five sample businesses marked "לדוגמה", and accepts any 6-digit code.
  Judge the product, not the demo banner itself (but you may note it if it would confuse).
- Camera scanning, push notifications, maps on a real phone and native gestures were NOT tested (web build).

## What was NOT run (HYPOTHETICAL)
The business dashboard could not be run (it needs a real owner account). Its screens are known only from their text,
extracted from the code: `/home/user/Perko-app/.fg/dashboard.md`. The README (`/home/user/Perko-app/README.md`) has
the full feature list. Any opinion on the dashboard is HYPOTHETICAL, and so is any opinion about real-world use
(at a real counter, over weeks), pricing, and willingness to pay.

## Your job
Simulate 10 people of your economic group: **6 customers** (people who would carry the app) and **4 business owners**
(small businesses in an Israeli neighbourhood: café, bakery, barber, kiosk, florist, falafel stand, boutique, etc.),
all plausible for Israel / Jerusalem. Make them genuinely different: age, gender, occupation, family, habits,
religious/secular, Hebrew level, tech skill, attitude. Across the 10 include, where it fits the group: a skeptic, an
enthusiast, an impatient person, a minimalist, a tech-savvy person, a price-sensitive person, a traditional person.
Not everyone should like the app. Some should dislike it or not see the point. Do not make them agree.

Each persona is independent: write each one's report from their own point of view only, using only what they would
see or care about. Do not refer to other personas. Do not invent things that are not in the screenshots, the text
or the README (e.g. do not claim a button exists if you did not see it). Every criticism must name the specific
screen or element and explain why it matters to that person.

## Output: write a single markdown file
Path: `/home/user/Perko-app/.fg/group-{GROUP}.md`. For each persona, exactly this structure:

```
### {id} · {name}, {age}, {occupation} · {customer|owner} · tech {1-5} · {one-word attitude}
- **Profile:** 2-3 lines: life, money, habits, phone use, what they expect from such an app.
- **Basis:** REAL (customer app screens) and/or HYPOTHETICAL (dashboard, real-world use, price)
- **First impression:** 1-2 lines.
- **Liked:** 1-3 specific points (screen/element + why).
- **Disliked:** 1-3 specific points (screen/element + why).
- **Confused by:** 0-2 specific points.
- **Missing:** 0-2 features they would expect.
- **Would change:** 1-2 concrete changes.
- **Would use again:** yes / maybe / no, with the reason.
- **Would pay / price view:** customers: would they pay anything (expected: free) and what would make them uninstall;
  owners: what monthly price in ₪ they would accept, or none, and why. (HYPOTHETICAL)
- **Satisfaction:** 1-5
- **Issue tags:** 2-6 short tags in English, lowercase-hyphenated, naming each problem or wish they raised
  (e.g. `email-only-signin`, `no-business-near-me`). One tag per distinct problem.
- **Praise tags:** 1-4 short tags for what they liked.
```

IDs: `{GROUP}-01` … `{GROUP}-10`. Keep each persona to about 15-20 lines. Write in English (persona quotes may be Hebrew).
When done, reply with just the file path and one line per persona: id, role, satisfaction, would use again.
