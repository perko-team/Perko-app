// "קיבלתם את ההטבה": the screen after a reward is confirmed, from the redeem screen or right after the scan
// that filled the card. Shows whose reward it is (logo or initial) and what it was, so the staff member can
// glance at it and hand the phone back.
import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { useTheme } from '../lib/appearance';
import type { Business } from '../lib/types';
import { CheckIcon } from './Icons';
import { Txt } from './Txt';
import { Button, Screen } from './ui';

export function RewardDone({ reward, businessName, business }: { reward: string; businessName: string; business?: Business | null }) {
  const { t } = useTheme();
  return (
    <Screen bg={t.hero} contentStyle={{ flexGrow: 1, justifyContent: 'center', gap: 14 }}>
      {/* The business's logo or initial, with a check badge on its corner. Accent colours, so it reads on the hero. */}
      <View style={{ width: 80, height: 80 }} accessible accessibilityLabel={businessName}>
        {business?.look.logoUrl ? (
          <Image source={{ uri: business.look.logoUrl }} accessible={false} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: t.accent }} />
        ) : (
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={36} weight={800} color={t.onAccent}>{business?.initial ?? businessName.slice(0, 1)}</Txt>
          </View>
        )}
        <View style={{ position: 'absolute', bottom: -6, end: -6, width: 34, height: 34, borderRadius: 17, backgroundColor: t.hero, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon size={18} color={t.onAccent} />
          </View>
        </View>
      </View>
      <Txt kind="display" accessibilityRole="header">קיבלתם את ההטבה</Txt>
      <Txt kind="title" size={24}>{reward}</Txt>
      <Txt kind="lead" color={t.onHeroMuted}>ב{businessName}. כרטיס חדש כבר התחיל בארנק.</Txt>
      <Button label="חזרה לכרטיסים" onPress={() => router.dismissTo('/')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
    </Screen>
  );
}
