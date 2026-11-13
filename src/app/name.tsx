// Right after the first sign-in: "איך לקרוא לך?". Required: the app greets people by name ("שלום, נועה") and the
// business sees it in its log instead of a masked phone or email. Shown again on launch until a name is saved.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { nameProblem, NAME_MAX } from '../../supabase/functions/_shared/loyalty.ts';
import { Wordmark } from '../components/Brand';
import { Txt } from '../components/Txt';
import { Button, Screen } from '../components/ui';
import { useTheme } from '../lib/appearance';
import { api } from '../lib/api';
import { NetworkError } from '../lib/backend';
import { useSession } from '../lib/session';
import { fonts } from '../theme';

export default function AskName() {
  const { t } = useTheme();
  const { profile, setProfile } = useSession();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const problem = nameProblem(name);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await api.updateName(name);
      // A profile with a name opens the wallet (the route guard in _layout.tsx).
      setProfile(profile ? { ...profile, name: name.trim() } : null);
    } catch (e) {
      setError(e instanceof NetworkError ? 'אין חיבור לאינטרנט. השם לא נשמר, מנסים שוב.' : 'השם לא נשמר. מנסים שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bg={t.hero} contentStyle={{ gap: 14 }}>
        <View style={{ alignItems: 'flex-end', marginBottom: 28 }}>
          <Wordmark size={26} tone={t.dark ? 'lime' : 'ink'} />
        </View>
        <Txt kind="display" color={t.onHero} accessibilityRole="header">איך לקרוא לך?</Txt>
        <Txt kind="lead" color={t.onHeroMuted}>שם פרטי מספיק. ככה נברך אותך באפליקציה, והעסקים יזהו אותך ביומן.</Txt>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          onSubmitEditing={save}
          autoFocus
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="done"
          placeholder="למשל נועה"
          placeholderTextColor={t.placeholder}
          accessibilityLabel="שם פרטי"
          maxLength={NAME_MAX}
          selectionColor={t.text}
          cursorColor={t.text}
          style={{ minHeight: 56, borderRadius: 16, backgroundColor: t.surface, paddingHorizontal: 16, fontFamily: fonts[500], fontSize: 18, color: t.text, marginTop: 8 }}
        />
        {error ? <Txt kind="label" color={t.onHero} accessibilityRole="alert">{error}</Txt> : null}
        <Button label="המשך" onPress={save} busy={busy} disabled={!name.trim()} style={{ marginTop: 6 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
