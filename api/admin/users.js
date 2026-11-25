// /api/admin/users
//   GET                         → roster with completion % and average quiz score
//   PATCH { user_id, role }     → change a user's role ('student' | 'admin')
// Requires: Authorization: Bearer <Supabase access token> of an admin.
import { route, requireAdmin, readBody, send, HttpError } from '../_lib/supabase.js';
import { validateUuid, validateRole } from '../_lib/validate.js';

/** Pure aggregation, exported for tests. */
export function buildRoster(profiles, progress, totalLessons) {
  const byUser = new Map();
  for (const p of progress) {
    const s = byUser.get(p.user_id) || { completed: 0, scores: [] };
    if (p.completed) s.completed += 1;
    if (Number.isInteger(p.quiz_score)) s.scores.push(p.quiz_score);
    byUser.set(p.user_id, s);
  }
  return profiles.map((u) => {
    const s = byUser.get(u.id) || { completed: 0, scores: [] };
    const avg = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null;
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
      lessons_completed: s.completed,
      completion_pct: totalLessons ? Math.round((s.completed / totalLessons) * 100) : 0,
      avg_quiz_score: avg,
      quizzes_taken: s.scores.length
    };
  });
}

async function fetchAll(db, table, columns) {
  // Page through results (PostgREST returns max 1000 rows per request by default).
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await db.from(table).select(columns).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < size) return rows;
  }
}

export default route({
  async GET(req, res) {
    const { db } = await requireAdmin(req);
    const [profiles, progress, lessonCount] = await Promise.all([
      fetchAll(db, 'profiles', 'id, username, email, role, created_at'),
      fetchAll(db, 'user_progress', 'user_id, completed, quiz_score'),
      db.from('lessons').select('id', { count: 'exact', head: true })
    ]);
    if (lessonCount.error) throw new Error(lessonCount.error.message);
    const totalLessons = lessonCount.count || 0;
    const users = buildRoster(profiles, progress, totalLessons).sort((a, b) =>
      String(a.username || a.email).localeCompare(String(b.username || b.email))
    );
    const students = users.filter((u) => u.role === 'student');
    const scored = students.filter((u) => u.avg_quiz_score != null);
    send(res, 200, {
      total_lessons: totalLessons,
      summary: {
        total_users: users.length,
        students: students.length,
        admins: users.length - students.length,
        avg_completion_pct: students.length
          ? Math.round(students.reduce((a, u) => a + u.completion_pct, 0) / students.length)
          : 0,
        avg_quiz_score: scored.length ? Math.round(scored.reduce((a, u) => a + u.avg_quiz_score, 0) / scored.length) : null
      },
      users
    });
  },

  async PATCH(req, res) {
    const { user, db } = await requireAdmin(req);
    const body = readBody(req);
    const userId = validateUuid(body.user_id);
    const role = validateRole(body.role);
    if (userId === user.id.toLowerCase() && role !== 'admin') {
      throw new HttpError(400, 'You cannot remove your own admin role (ask another admin)');
    }
    const { data, error } = await db
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id, username, email, role')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new HttpError(404, 'User not found');
    send(res, 200, { user: data });
  }
});
