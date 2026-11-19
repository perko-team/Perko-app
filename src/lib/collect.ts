// The single client entry point for collecting a stamp or points, from either source:
//   QR (counter code): checkCollect() right after the scan (may the customer collect now?), then confirmCollect()
//     with the staff PIN typed on the customer's phone.
//   NFC (a tap on the business's tag, opened as perko://t or https://www.getperko.com/t): confirmCollect() with no
//     PIN writes the stamp at once, or answers 'pin_required' when the business wants a PIN for NFC too; then
//     confirmCollect() again with the PIN. The server, the result handling and the screens are the same.
import NetInfo from '@react-native-community/netinfo';
import { parseNfcPayload } from '../../supabase/functions/_shared/sun.ts';
import { parseQrPayload } from '../../supabase/functions/_shared/token.ts';
import { api } from './api';
import { AuthError, NetworkError } from './backend';
import type { CollectResponse, CollectSource } from './types';

export type CollectOutcome =
  | CollectResponse
  | { status: 'not_perko' } // some other QR code: rejected on the device, no request sent
  | { status: 'offline' }
  | { status: 'signed_out' }
  | { status: 'error' };

/** Quick local check so random QR codes (menus, links) do not hit the server. Does not verify the signature. */
export function looksLikePerkoCode(payload: string, source: CollectSource = 'qr'): boolean {
  return source === 'nfc' ? parseNfcPayload(payload) !== null : parseQrPayload(payload) !== null;
}

async function call(payload: string, source: CollectSource, run: () => Promise<CollectResponse>): Promise<CollectOutcome> {
  if (!looksLikePerkoCode(payload, source)) return { status: 'not_perko' };

  const net = await NetInfo.fetch().catch(() => null);
  if (net && net.isConnected === false) return { status: 'offline' };

  try {
    return await run();
  } catch (e) {
    if (e instanceof NetworkError) return { status: 'offline' };
    if (e instanceof AuthError) return { status: 'signed_out' };
    return { status: 'error' };
  }
}

/** After the scan: 'pin_required' when a stamp can be added, else the reason it cannot (cooldown, full card...). */
export function checkCollect(payload: string, source: CollectSource = 'qr'): Promise<CollectOutcome> {
  return call(payload, source, () => api.checkCollect(payload, source));
}

/**
 * Writes the stamp: 'ok', or 'wrong_pin' / 'locked' when the PIN was not accepted. pin null is an NFC tap
 * without a PIN: 'pin_required' when the business wants one.
 */
export function confirmCollect(payload: string, pin: string | null, source: CollectSource = 'qr'): Promise<CollectOutcome> {
  return call(payload, source, () => api.collect(payload, source, pin));
}
