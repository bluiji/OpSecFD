// Run: npm test   (uses node:test, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __setClientFactory } from '../api/_lib/supabase.js';
import lessons from '../api/admin/lessons.js';
import users, { buildRoster } from '../api/admin/users.js';
import config from '../api/config.js';
import submitQuiz from '../api/quiz/submit.js';
import { publicQuiz } from '../api/_lib/quiz.js';
import { validateLesson, validateQuiz } from '../api/_lib/validate.js';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.SUPABASE_ANON_KEY = 'anon';

// ---- tiny fake Supabase client -------------------------------------------
const ADMIN = '22222222-2222-2222-2222-222222222222';
const STUDENT = '11111111-1111-1111-1111-111111111111';
function fakeDb(state) {
  const calls = [];
  const builder = (table) => {
    const q = { table, op: 'select', filters: {}, payload: null };
    const exec = () => {
      calls.push(q);
      const rows = state[table] || [];
      const match = rows.filter((r) => Object.entries(q.filters).every(([k, v]) => r[k] === v));
      if (q.op === 'insert') return { data: { id: 99, ...q.payload }, error: null };
      if (q.op === 'update') return { data: match[0] ? { ...match[0], ...q.payload } : null, error: null };
      if (q.op === 'delete') return { data: match[0] ? { id: match[0].id } : null, error: null };
      if (q.op === 'upsert') {
        const keys = q.conflict;
        state[table] = state[table] || [];
        const existing = state[table].find((r) => keys.every((k) => r[k] === q.payload[k]));
        if (existing) Object.assign(existing, q.payload);
        else state[table].push({ ...q.payload });
        return { data: null, error: null };
      }
      if (q.head) return { count: rows.length, error: null };
      return { data: match, error: null };
    };
    const api = {
      select(_c, opts) { if (opts?.head) q.head = true; return api; },
      insert(p) { q.op = 'insert'; q.payload = p; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      delete() { q.op = 'delete'; return api; },
      upsert(p, opts) { q.op = 'upsert'; q.payload = p; q.conflict = (opts?.onConflict || 'id').split(','); return api; },
      order() { return api; },
      eq(k, v) { q.filters[k] = v; return api; },
      range() { return api; },
      single() { const r = exec(); return Promise.resolve({ ...r, data: Array.isArray(r.data) ? r.data[0] : r.data }); },
      maybeSingle() { return api.single(); },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); }
    };
    return api;
  };
  return {
    calls,
    auth: {
      async getUser(token) {
        if (token === 'admin-token') return { data: { user: { id: ADMIN } }, error: null };
        if (token === 'student-token') return { data: { user: { id: STUDENT } }, error: null };
        return { data: { user: null }, error: { message: 'bad jwt' } };
      }
    },
    from: builder
  };
}

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = JSON.parse(b); return this; },
    json(b) { this.body = b; return this; }
  };
}

const goodQuiz = [0, 1, 2].map((i) => ({ question: `Q${i}`, options: ['a', 'b'], answer: 1, explanation: 'why' }));
const goodLesson = {
  module_id: 1, lesson_order: 7, title: 'T', what_is_it: 'a', why_it_matters: 'b', how_it_works: 'c',
  real_world_scenario: 'd', how_to_protect: 'e', quiz_json: goodQuiz
};

function setup() {
  const db = fakeDb({
    profiles: [
      { id: ADMIN, role: 'admin', username: 'adm', email: 'a@x' },
      { id: STUDENT, role: 'student', username: 'stu', email: 's@x' }
    ],
    modules: [{ id: 1 }],
    lessons: [{ id: 5 }, { id: 6 }],
    user_progress: [
      { user_id: STUDENT, completed: true, quiz_score: 80 },
      { user_id: STUDENT, completed: false, quiz_score: 40 }
    ]
  });
  __setClientFactory(() => db);
  return db;
}

