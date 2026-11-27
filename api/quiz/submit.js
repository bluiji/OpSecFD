// POST /api/quiz/submit  { lesson_id, answers: [optionIndex, ...] }
// Grades a lesson quiz on the server and records progress. Users can't write
// user_progress directly (see supabase/ddl.sql), so scores can't be faked, and
// the answer key never reaches the browser before an attempt.
// Requires: Authorization: Bearer <Supabase access token>.
import { route, requireUser, readBody, send, HttpError } from '../_lib/supabase.js';
import { validateId } from '../_lib/validate.js';
import { gradeQuiz, mergeProgress } from '../_lib/quiz.js';

export default route({
  async POST(req, res) {
    const { user, db } = await requireUser(req);
    const body = readBody(req);
    const lessonId = validateId(body.lesson_id, 'lesson_id');

    const { data: lesson, error: lErr } = await db.from('lessons').select('id, quiz_json').eq('id', lessonId).maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!lesson) throw new HttpError(404, 'Lesson not found');

    const graded = gradeQuiz(lesson.quiz_json, body.answers);

    const { data: prev, error: pErr } = await db
      .from('user_progress')
      .select('completed, quiz_score')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const { completed, best } = mergeProgress(prev, graded);
    const { error: uErr } = await db
      .from('user_progress')
      .upsert(
        { user_id: user.id, lesson_id: lessonId, completed, quiz_score: best, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,lesson_id' }
      );
    if (uErr) throw new Error(uErr.message);

    send(res, 200, { ...graded, best, completed });
  }
});
