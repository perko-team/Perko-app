// Everything the dashboard reads and writes. Reads go through RLS and the owner RPCs
// (supabase/migrations/20261031100200_business_members.sql); PINs and counter codes through business-admin.
import type { BusinessAdminRequest, BusinessAdminResponse, PinMode } from '../../supabase/functions/_shared/api-types.ts';
import { MEDIA_BUCKET, mediaUrl, type CardStyle, type StampShape } from '../../src/cardLook.ts';
import { sb, SUPABASE_URL } from './supabase';

export type { PinMode };

/** The card's look as stored: paths in the business-media bucket, not URLs. */
export type LookSettings = { style: CardStyle; imagePath: string | null; logoPath: string | null; overlay: number; stampShape: StampShape };

export type Business = {
  id: string;
  name: string;
  slug: string;
  initial: string;
  pinMode: PinMode;
  active: boolean;
  onboardedAt: string | null;
  look: LookSettings;
};

export type Program = {
  id: string;
  name: string;
  type: 'stamps' | 'points';
  goal: number;
  step: number;
  reward: string;
  rule: string;
  redeemRule: string;
  cooldownMinutes: number;
};

export type Staff = { id: string; name: string; createdAt: string };

export type LogRow = { kind: 'stamp' | 'redeem'; createdAt: string; amount: number | null; reward: string | null; staffName: string; customer: string };

export type Insights = { activeCustomers: number; returningCustomers: number; rewardsRedeemed: number; visits: number; visitsPerCustomer: number };

