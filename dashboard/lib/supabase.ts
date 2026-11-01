// The browser's Supabase client: the owner's session (email code), reads under RLS, RPCs that check membership,
// and the business-admin Edge Function for anything that needs a secret. Never the service role key.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_URL = url;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const configured = Boolean(url && key);

/**
 * Sent as emailRedirectTo with the sign-in code request. The code email template (supabase/templates/otp.html)
 * compares .RedirectTo with it to send owners the dashboard's design. It must be listed under Authentication >
 * URL Configuration > Redirect URLs; no link in the email uses it (sign-in is by code).
 */
export const BUSINESS_EMAIL_MARK = 'https://business.getperko.com/';

let client: SupabaseClient | null = null;

/** Created on first use in the browser, so the build does not need the env variables. */
export function sb(): SupabaseClient {
  if (!configured) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}
