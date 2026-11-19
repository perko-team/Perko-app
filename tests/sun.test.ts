// NTAG 424 DNA SUN verification. Vectors: RFC 4493 (AES-CMAC) and NXP AN12196, section "SUN message with
// encrypted PICC data and plain CMAC" (all keys zero, UID 04DE5F1EACC040, SDMReadCtr 61).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aesCmac, aesDecryptBlock, aesEncryptBlock, appMasterKey, decryptPicc, fileReadKey, fromHex, nfcPayload, parseNfcPayload,
  sunMac, toHex, verifySun,
} from '../supabase/functions/_shared/sun.ts';

const ZERO = new Uint8Array(16);

test('AES-128 block encrypt and decrypt (FIPS-197 vector)', async () => {
  const key = fromHex('000102030405060708090A0B0C0D0E0F');
  const ct = await aesEncryptBlock(key, fromHex('00112233445566778899AABBCCDDEEFF'));
  assert.equal(toHex(ct), '69C4E0D86A7B0430D8CDB78070B4C55A');
  assert.equal(toHex(await aesDecryptBlock(key, ct)), '00112233445566778899AABBCCDDEEFF');
});

test('AES-CMAC matches RFC 4493', async () => {
  const key = fromHex('2B7E151628AED2A6ABF7158809CF4F3C');
  const m = fromHex('6BC1BEE22E409F96E93D7E117393172AAE2D8A571E03AC9C9EB76FAC45AF8E5130C81C46A35CE411E5FBC1191A0A52EFF69F2445DF4F9B17AD2B417BE66C3710');
  assert.equal(toHex(await aesCmac(key, new Uint8Array(0))), 'BB1D6929E95937287FA37D129B756746');
  assert.equal(toHex(await aesCmac(key, m.slice(0, 16))), '070A16B46B4D4144F79BDD9DD04A287C');
  assert.equal(toHex(await aesCmac(key, m.slice(0, 40))), 'DFA66747DE9AE63030CA32611497C827');
  assert.equal(toHex(await aesCmac(key, m)), '51F0BEBF7E3B9D92FC49741779363CFE');
});

test('AN12196: PICC data decrypts to UID 04DE5F1EACC040 and counter 61', async () => {
  const picc = await decryptPicc(ZERO, fromHex('EF963FF7828658A599F3041510671E88'));
  assert.ok(picc);
  assert.equal(toHex(picc.uid), '04DE5F1EACC040');
  assert.equal(toHex(picc.ctr), '3D0000');
});

test('AN12196: SUN MAC over empty input is 94EED9EE65337086', async () => {
  const mac = await sunMac(ZERO, fromHex('04DE5F1EACC040'), fromHex('3D0000'));
  assert.equal(toHex(mac), '94EED9EE65337086');
});

/** A tap as a provisioned Perko tag would make it: keys from test secrets, any UID and counter. */
async function makeTap(meta: Uint8Array, master: Uint8Array, uidHex: string, counter: number) {
  const uid = fromHex(uidHex);
  const ctr = new Uint8Array([counter & 0xff, (counter >> 8) & 0xff, (counter >> 16) & 0xff]);
  const plain = new Uint8Array(16);
  plain.set([0xc7], 0);
  plain.set(uid, 1);
  plain.set(ctr, 8);
  plain.set([0x11, 0x22, 0x33, 0x44, 0x55], 11);
  const p = toHex(await aesEncryptBlock(meta, plain));
  const c = toHex(await sunMac(await fileReadKey(master, uid), uid, ctr));
  return { p, c };
}

const META = fromHex('A1A2A3A4A5A6A7A8A9AAABACADAEAFA0');
const MASTER = fromHex('0F1E2D3C4B5A69788796A5B4C3D2E1F0');

test('verifySun accepts a genuine tap and returns UID and counter', async () => {
  const { p, c } = await makeTap(META, MASTER, '04AABBCCDDEE80', 70000);
  assert.deepEqual(await verifySun({ meta: META, master: MASTER }, p, c), { uid: '04AABBCCDDEE80', counter: 70000 });
  // Lower-case hex as some readers write it.
  assert.deepEqual(await verifySun({ meta: META, master: MASTER }, p.toLowerCase(), c.toLowerCase()), { uid: '04AABBCCDDEE80', counter: 70000 });
});

test('verifySun rejects a forged or altered tap', async () => {
  const keys = { meta: META, master: MASTER };
  const { p, c } = await makeTap(META, MASTER, '04AABBCCDDEE80', 5);
  const flip = (h: string, i: number) => h.slice(0, i) + (h[i] === '0' ? '1' : '0') + h.slice(i + 1);
  assert.equal(await verifySun(keys, p, flip(c, 3)), null, 'MAC changed');
  assert.equal(await verifySun(keys, flip(p, 30), c), null, 'PICC data changed');
  // Another tag's key (another UID) or another master key: no match.
  const other = await makeTap(META, fromHex('00112233445566778899AABBCCDDEEFF'), '04AABBCCDDEE80', 5);
  assert.equal(await verifySun(keys, other.p, other.c), null, 'made with another master key');
  const wrongMeta = await makeTap(fromHex('FFEEDDCCBBAA99887766554433221100'), MASTER, '04AABBCCDDEE80', 5);
  assert.equal(await verifySun(keys, wrongMeta.p, wrongMeta.c), null, 'made with another meta key');
  assert.equal(await verifySun(keys, 'XYZ', c), null);
  assert.equal(await verifySun(keys, p, c + '00'), null);
});

test('per-tag keys: the file-read key and key 0 differ per UID and from each other', async () => {
  const a = await fileReadKey(MASTER, fromHex('04AABBCCDDEE80'));
  const b = await fileReadKey(MASTER, fromHex('04AABBCCDDEE81'));
  assert.notEqual(toHex(a), toHex(b));
  assert.notEqual(toHex(a), toHex(await appMasterKey(MASTER, fromHex('04AABBCCDDEE80'))));
  assert.equal(toHex(a), toHex(await aesCmac(MASTER, fromHex('04AABBCCDDEE80'))), 'AES-CMAC(NFC_MASTER_KEY, UID)');
});

test('the tap payload is read from the tag URL, the app link or the bare query', () => {
  const p = 'EF963FF7828658A599F3041510671E88';
  const c = '94EED9EE65337086';
  assert.deepEqual(parseNfcPayload(`https://www.getperko.com/t?p=${p}&c=${c}`), { p, c });
  assert.deepEqual(parseNfcPayload(`perko://t?c=${c.toLowerCase()}&p=${p.toLowerCase()}`), { p, c });
  assert.deepEqual(parseNfcPayload(nfcPayload(p, c)), { p, c });
  assert.equal(parseNfcPayload(`https://evil.example/t?p=${p}&c=${c}`), null, 'another site');
  assert.equal(parseNfcPayload(`p=${p}`), null);
  assert.equal(parseNfcPayload(`p=${p.slice(2)}&c=${c}`), null);
});

import { pinRequired } from '../supabase/functions/_shared/loyalty.ts';
test('PIN: always for QR, for NFC only when the business asks for it', () => {
  assert.equal(pinRequired('qr', false), true);
  assert.equal(pinRequired('qr', true), true);
  assert.equal(pinRequired('nfc', false), false);
  assert.equal(pinRequired('nfc', true), true);
});
