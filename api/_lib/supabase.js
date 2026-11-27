// Shared server-side helpers. Files under api/_lib are not exposed as routes
// (Vercel skips paths starting with an underscore).
import { createClient } from '@supabase/supabase-js';
import { HttpError } from './errors.js';

export { HttpError };

let factory = (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** Test hook: replace the Supabase client factory. */
export function __setClientFactory(fn) {
  factory = fn;
}

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return factory(url, key);
}

export function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

/**
 * Verifies the Bearer JWT with Supabase Auth.
 * Returns { user, db } where db is a service-role client (bypasses RLS: scope every query to user.id).
 */
export async function requireUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, 'Missing Bearer token');

  const db = serviceClient();
  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data?.user) throw new HttpError(401, 'Invalid or expired session');
  return { user: data.user, db };
}

/** Like requireUser, and also confirms profiles.role === 'admin'. */
export async function requireAdmin(req) {
  const { user, db } = await requireUser(req);
  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) throw new HttpError(403, 'Profile not found');
  if (profile.role !== 'admin') throw new HttpError(403, 'Admin role required');

  return { user, db };
}

/** Wraps a handler map { GET, POST, ... } with method routing and error handling. */
export function route(handlers) {
  return async function handler(req, res) {
    const fn = handlers[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '));
      return send(res, 405, { error: 'Method not allowed' });
    }
    try {
      await fn(req, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('[api]', err);
      send(res, status, { error: status === 500 && !(err instanceof HttpError) ? 'Internal server error' : err.message });
    }
  };
}

export function readBody(req) {
  if (req.body == null || req.body === '') return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new HttpError(400, 'Body must be valid JSON');
    }
  }
  return req.body;
}
