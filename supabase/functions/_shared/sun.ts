// NTAG 424 DNA Secure Unique NFC (SUN) messages: verification of a tap, per NXP AN12196 ("NTAG 424 DNA and
// NTAG 424 DNA TagTamper features and hints") and the NT4H2421Gx datasheet.
//
// Every tap makes the tag write a fresh URL: https://www.getperko.com/t?p=<PICCData>&c=<SUN MAC>
//   p  32 hex: AES-128-CBC(SDMMetaReadKey, IV 0) of PICCDataTag || UID (7) || SDMReadCtr (3, LSB first) || pad
//   c  16 hex: the odd bytes of AES-CMAC(KSesSDMFileReadMAC, empty input)
//      KSesSDMFileReadMAC = AES-CMAC(SDMFileReadKey, 3C C3 00 01 00 80 || UID || SDMReadCtr)
// Keys: SDMMetaReadKey is one key for every Perko tag (secret NFC_META_KEY); SDMFileReadKey is per tag,
// AES-CMAC(NFC_MASTER_KEY, UID), so no per-tag key is stored. Keys only ever live in Edge Function secrets
// (and the operator's .env for scripts/admin.ts). Never log keys, p, c or the full URL.
//
// WebCrypto only (Deno and Node 20+), no imports. WebCrypto has no raw AES block mode, so one block is
// encrypted with AES-CBC (zero IV) and the padding block dropped, and decrypted with a crafted padding block.

export type SunTap = { uid: string; counter: number };

const ZERO_IV = new Uint8Array(16);

export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) throw new Error('not hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s.toUpperCase();
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

/** A copy backed by a plain ArrayBuffer, as WebCrypto's types want. */
const own = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);

async function cbcKey(key: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  if (key.length !== 16) throw new Error('AES-128 key must be 16 bytes');
  return crypto.subtle.importKey('raw', own(key), { name: 'AES-CBC' }, false, [usage]);
}

/** AES-128 of one 16-byte block (ECB). */
export async function aesEncryptBlock(key: Uint8Array, block: Uint8Array): Promise<Uint8Array> {
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ZERO_IV }, await cbcKey(key, 'encrypt'), own(block)));
  return out.slice(0, 16);
}

/** AES-128 decryption of one 16-byte block (ECB). Appends a block that decrypts to valid PKCS#7 padding. */
export async function aesDecryptBlock(key: Uint8Array, block: Uint8Array): Promise<Uint8Array> {
  const pad = await aesEncryptBlock(key, xor(new Uint8Array(16).fill(16), block));
  const both = new Uint8Array(32);
  both.set(block, 0);
  both.set(pad, 16);
  const out = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ZERO_IV }, await cbcKey(key, 'decrypt'), both));
  return out.slice(0, 16);
}

function shiftLeft(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = ((b[i] << 1) & 0xff) | (i < 15 ? b[i + 1] >> 7 : 0);
  return out;
}

/** AES-CMAC (NIST SP 800-38B, RFC 4493) with a 128-bit key. */
export async function aesCmac(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const l = await aesEncryptBlock(key, new Uint8Array(16));
  const k1 = shiftLeft(l);
  if (l[0] & 0x80) k1[15] ^= 0x87;
  const k2 = shiftLeft(k1);
  if (k1[0] & 0x80) k2[15] ^= 0x87;

  const n = Math.max(1, Math.ceil(message.length / 16));
  const complete = message.length > 0 && message.length % 16 === 0;
  const last = new Uint8Array(16);
  const tail = message.slice((n - 1) * 16);
  last.set(tail);
  if (!complete) last[tail.length] = 0x80;
  const lastBlock = xor(last, complete ? k1 : k2);

  let x: Uint8Array = new Uint8Array(16);
  for (let i = 0; i < n - 1; i++) x = await aesEncryptBlock(key, xor(x, message.slice(i * 16, i * 16 + 16)));
  return aesEncryptBlock(key, xor(x, lastBlock));
}

/** The 8 bytes of a SUN MAC: bytes 1, 3, 5, ..., 15 of the full CMAC. */
export function truncateMac(full: Uint8Array): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = full[i * 2 + 1];
  return out;
}