// ---- tests ------------------------------------------------------------------
test('config returns public keys only', () => {
  const res = mockRes();
  config({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['supabaseAnonKey', 'supabaseUrl']);
  assert.ok(!JSON.stringify(res.body).includes('service'));
});

test('lessons: rejects missing token, bad token, and non-admins', async () => {
  setup();
  for (const [auth, code] of [[undefined, 401], ['Bearer nope', 401], ['Bearer student-token', 403]]) {
    const res = mockRes();
    await lessons({ method: 'POST', headers: auth ? { authorization: auth } : {}, body: goodLesson }, res);
    assert.equal(res.statusCode, code, `auth=${auth}`);
  }
});

test('lessons: admin can create, update, delete', async () => {
  const db = setup();
  const h = { authorization: 'Bearer admin-token' };
  let res = mockRes();
  await lessons({ method: 'POST', headers: h, body: goodLesson }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.lesson.title, 'T');

  res = mockRes();
  await lessons({ method: 'PUT', headers: h, body: { id: 5, title: 'New' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(db.calls.at(-1).payload.title, 'New');

  res = mockRes();
  await lessons({ method: 'DELETE', headers: h, query: { id: '6' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deleted, 6);

  res = mockRes();
  await lessons({ method: 'DELETE', headers: h, query: { id: '404' } }, res);
  assert.equal(res.statusCode, 404);
});

test('lessons: validation errors return 400; wrong method 405', async () => {
  setup();
  const h = { authorization: 'Bearer admin-token' };
  let res = mockRes();
  await lessons({ method: 'POST', headers: h, body: { ...goodLesson, quiz_json: goodQuiz.slice(0, 2) } }, res);
  assert.equal(res.statusCode, 400);
  res = mockRes();
  await lessons({ method: 'PATCH', headers: h }, res);
  assert.equal(res.statusCode, 405);
  res = mockRes();
  await lessons({ method: 'GET', headers: h, query: {} }, res);
  assert.equal(res.statusCode, 400, 'GET needs module_id');
});

test('lessons: GET returns full lessons (with answer keys) to admins only', async () => {
  __setClientFactory(() =>
    fakeDb({
      profiles: [{ id: ADMIN, role: 'admin' }, { id: STUDENT, role: 'student' }],
      lessons: [{ id: 5, module_id: 1, quiz_json: goodQuiz }, { id: 6, module_id: 2, quiz_json: goodQuiz }]
    })
  );
  let res = mockRes();
  await lessons({ method: 'GET', headers: { authorization: 'Bearer student-token' }, query: { module_id: '1' } }, res);
  assert.equal(res.statusCode, 403);
  res = mockRes();
  await lessons({ method: 'GET', headers: { authorization: 'Bearer admin-token' }, query: { module_id: '1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.lessons.length, 1);
  assert.equal(res.body.lessons[0].quiz_json[0].answer, 1);
});

// ---- quiz grading -----------------------------------------------------------
function quizSetup(progress = []) {
  const db = fakeDb({
    profiles: [{ id: STUDENT, role: 'student' }],
    lessons: [{ id: 9, module_id: 1, quiz_json: goodQuiz }, { id: 10, module_id: 2, quiz_json: [] }],
    user_progress: progress
  });
  __setClientFactory(() => db);
  return db;
}
const stuH = { authorization: 'Bearer student-token' };

test('quiz submit: grades on the server and saves progress for the caller', async () => {
  const db = quizSetup();
  const res = mockRes();
  // goodQuiz: every answer is option 1
  await submitQuiz({ method: 'POST', headers: stuH, body: { lesson_id: 9, answers: [1, 1, 0] } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.correct, 2);
  assert.equal(res.body.score, 67);
  assert.equal(res.body.passed, true);
  assert.deepEqual(res.body.results.map((r) => r.correct), [true, true, false]);
  assert.equal(res.body.results[2].answer, 1);
  const row = db.calls.find((c) => c.op === 'upsert');
  assert.equal(row.table, 'user_progress');
  assert.equal(row.payload.user_id, STUDENT, 'user id comes from the token, not the body');
  assert.equal(row.payload.quiz_score, 67);
  assert.equal(row.payload.completed, true);
});

test('quiz submit: keeps best score and completion on a worse retake', async () => {
  const db = quizSetup([{ user_id: STUDENT, lesson_id: 9, completed: true, quiz_score: 100 }]);
  const res = mockRes();
  await submitQuiz({ method: 'POST', headers: stuH, body: { lesson_id: 9, answers: [0, 0, 0] } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.score, 0);
  assert.equal(res.body.best, 100);
  assert.equal(res.body.completed, true);
  assert.equal(db.calls.find((c) => c.op === 'upsert').payload.quiz_score, 100);
});

test('quiz submit: ignores client-sent scores and rejects bad input', async () => {
  quizSetup();
  const cases = [
    [{}, { lesson_id: 9, answers: [1, 1, 1] }, 401],
    [{ authorization: 'Bearer nope' }, { lesson_id: 9, answers: [1, 1, 1] }, 401],
    [stuH, { lesson_id: 9, answers: [1, 1] }, 400],
    [stuH, { lesson_id: 9, answers: [1, 1, 7] }, 400],
    [stuH, { lesson_id: 9, answers: [1, 1, '1'] }, 400],
    [stuH, { lesson_id: 'x', answers: [1, 1, 1] }, 400],
    [stuH, { lesson_id: 404, answers: [1, 1, 1] }, 404],
    [stuH, { lesson_id: 10, answers: [] }, 400]
  ];
  for (const [headers, body, code] of cases) {
    const res = mockRes();
    await submitQuiz({ method: 'POST', headers, body }, res);
    assert.equal(res.statusCode, code, JSON.stringify(body));
  }
  const res = mockRes();
  await submitQuiz({ method: 'POST', headers: stuH, body: { lesson_id: 9, answers: [0, 0, 0], score: 100, completed: true } }, res);
  assert.equal(res.body.score, 0);
  assert.equal(res.body.completed, false);
  const getRes = mockRes();
  await submitQuiz({ method: 'GET', headers: stuH }, getRes);
  assert.equal(getRes.statusCode, 405);
});

test('publicQuiz strips answers and explanations', () => {
  const pub = publicQuiz(goodQuiz);
  assert.deepEqual(Object.keys(pub[0]).sort(), ['options', 'question']);
  assert.ok(!JSON.stringify(pub).includes('why'));
});

test('users: roster aggregation and role update rules', async () => {
  setup();
  const h = { authorization: 'Bearer admin-token' };
  let res = mockRes();
  await users({ method: 'GET', headers: h }, res);
  assert.equal(res.statusCode, 200);
  const stu = res.body.users.find((u) => u.id === STUDENT);
  assert.equal(stu.lessons_completed, 1);
  assert.equal(stu.completion_pct, 50); // 1 of 2 lessons
  assert.equal(stu.avg_quiz_score, 60); // (80+40)/2

  res = mockRes();
  await users({ method: 'PATCH', headers: h, body: { user_id: ADMIN, role: 'student' } }, res);
  assert.equal(res.statusCode, 400, 'cannot demote self');

  res = mockRes();
  await users({ method: 'PATCH', headers: h, body: { user_id: STUDENT, role: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.role, 'admin');

  res = mockRes();
  await users({ method: 'PATCH', headers: h, body: { user_id: STUDENT, role: 'root' } }, res);
  assert.equal(res.statusCode, 400);
});

test('validators', () => {
  assert.doesNotThrow(() => validateLesson(goodLesson));
  assert.throws(() => validateQuiz([{ question: 'q', options: ['a', 'b'], answer: 5, explanation: 'x' }]));
  assert.throws(() => validateLesson({ title: '' }, { partial: true }));
  assert.deepEqual(buildRoster([{ id: 'x' }], [], 0)[0].completion_pct, 0);
});
