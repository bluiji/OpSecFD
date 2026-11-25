// Fetches public config from /api/config, then initializes supabase-js from the ESM CDN.
// Keys live in Vercel environment variables, never in this repository.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let clientPromise;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const res = await fetch('/api/config', { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.error || `Could not load configuration (HTTP ${res.status})`);
      }
      const { supabaseUrl, supabaseAnonKey } = await res.json();
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    })();
    clientPromise.catch(() => (clientPromise = undefined)); // allow retry after failure
  }
  return clientPromise;
}

/** Calls a protected admin API route with the current user's access token. */
export async function adminFetch(path, { method = 'GET', body } = {}) {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are not signed in');
  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (HTTP ${res.status})`);
  return json;
}
