// "קיבלתם את ההטבה": the screen after a reward is confirmed, from the redeem screen or right after the scan
// that filled the card. Shows whose reward it is (logo or initial) and what it was, so the staff member can
// glance at it and hand the phone back.
import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { cardFace } from '../cardLook';
import { useTheme } from '../lib/appearance';
import type { Business } from '../lib/types';
import { CheckIcon } from './Icons';
import { Txt } from './Txt';
import { Button, Screen } from './ui';

export function RewardDone({ reward, businessName, business }: { reward: string; businessName: string; business?: Business | null }) {
  const { t } = useTheme();
  const face = business ? cardFace(business.look, business.id) : null;
  return (
    <Screen bg={t.hero} contentStyle={{ flexGrow: 1, justifyContent: 'center', gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel={businessName}>
        {business?.look.logoUrl ? (
          <Image source={{ uri: business.look.logoUrl }} accessible={false} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: face?.avatarBg }} />
        ) : (
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: face?.avatarBg ?? t.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={28} weight={800} color={face?.avatarFg ?? t.onAccent}>{business?.initial ?? businessName.slice(0, 1)}</Txt>
          </View>
        )}
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginStart: -26, marginTop: 34 }}>
          <CheckIcon size={22} color={t.onAccent} />
        </View>
      </View>
      <Txt kind="display" accessibilityRole="header">קיבלתם את ההטבה</Txt>
      <Txt kind="title" size={24}>{reward}</Txt>
      <Txt kind="lead" color={t.onHeroMuted}>ב{businessName}. כרטיס חדש כבר התחיל בארנק.</Txt>
      <Button label="חזרה לכרטיסים" onPress={() => router.dismissTo('/')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
    </Screen>
  );
}
