// GET /api/config — serves the PUBLIC Supabase URL and anon/publishable key
// from Vercel environment variables so they are never hardcoded in the repo.
// The service-role key is never returned.
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  res.setHeader('Cache-Control', 'no-store');
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server is missing SUPABASE_URL or SUPABASE_ANON_KEY' });
  }
  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