export type Alert = { id: string; kind: 'pin_lockout' | 'pin_failures'; createdAt: string; seenAt: string | null; failures: number | null; customer: string | null };

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** The businesses the signed-in user owns. */
export async function myBusinesses(): Promise<Business[]> {
  const rows = check(await sb().from('business_members')
    .select('role, business:businesses(id, name, slug, initial, pin_mode, active, onboarded_at, card_style, card_image_path, logo_path, card_overlay, stamp_shape)')
    .eq('role', 'owner'));
  return (rows as unknown as { business: Record<string, any> | null }[])
    .filter((r) => r.business)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST rows are untyped here
    .map(({ business: b }): Business => ({
      id: b!.id, name: b!.name, slug: b!.slug, initial: b!.initial, pinMode: b!.pin_mode, active: b!.active, onboardedAt: b!.onboarded_at,
      look: { style: b!.card_style, imagePath: b!.card_image_path, logoPath: b!.logo_path, overlay: b!.card_overlay, stampShape: b!.stamp_shape },
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

/** Public URL of a business-media file. */
export const media = (path: string | null) => mediaUrl(SUPABASE_URL, path);

/** Saves the card's look. The row's constraints keep each path inside the business's own folder. */
export async function saveLook(businessId: string, look: LookSettings): Promise<void> {
  check(await sb().from('businesses').update({
    card_style: look.style, card_image_path: look.imagePath, logo_path: look.logoPath,
    card_overlay: look.overlay, stamp_shape: look.stampShape,
  }).eq('id', businessId));
}

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Checks a picked file before uploading: an image the bucket accepts. Returns an error message or null. */
export function imageProblem(file: File): string | null {
  if (!IMAGE_TYPES[file.type]) return 'אפשר להעלות JPG, PNG או WEBP.';
  if (file.size > MAX_IMAGE_BYTES) return 'הקובץ גדול מ-5MB.';
  return null;
}

/** Uploads an image to the business's folder under a new name (no cache to bust) and returns its path. */
export async function uploadImage(businessId: string, kind: 'bg' | 'logo', file: File): Promise<string> {
  const path = `${businessId}/${kind}-${Date.now().toString(36)}.${IMAGE_TYPES[file.type]}`;
  const { error } = await sb().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return path;
}

/** Removes images that are no longer used (after a save replaced them). Failures are harmless. */
export async function removeImages(paths: (string | null)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await sb().storage.from(MEDIA_BUCKET).remove(list).catch(() => undefined);
}

export async function markOnboarded(businessId: string): Promise<void> {
  check(await sb().from('businesses').update({ onboarded_at: new Date().toISOString() }).eq('id', businessId));
}

export type Overview = {
  visits: number; prevVisits: number;
  active: number; prevActive: number;
  returning: number; prevReturning: number;
  redeemed: number; prevRedeemed: number;
  openCards: number; nearReward: number; readyCards: number;
};

export async function getOverview(businessId: string, days: number): Promise<Overview> {
  const rows = check(await sb().rpc('business_overview', { p_business: businessId, p_days: days })) as Record<string, number>[];
  const r = rows[0] ?? {};
  return {
    visits: r.visits ?? 0, prevVisits: r.prev_visits ?? 0,
    active: r.active_customers ?? 0, prevActive: r.prev_active_customers ?? 0,
    returning: r.returning_customers ?? 0, prevReturning: r.prev_returning_customers ?? 0,
    redeemed: r.rewards_redeemed ?? 0, prevRedeemed: r.prev_rewards_redeemed ?? 0,
    openCards: r.open_cards ?? 0, nearReward: r.near_reward ?? 0, readyCards: r.ready_cards ?? 0,
  };
}

export async function getDailyVisits(businessId: string, days: number): Promise<{ day: string; visits: number }[]> {
  return check(await sb().rpc('business_daily_visits', { p_business: businessId, p_days: days })) as { day: string; visits: number }[];
}

export async function getHeatmap(businessId: string, days: number): Promise<{ dow: number; hour: number; visits: number }[]> {
  return check(await sb().rpc('business_heatmap', { p_business: businessId, p_days: days })) as { dow: number; hour: number; visits: number }[];
}

export async function getProgram(businessId: string): Promise<Program | null> {
  const p = check(await sb().from('programs').select('*').eq('business_id', businessId).eq('active', true).maybeSingle()) as Record<string, never> | null;
  if (!p) return null;
  return {
    id: p.id, name: p.name, type: p.type, goal: p.goal, step: p.step, reward: p.reward, rule: p.rule,
    redeemRule: p.redeem_rule, cooldownMinutes: p.cooldown_minutes,
  };
}

export async function saveProgram(p: Program): Promise<void> {
  check(await sb().from('programs').update({
    name: p.name, type: p.type, goal: p.goal, step: p.type === 'stamps' ? 1 : p.step, reward: p.reward, rule: p.rule,
    redeem_rule: p.redeemRule, cooldown_minutes: p.cooldownMinutes,
  }).eq('id', p.id));
}

export async function listStaff(businessId: string): Promise<Staff[]> {
  const rows = check(await sb().from('staff_pins').select('id, name, created_at').eq('business_id', businessId).eq('active', true).order('created_at'));
  return (rows as { id: string; name: string; created_at: string }[]).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

/** Calls the business-admin Edge Function as the signed-in owner. */
export async function businessAdmin(body: BusinessAdminRequest): Promise<BusinessAdminResponse> {
  const { data, error } = await sb().functions.invoke('business-admin', { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    const parsed = await res?.json?.().catch(() => null);
    if (parsed?.status) return parsed as BusinessAdminResponse;
    throw new Error(error.message);
  }
  return data as BusinessAdminResponse;
}

export async function getLog(businessId: string, days: number): Promise<LogRow[]> {
  const rows = check(await sb().rpc('business_log', { p_business: businessId, p_days: days, p_limit: 500 })) as Record<string, never>[];
  return rows.map((r) => ({ kind: r.kind, createdAt: r.created_at, amount: r.amount, reward: r.reward, staffName: r.staff_name, customer: r.customer }));
}

export async function getInsights(businessId: string, days: number): Promise<Insights> {
  const rows = check(await sb().rpc('business_insights', { p_business: businessId, p_days: days })) as Record<string, number>[];
  const r = rows[0] ?? {};
  return {
    activeCustomers: r.active_customers ?? 0,
    returningCustomers: r.returning_customers ?? 0,
    rewardsRedeemed: r.rewards_redeemed ?? 0,
    visits: r.visits ?? 0,
    visitsPerCustomer: Number(r.visits_per_customer ?? 0),
  };
}

export async function getAlerts(businessId: string): Promise<Alert[]> {
  const rows = check(await sb().rpc('business_alert_list', { p_business: businessId, p_limit: 200 })) as Record<string, never>[];
  return rows.map((r) => ({ id: r.id, kind: r.kind, createdAt: r.created_at, seenAt: r.seen_at, failures: r.failures, customer: r.customer }));
}

export async function markAlertsSeen(businessId: string): Promise<void> {
  check(await sb().from('business_alerts').update({ seen_at: new Date().toISOString() }).eq('business_id', businessId).is('seen_at', null));
}

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
/** Dates and times in Israel time, whatever the owner's computer is set to. */
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
