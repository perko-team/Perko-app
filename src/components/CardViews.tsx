// Wallet card views shared by the wallet, rewards and business screens.
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import { FULL_TITLE, progress, remaining, remainingLabel, ruleFacts } from '../../supabase/functions/_shared/loyalty.ts';
import type { Business, Card } from '../lib/types';
import { colors, radius, touch } from '../theme';
import { ChevronIcon } from './Icons';
import { Bar, Progress } from './Stamps';
import { Txt } from './Txt';
import { useTheme } from '../lib/appearance';
import { OnBrand } from './surface';
import { Avatar, Button, Tag } from './ui';

/** "10 חותמות = קפה הפוך עלינו". */
export function programLine(b: Pick<Business, 'program'>): string {
  const p = b.program;
  if (!p) return 'התוכנית בהכנה';
  return p.type === 'points' ? `${p.goal} נק׳ = ${p.reward}` : `${p.goal} חותמות = ${p.reward}`;
}

/** "9/10" or "120 נק׳". */
export function countLabel(card: Pick<Card, 'current' | 'program'>): string {
  return card.program.type === 'points' ? `${card.current} נק׳` : `${card.current}/${card.program.goal}`;
}

export function cardA11y(card: Card): string {
  const unit = card.program.type === 'points' ? 'נקודות' : 'חותמות';
  const ready = card.status === 'complete' ? FULL_TITLE : remainingLabel(card.program.type, remaining(card.program, card.current));
  return `${card.business.name}, ${card.program.name}. ${card.current} מתוך ${card.program.goal} ${unit}. ${ready}.`;
}

/**
 * The lime card (website .ui-card--lime). action: a visible button right under it, e.g. "לקבל את ההטבה" on the
 * rewards tab. It sits outside the card's pressable so TalkBack reaches it as its own button.
 */
export function HeroCard({ card, onPress, action }: { card: Card; onPress: () => void; action?: { label: string; onPress: () => void } }) {
  const ready = card.status === 'complete';
  const body = (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={cardA11y(card)} accessibilityHint="פותח את פרטי הכרטיס">
      {({ pressed }) => (
        <OnBrand>
        <View style={{ backgroundColor: pressed ? colors.lime2 : colors.lime, borderRadius: radius.card, padding: 18, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Avatar initial={card.business.initial} tone="onLime" />
            <View style={{ flex: 1 }}>
              <Txt kind="label" size={17} weight={800}>{card.business.name}</Txt>
              <Txt size={14} color={colors.muted}>{card.program.name}</Txt>
            </View>
            <Count card={card} />
          </View>
          <Progress type={card.program.type} goal={card.program.goal} current={card.current} onLime animate />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
            <Txt kind="label" weight={700} style={{ flex: 1 }}>
              {ready ? `${FULL_TITLE}: ${card.program.reward}` : remainingLabel(card.program.type, remaining(card.program, card.current))}
            </Txt>
            {card.business.isSample ? <Tag label="לדוגמה" onLime /> : null}
          </View>
        </View>
        </OnBrand>
      )}
    </Pressable>
  );
  if (!action) return body;
  return (
    <View style={{ gap: 8 }}>
      {body}
      <Button label={action.label} onPress={action.onPress} hint={`${card.business.name}: ${card.program.reward}`} />
    </View>
  );
}

function Count({ card }: { card: Card }) {
  if (card.program.type === 'points') {
    return (
      <Txt size={14} weight={600} color={colors.muted}>
        <Txt size={28} weight={800} style={{ letterSpacing: -0.9 }}>{card.current}</Txt> נק׳
      </Txt>
    );
  }
  return (
    <View style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'baseline' }}>
      <Txt size={28} weight={800} style={{ letterSpacing: -0.9 }} tabular>{card.current}</Txt>
      <Txt size={16} weight={600} color={colors.muted} tabular>/{card.program.goal}</Txt>
    </View>
  );
}

/** A compact row (website .ui-row). */
export function CardRow({ card, onPress }: { card: Card; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={cardA11y(card)} accessibilityHint="פותח את פרטי הכרטיס">
      {({ pressed }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? t.surfaceStrong : t.surface, borderRadius: radius.row, padding: 12, minHeight: touch + 16 }}>
          <Avatar initial={card.business.initial} tone={card.business.tone} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt kind="label" weight={700}>{card.business.name}</Txt>
              {card.status === 'complete' ? <ReadyDot /> : null}
            </View>
            <Bar value={progress(card.program, card.current)} />
          </View>
          <Txt kind="label" weight={700} tabular style={{ minWidth: 52, textAlign: 'center' }}>{countLabel(card)}</Txt>
          <ChevronIcon size={18} color={t.textMuted} />
        </View>
      )}
    </Pressable>
  );
}

function ReadyDot() {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Txt size={11} weight={700} color={t.onAccent}>הטבה מוכנה</Txt>
    </View>
  );
}

/** The business's rules (website Solution.astro "הכללים של העסק הזה"). */
export function RulesBox({ program }: { program: NonNullable<Business['program']> }) {
  const { t } = useTheme();
  const unit = program.type === 'points' ? 'נקודות' : 'חותמות';
  const rows: [string, string][] = [
    ...ruleFacts(program).map((f): [string, string] => [f.label, f.value]),
    ['ההטבה', `${program.reward} אחרי ${program.goal} ${unit}`],
    ['איפה מקבלים', program.redeemRule],
  ];
  return (
    <View style={{ backgroundColor: t.surface, borderRadius: radius.row, paddingHorizontal: 16, paddingVertical: 14 }}>
      <Txt kind="label" weight={800} style={{ marginBottom: 6 }} accessibilityRole="header">הכללים של העסק הזה</Txt>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
          <Txt size={15} color={t.textMuted}>{k}</Txt>
          <Txt size={15} weight={600} style={{ flexShrink: 1 }}>{v}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Address, hours and an optional link out. */
export function PlaceInfo({ business }: { business: Business }) {
  const { t } = useTheme();
  if (!business.address && !business.hours && !business.website) return null;
  return (
    <View style={{ backgroundColor: t.surface, borderRadius: radius.row, paddingHorizontal: 16, paddingVertical: 14, gap: 6 }}>
      {business.address ? <Txt size={15}><Txt size={15} weight={700}>כתובת: </Txt>{business.address}</Txt> : null}
      {business.hours ? (
        <View>
          <Txt size={15} weight={700}>{business.hours.startsWith('שעות לדוגמה') ? 'שעות (לדוגמה)' : 'שעות'}</Txt>
          {/* One line per day range keeps Hebrew and times from mixing in one bidi run. */}
          {business.hours.replace(/^שעות לדוגמה: /, '').split(/,\s*/).map((line) => (
            <Txt key={line} size={15}>{line}</Txt>
          ))}
        </View>
      ) : null}
      {business.website ? (
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(business.website!)}
          accessibilityRole="link"
          accessibilityLabel={`האתר של ${business.name}`}
          style={{ minHeight: touch, justifyContent: 'center' }}
        >
          <Txt kind="label" style={{ textDecorationLine: 'underline' }}>לאתר של העסק</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
const dayFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
