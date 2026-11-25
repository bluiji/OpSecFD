// /api/admin/lessons
//   POST   { module_id, lesson_order, title, what_is_it, ..., quiz_json }   → create
//   PUT    { id, ...fields }  (or ?id=)                                     → update
//   DELETE ?id=  (or { id })                                                 → delete
// Requires: Authorization: Bearer <Supabase access token> of an admin.
import { route, requireAdmin, readBody, send, HttpError } from '../_lib/supabase.js';
import { validateLesson, validateId } from '../_lib/validate.js';

const COLUMNS = 'id, module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json';

function dbError(error) {
  if (error?.code === '23505') return new HttpError(409, 'A lesson with that order already exists in this module');
  if (error?.code === '23503') return new HttpError(400, 'module_id does not exist');
  return new Error(error?.message || 'Database error');
}

async function ensureModule(db, moduleId) {
  const { data, error } = await db.from('modules').select('id').eq('id', moduleId).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new HttpError(400, 'module_id does not exist');
}

export default route({
  async POST(req, res) {
    const { db } = await requireAdmin(req);
    const lesson = validateLesson(readBody(req));
    await ensureModule(db, lesson.module_id);
    const { data, error } = await db.from('lessons').insert(lesson).select(COLUMNS).single();
    if (error) throw dbError(error);
    send(res, 201, { lesson: data });
  },

  async PUT(req, res) {
    const { db } = await requireAdmin(req);
    const body = readBody(req);
    const id = validateId(body.id ?? req.query?.id);
    const { id: _ignored, ...rest } = body;
    const changes = validateLesson(rest, { partial: true });
    if (changes.module_id) await ensureModule(db, changes.module_id);
    const { data, error } = await db.from('lessons').update(changes).eq('id', id).select(COLUMNS).maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new HttpError(404, 'Lesson not found');
    send(res, 200, { lesson: data });
  },

  async DELETE(req, res) {
    const { db } = await requireAdmin(req);
    const id = validateId(req.query?.id ?? readBody(req).id);
    const { data, error } = await db.from('lessons').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new HttpError(404, 'Lesson not found');
    send(res, 200, { deleted: data.id });
  }
});
