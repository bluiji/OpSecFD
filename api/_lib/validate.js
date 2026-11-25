// Pure validation helpers (unit-tested in tests/validate.test.js).
import { HttpError } from './supabase.js';

const TEXT_FIELDS = ['what_is_it', 'why_it_matters', 'how_it_works', 'real_world_scenario', 'how_to_protect'];
const MAX_TEXT = 20000;

function str(v, name, { required = false, max = MAX_TEXT } = {}) {
  if (v == null || v === '') {
    if (required) throw new HttpError(400, `${name} is required`);
    return null;
  }
  if (typeof v !== 'string') throw new HttpError(400, `${name} must be a string`);
  const t = v.trim();
  if (required && !t) throw new HttpError(400, `${name} is required`);
  if (t.length > max) throw new HttpError(400, `${name} is too long (max ${max} characters)`);
  return t;
}

function posInt(v, name) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${name} must be a positive integer`);
  return n;
}

export function validateQuiz(quiz) {
  if (!Array.isArray(quiz)) throw new HttpError(400, 'quiz_json must be an array');
  if (quiz.length < 3 || quiz.length > 5) throw new HttpError(400, 'quiz_json must contain 3–5 questions');
  return quiz.map((q, i) => {
    const label = `Question ${i + 1}`;
    if (!q || typeof q !== 'object') throw new HttpError(400, `${label} must be an object`);
    const question = str(q.question, `${label} text`, { required: true, max: 1000 });
    if (!Array.isArray(q.options)) throw new HttpError(400, `${label} options must be an array`);
    const options = q.options.map((o, j) => str(o, `${label} option ${j + 1}`, { required: true, max: 500 }));
    if (options.length < 2 || options.length > 6) throw new HttpError(400, `${label} needs 2–6 options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= options.length) {
      throw new HttpError(400, `${label} answer must be a valid option index`);
    }
    const explanation = str(q.explanation, `${label} explanation`, { required: true, max: 2000 });
    return { question, options, answer: q.answer, explanation };
  });
}

/** Validates a lesson payload. partial=true allows omitted fields (for PUT). */
export function validateLesson(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.module_id !== undefined) out.module_id = posInt(body.module_id, 'module_id');
  if (!partial || body.lesson_order !== undefined) out.lesson_order = posInt(body.lesson_order, 'lesson_order');
  if (!partial || body.title !== undefined) out.title = str(body.title, 'title', { required: true, max: 200 });
  for (const f of TEXT_FIELDS) {
    if (!partial || body[f] !== undefined) out[f] = str(body[f], f, { required: true });
  }
  if (!partial || body.quiz_json !== undefined) out.quiz_json = validateQuiz(body.quiz_json);
  if (partial && Object.keys(out).length === 0) throw new HttpError(400, 'No fields to update');
  return out;
}

export function validateId(v, name = 'id') {
  return posInt(v, name);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateUuid(v, name = 'user_id') {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw new HttpError(400, `${name} must be a UUID`);
  return v.toLowerCase();
}

export function validateRole(v) {
  if (v !== 'student' && v !== 'admin') throw new HttpError(400, "role must be 'student' or 'admin'");
  return v;
}
