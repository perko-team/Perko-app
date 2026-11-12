// Under the focused wallet card: the card's last 5 collections and its rules, so the screen is not empty space.
// It gets the height left between the actions and the pile at the bottom, and scrolls inside it.
import { ScrollView, View } from 'react-native';
import { ruleFacts } from '../../../supabase/functions/_shared/loyalty.ts';
import { api } from '../../lib/api';
import { useTheme } from '../../lib/appearance';
import { useLoad } from '../../lib/hooks';
import type { Card } from '../../lib/types';
import { radius } from '../../theme';
import { formatDate } from '../CardViews';
import { Txt } from '../Txt';

export function FocusDetails({ card, maxHeight }: { card: Card; maxHeight: number }) {
  const { t } = useTheme();
  // Keyed by the card and its count, so a new stamp shows when the wallet reloads.
  const { data } = useLoad(() => api.getCard(card.id), [card.id, card.current]);
  if (maxHeight < 72) return null;
  const events = (data?.events ?? []).slice(0, 5);
  const unit = (amount: number) => (card.program.type === 'points' ? `${amount} נקודות` : amount === 1 ? 'חותמת' : `${amount} חותמות`);

  return (
    <ScrollView style={{ maxHeight }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: t.surface, borderRadius: radius.row, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Txt size={15} weight={800} accessibilityRole="header" style={{ marginBottom: 2 }}>אחרונות בכרטיס</Txt>
        {data && events.length === 0 ? <Txt size={15} color={t.textMuted}>עוד לא נאספו חותמות בכרטיס הזה.</Txt> : null}
        {events.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }} accessible accessibilityLabel={`${unit(e.amount)}, ${formatDate(e.createdAt)}`}>
            <Txt size={15} weight={600}>{unit(e.amount)}</Txt>
            <Txt size={15} color={t.textMuted}>{formatDate(e.createdAt)}</Txt>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: t.surface, borderRadius: radius.row, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Txt size={15} weight={800} accessibilityRole="header" style={{ marginBottom: 2 }}>הכללים</Txt>
        {ruleFacts(card.program).map((f) => (
          <View key={f.label} style={{ paddingVertical: 3 }}>
            <Txt size={14} color={t.textMuted}>{f.label}</Txt>
            <Txt size={15} weight={600}>{f.value}</Txt>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
