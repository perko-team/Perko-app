// A loyalty card drawn as a physical card: credit-card proportions, real depth, and the look its business
// chose in the dashboard (src/cardLook.ts: a brand face or a photo, a logo, a stamp shape).
// Purely visual: the wallet stack adds position, gestures and accessibility around it.
import { Image, View } from 'react-native';
import { cardFace } from '../../cardLook';
import { remaining, remainingLabel } from '../../../supabase/functions/_shared/loyalty.ts';
import { useTheme } from '../../lib/appearance';
import type { Card } from '../../lib/types';
import { colors } from '../../theme';
import { Wordmark } from '../Brand';
import { CheckIcon } from '../Icons';
import { Meter, Stamps } from '../Stamps';
import { Txt } from '../Txt';

/** ISO/IEC 7810 ID-1 (a bank card): 85.60 x 53.98 mm. */
export const CARD_RATIO = 1.586;
export const CARD_RADIUS = 20;
/** The part of a card that shows while the cards are stacked. */
export const STRIP = 70;

export function cardHeight(width: number): number {
  return Math.round(width / CARD_RATIO);
}

/** Stamp columns that fit the card body: one row up to 10, two rows up to 20. */
function stampColumns(goal: number): number {
  return goal <= 10 ? goal : Math.ceil(goal / 2);
}

export function WalletCardFace({ card, width }: { card: Card; width: number }) {
  const look = card.business.look;
  const face = cardFace(look, card.business.id);
  const photo = face.stamps === 'photo' ? look.imageUrl : null;
  const height = cardHeight(width);
  const ready = card.status === 'complete';
  const points = card.program.type === 'points' || card.program.goal > 20;
  const missing = remaining(card.program, card.current);
  const { t } = useTheme();
  // In dark mode an ink card on the ink background gets a hairline so its edge still reads.
  const outline = t.dark && face.bg === colors.ink;

  return (
    // Outer view carries the shadow (Android elevation needs a background on the same view).
    <View
      style={{
        width,
        height,
        borderRadius: CARD_RADIUS,
        backgroundColor: face.bg,
        elevation: 6,
        shadowColor: t.dark ? '#000000' : colors.ink,
        shadowOpacity: t.dark ? 0.45 : 0.18,
        borderWidth: outline ? 1 : 0,
        borderColor: t.border,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <View style={{ flex: 1, borderRadius: CARD_RADIUS, overflow: 'hidden' }}>
        {photo ? (
          <>
            {/* The owner's photo under a dark layer, so the type and stamps stay readable on any image. */}
            <Image source={{ uri: photo }} resizeMode="cover" accessible={false} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `rgba(17, 19, 15, ${look.overlay / 100})` }} />
          </>
        ) : null}
        {/* Cropped disc in the far corner (the end side: left in RTL), behind everything. */}
        <View
          style={{
            position: 'absolute',
            width: height * 1.15,
            height: height * 1.15,
            borderRadius: height,
            backgroundColor: face.disc,
            end: -height * 0.42,
            bottom: -height * 0.5,
          }}
        />
        <View style={{ position: 'absolute', top: 0, left: CARD_RADIUS, right: CARD_RADIUS, height: 1, backgroundColor: face.edge }} />
        {ready ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: CARD_RADIUS, borderWidth: 3, borderColor: face.accentBg }} />
        ) : null}

        {/* Header strip: what shows while stacked. */}
        <View style={{ height: STRIP, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 }}>
          {look.logoUrl ? (
            <Image source={{ uri: look.logoUrl }} resizeMode="cover" accessible={false} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: face.avatarBg }} />
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: face.avatarBg, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={17} weight={800} color={face.avatarFg}>{card.business.initial}</Txt>
            </View>
          )}
          <Txt size={18} weight={800} color={face.fg} numberOfLines={1} style={{ flex: 1, letterSpacing: -0.4 }}>
            {card.business.name}
          </Txt>
          {ready ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: face.accentBg, borderRadius: 999, paddingStart: 8, paddingEnd: 10, paddingVertical: 5 }}>
              <CheckIcon size={14} color={face.accentFg} />
              <Txt size={13} weight={800} color={face.accentFg}>ההטבה מוכנה</Txt>
            </View>
          ) : (
            <Count card={card} fg={face.fg} sub={face.sub} />
          )}
        </View>

        {/* Body */}
        <View style={{ flex: 1, paddingHorizontal: 18, paddingBottom: 14, justifyContent: 'space-between' }}>
          <View style={{ gap: 10 }}>
            <Txt size={14} weight={600} color={face.sub} numberOfLines={1}>{card.program.name}</Txt>
            {points ? (
              <Meter goal={card.program.goal} current={card.current} onLime={face.stamps === 'lime'} dark={face.stamps === 'dark' || face.stamps === 'photo'} />
            ) : (
              <Stamps goal={card.program.goal} current={card.current} surface={face.stamps} shape={look.stampShape} columns={stampColumns(card.program.goal)} gap={card.program.goal > 8 ? 6 : 8} />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt size={15} weight={700} color={face.fg} numberOfLines={2}>
                {ready ? `ההטבה מוכנה: ${card.program.reward}` : `${remainingLabel(card.program.type, missing)}: ${card.program.reward}`}
              </Txt>
              {card.business.isSample ? (
                <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, backgroundColor: face.stamps === 'dark' || face.stamps === 'photo' ? colors.paperOnInk16 : colors.inkOnLime14 }}>
                  <Txt size={11} weight={600} color={face.fg}>לדוגמה</Txt>
                </View>
              ) : null}
            </View>
            <Wordmark size={14} tone={face.stamps === 'dark' || face.stamps === 'photo' ? 'lime' : 'ink'} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Count({ card, fg, sub }: { card: Card; fg: string; sub: string }) {
  if (card.program.type === 'points') {
    return (
      <Txt size={13} weight={600} color={sub}>
        <Txt size={22} weight={800} color={fg} style={{ letterSpacing: -0.7 }}>{card.current}</Txt> נק׳
      </Txt>
    );
  }
  return (
    <View style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'baseline' }}>
      <Txt size={22} weight={800} color={fg} tabular style={{ letterSpacing: -0.7 }}>{card.current}</Txt>
      <Txt size={14} weight={600} color={sub} tabular>/{card.program.goal}</Txt>
    </View>
  );
}
