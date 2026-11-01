// Downloads of a counter code in the browser: the A6 PDF card (lib/counterCard.ts, the same card qr:print
// makes) and a 1200 px PNG. Shared by the QR page and the first-run guide.
import QRCode from 'qrcode';
import type { CounterCode } from '../../supabase/functions/_shared/api-types.ts';
import { parseQrPayload } from '../../supabase/functions/_shared/token.ts';
import { cardFooter, counterCardPdf, QR_PNG_OPTIONS } from './counterCard';

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

export async function downloadPng(code: CounterCode) {
  download(`perko-${code.id.slice(0, 8)}.png`, await QRCode.toDataURL(code.payload, QR_PNG_OPTIONS));
}

export async function downloadPdf(code: CounterCode, businessName: string) {
  const [heavy, regular] = await Promise.all(
    ['/fonts/Heebo_800ExtraBold.ttf', '/fonts/Heebo_400Regular.ttf'].map((u) => fetch(u).then((r) => r.arrayBuffer())),
  );
  const version = parseQrPayload(code.payload)?.version ?? 1;
  const bytes = await counterCardPdf(code.payload, businessName, cardFooter(code.id, version, code.label), { heavy, regular });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  download(`perko-${code.id.slice(0, 8)}.pdf`, url);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A small preview image of the code. */
export function previewDataUrl(payload: string, width = 360): Promise<string> {
  return QRCode.toDataURL(payload, { ...QR_PNG_OPTIONS, width });
}
