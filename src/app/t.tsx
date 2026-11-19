import { Redirect, useLocalSearchParams } from 'expo-router';
import { nfcPayload } from '../../supabase/functions/_shared/sun.ts';

/**
 * A tap on a business's NFC tag: https://www.getperko.com/t?p=..&c=.. (Android opens it here) or perko://t?p=..&c=..
 * (the "פתחו ב-Perko" button on that web page, for iPhones). Hands the tap to the scan screen, which collects
 * through src/lib/collect.ts. Nothing is checked here: the server verifies the tag's signature and counter.
 */
export default function TagTap() {
  const { p, c } = useLocalSearchParams<{ p?: string; c?: string }>();
  return <Redirect href={{ pathname: '/scan', params: { nfc: nfcPayload(String(p ?? ''), String(c ?? '')) } }} />;
}