/** A tag's SDMFileReadKey: AES-CMAC(master, UID). Also what the operator writes to the tag as key 2. */
export async function fileReadKey(master: Uint8Array, uid: Uint8Array): Promise<Uint8Array> {
  return aesCmac(master, uid);
}

/** A tag's application master key (key 0), so nobody can reconfigure a provisioned tag. Never used to verify. */
export async function appMasterKey(master: Uint8Array, uid: Uint8Array): Promise<Uint8Array> {
  const msg = new Uint8Array(uid.length + 1);
  msg[0] = 0x00;
  msg.set(uid, 1);
  return aesCmac(master, msg);
}

/** Decrypts p: the UID and read counter, or null when it is not Perko PICC data (tag byte 0xC7: UID + counter). */
export async function decryptPicc(metaKey: Uint8Array, p: Uint8Array): Promise<{ uid: Uint8Array; ctr: Uint8Array } | null> {
  if (p.length !== 16) return null;
  const plain = await aesDecryptBlock(metaKey, p);
  // PICCDataTag: bit 7 UID mirrored, bit 6 counter mirrored, low nibble UID length (7).
  if (plain[0] !== 0xc7) return null;
  return { uid: plain.slice(1, 8), ctr: plain.slice(8, 11) };
}

/** The SUN MAC for a UID and counter, with the tag's file-read key. */
export async function sunMac(fileKey: Uint8Array, uid: Uint8Array, ctr: Uint8Array): Promise<Uint8Array> {
  const sv2 = new Uint8Array(16);
  sv2.set([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80], 0);
  sv2.set(uid, 6);
  sv2.set(ctr, 13);
  const session = await aesCmac(fileKey, sv2);
  return truncateMac(await aesCmac(session, new Uint8Array(0)));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/**
 * Verifies a tap. Returns the tag's UID (14 upper-case hex) and read counter, or null when p or c is malformed,
 * was not made by a Perko tag, or was altered. The caller still has to check the counter against the last one.
 */
export async function verifySun(
  keys: { meta: Uint8Array; master: Uint8Array },
  p: string,
  c: string,
): Promise<SunTap | null> {
  if (!/^[0-9a-fA-F]{32}$/.test(p) || !/^[0-9a-fA-F]{16}$/.test(c)) return null;
  const picc = await decryptPicc(keys.meta, fromHex(p));
  if (!picc) return null;
  const mac = await sunMac(await fileReadKey(keys.master, picc.uid), picc.uid, picc.ctr);
  if (!sameBytes(mac, fromHex(c))) return null;
  return { uid: toHex(picc.uid), counter: picc.ctr[0] | (picc.ctr[1] << 8) | (picc.ctr[2] << 16) };
}

/** The tap's p and c from the tag URL, the perko://t link or the bare query. Format only, nothing verified. */
export function parseNfcPayload(input: string): { p: string; c: string } | null {
  const s = input.trim();
  if (s.length > 300) return null;
  const query = s.includes('?') ? s.slice(s.indexOf('?') + 1) : s;
  const params = new Map<string, string>();
  for (const part of query.split('&')) {
    const i = part.indexOf('=');
    if (i > 0) params.set(part.slice(0, i), part.slice(i + 1));
  }
  const p = params.get('p') ?? '';
  const c = params.get('c') ?? '';
  if (!/^[0-9a-fA-F]{32}$/.test(p) || !/^[0-9a-fA-F]{16}$/.test(c)) return null;
  if (s.includes('?') && !/^(https:\/\/(www\.)?getperko\.com\/t|perko:\/\/t)\/?\?/.test(s)) return null;
  return { p: p.toUpperCase(), c: c.toUpperCase() };
}

/** The payload the app sends to collect for a tap. */
export function nfcPayload(p: string, c: string): string {
  return `p=${p}&c=${c}`;
}

/** The URL the tag writes, with SDM placeholders where the tag mirrors p (32 chars) and c (16 chars). */
export const NFC_URL_TEMPLATE = 'https://www.getperko.com/t?p=00000000000000000000000000000000&c=0000000000000000';

/** Hex secrets of 16 bytes (NFC_META_KEY, NFC_MASTER_KEY). */
export function keyFromHex(hex: string | undefined): Uint8Array | null {
  return hex && /^[0-9a-fA-F]{32}$/.test(hex) ? fromHex(hex) : null;
}
