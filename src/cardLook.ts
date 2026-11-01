// The look of a business's loyalty card: background, logo and stamp shape. Set by the owner in the dashboard
// (businesses.card_style, card_image_path, logo_path, card_overlay, stamp_shape) and drawn by the app's wallet
// card and the dashboard's live preview from the same faces and shapes. No platform imports.
import { colors } from './tokens.ts';

export type CardStyle = 'auto' | 'lime' | 'ink' | 'paper' | 'photo';
export type StampShape = 'circle' | 'cup' | 'heart' | 'star';

export type CardLook = {
  style: CardStyle;
  /** Public URL of the background photo (style 'photo'), else null. */
  imageUrl: string | null;
  /** Public URL of the logo shown instead of the business's initial, else null. */
  logoUrl: string | null;
  /** Darkness of the layer over the photo, 30-85 (percent). */
  overlay: number;
  stampShape: StampShape;
};

export const DEFAULT_LOOK: CardLook = { style: 'auto', imageUrl: null, logoUrl: null, overlay: 55, stampShape: 'circle' };

export const MEDIA_BUCKET = 'business-media';

/** Public URL of a file in the business-media bucket. */
export function mediaUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path || !supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** The surface stamps sit on: decides their empty, filled and glyph colours. */
export type StampSurface = 'light' | 'lime' | 'dark' | 'photo';

export type Face = {
  bg: string;
  fg: string;
  sub: string;
  /** The large cropped disc, an echo of the logo's dot (not drawn over a photo). */
  disc: string;
  /** 1 px highlight along the top edge, like light catching the edge of a plastic card. */
  edge: string;
  stamps: StampSurface;
  avatarBg: string;
  avatarFg: string;
  /** "ready" pill and ring. */
  accentBg: string;
  accentFg: string;
};

const light = { fg: colors.ink, sub: colors.muted, stamps: 'lime' as const, avatarBg: colors.ink, avatarFg: colors.lime, accentBg: colors.ink, accentFg: colors.lime };
const dark = { fg: colors.paper, sub: colors.slateOnInk, stamps: 'dark' as const, avatarBg: colors.lime, avatarFg: colors.ink, accentBg: colors.lime, accentFg: colors.ink };

/** Card faces, only from the brand palette. The first three are the ones an owner can pick by name. */
export const FACES: Face[] = [
  { ...light, bg: colors.lime, disc: colors.lime2, edge: 'rgba(255, 255, 255, 0.55)' },
  { ...dark, bg: colors.ink, disc: colors.inkRaised, edge: 'rgba(248, 248, 244, 0.14)' },
  { ...light, bg: colors.paper, disc: colors.pale, edge: 'rgba(255, 255, 255, 0.9)', stamps: 'light' },
  { ...light, bg: colors.lime2, disc: colors.lime, edge: 'rgba(255, 255, 255, 0.45)' },
  { ...dark, bg: colors.muted, disc: 'rgba(17, 19, 15, 0.22)', edge: 'rgba(248, 248, 244, 0.16)' },
];

/** Over a photo: off-white type and stamps on the dark layer; the ink behind shows while the photo loads. */
export const PHOTO_FACE: Face = {
  bg: colors.ink, fg: colors.paper, sub: 'rgba(248, 248, 244, 0.78)', disc: 'transparent', edge: 'rgba(255, 255, 255, 0.18)',
  stamps: 'photo', avatarBg: colors.paper, avatarFg: colors.ink, accentBg: colors.lime, accentFg: colors.ink,
};

/** The face for a card: the owner's choice, or a stable colour per business ('auto'). */
export function cardFace(look: Pick<CardLook, 'style' | 'imageUrl'>, businessId: string): Face {
  switch (look.style) {
    case 'lime': return FACES[0];
    case 'ink': return FACES[1];
    case 'paper': return FACES[2];
    case 'photo': if (look.imageUrl) return PHOTO_FACE; break;
  }
  let h = 0;
  for (let i = 0; i < businessId.length; i++) h = (h * 31 + businessId.charCodeAt(i)) >>> 0;
  return FACES[h % FACES.length];
}

/** Stamp colours on each surface: the empty disc, the filled disc and the glyph drawn on each. */
export function stampColors(surface: StampSurface) {
  switch (surface) {
    case 'dark': return { empty: colors.paperOnInk16, ring: colors.paperOnInk60, filled: colors.lime, onFilled: colors.ink, onEmpty: 'rgba(248, 248, 244, 0.45)' };
    case 'photo': return { empty: 'rgba(248, 248, 244, 0.16)', ring: 'rgba(248, 248, 244, 0.6)', filled: colors.paper, onFilled: colors.ink, onEmpty: 'rgba(248, 248, 244, 0.5)' };
    case 'lime': return { empty: colors.inkOnLime14, ring: colors.inkOnLime70, filled: colors.ink, onFilled: colors.lime, onEmpty: 'rgba(17, 19, 15, 0.4)' };
    default: return { empty: colors.pale, ring: colors.paleStrong, filled: colors.ink, onFilled: colors.lime, onEmpty: colors.muted };
  }
}

/** Glyphs drawn inside a stamp, 24x24 viewBox, stroked (the circle is filled). 'circle' is the plain disc. */
export const STAMP_GLYPHS: Record<Exclude<StampShape, 'circle'>, string> = {
  cup: 'M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5zM16 10h1.5a2.5 2.5 0 010 5H16M8 3v2M11 2v3',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0112 7.6 4.2 4.2 0 0119.5 10c0 5.4-7.5 10-7.5 10z',
  star: 'M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z',
};

export const STAMP_SHAPE_LABELS: Record<StampShape, string> = { circle: 'עיגול', cup: 'כוס', heart: 'לב', star: 'כוכב' };
export const CARD_STYLE_LABELS: Record<CardStyle, string> = { auto: 'אוטומטי', lime: 'ליים', ink: 'דיו', paper: 'נייר', photo: 'תמונה' };
